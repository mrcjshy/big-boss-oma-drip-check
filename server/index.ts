import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { config } from './config'
import { buildIndex } from './catalog/indexer'
import { callGeminiVision } from './gemini'
import { retrieveTopK } from './matching/retriever'
import { rerankCandidates } from './matching/reranker'
import { applyConfidenceGate } from './matching/decision'
import type { ParsedItem } from './matching/types'

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const EXTRACTION_PROMPT = `
You are Drip Check, a precision fashion detection and shopping agent for Filipino shoppers.

PRIMARY OBJECTIVE: Accurately identify every visible clothing item and wearable accessory.
Precision matters more than recall — do NOT hallucinate items that are not clearly visible.

For each detected item:
1. Classify its category precisely (Top, Bottom, Footwear, Outerwear, Accessory, Bag, Hat, etc.)
2. Identify the dominant color(s) accurately.
3. Describe the style (Streetwear, Casual, Formal, Smart Casual, Athleisure, Y2K, etc.)
4. Provide a material hint based on visual texture.
5. Assign a calibrated confidence score (0.0–1.0):
   - 0.9+ = clearly visible, unambiguous
   - 0.7–0.89 = likely correct but partially occluded
   - 0.5–0.69 = best guess, significant uncertainty
   - Below 0.5 = do not include
6. Return a tight bounding box [ymin, xmin, ymax, xmax] in 0–1000 normalized coordinates.
   Must tightly surround ONLY that garment. No full-frame boxes.
7. Generate Filipino-optimized search queries for Shopee PH, Lazada PH, and Carousell/ukay.
8. Estimate realistic budget prices in PHP for a working student.
9. Compare platforms per item and choose a Best Buy automatically.

Rules:
- Only include items with confidence >= 0.5
- Bounding boxes must have ymax > ymin and xmax > xmin
- Use PH fashion vocabulary: ukay, thrifted, pambahay, pang-campus, coords, etc.
- Prices are estimates only — never claim real-time availability
- Keep copy concise, practical, and Taglish where natural
`.trim()

const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    vibe: { type: 'STRING' },
    summary: { type: 'STRING' },
    estimatedTotalPhp: { type: 'NUMBER' },
    tipidTip: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          itemName: { type: 'STRING' },
          category: { type: 'STRING' },
          color: { type: 'STRING' },
          style: { type: 'STRING' },
          materialHint: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
          budgetNote: { type: 'STRING' },
          bestBuyReason: { type: 'STRING' },
          bbox: { type: 'ARRAY', items: { type: 'INTEGER' } },
          platforms: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                platform: { type: 'STRING', enum: ['shopee', 'lazada', 'carousell'] },
                query: { type: 'STRING' },
                estimatedPricePhp: { type: 'NUMBER' },
                reason: { type: 'STRING' },
              },
              required: ['platform', 'query', 'estimatedPricePhp', 'reason'],
            },
          },
        },
        required: [
          'itemName', 'category', 'color', 'style', 'materialHint',
          'confidence', 'budgetNote', 'bestBuyReason', 'bbox', 'platforms',
        ],
      },
    },
  },
  required: ['vibe', 'summary', 'estimatedTotalPhp', 'tipidTip', 'items'],
}

type RawGeminiItem = {
  itemName: string
  category: string
  color: string
  style: string
  materialHint: string
  confidence: number
  budgetNote: string
  bestBuyReason: string
  bbox: unknown
  platforms: {
    platform: string
    query: string
    estimatedPricePhp: number
    reason: string
  }[]
}

type RawGeminiAnalysis = {
  vibe: string
  summary: string
  estimatedTotalPhp: number
  tipidTip: string
  items: RawGeminiItem[]
}

const MIN_CONFIDENCE = 0.15
const MIN_BBOX_AREA = 5000

function hardenBbox(rawBbox: unknown): [number, number, number, number] | null {
  if (!Array.isArray(rawBbox) || rawBbox.length !== 4) return null

  const coerced = rawBbox.map(v =>
    Math.round(Math.min(1000, Math.max(0, Number(v) || 0))),
  ) as [number, number, number, number]

  const [ymin, xmin, ymax, xmax] = coerced
  if (ymax <= ymin || xmax <= xmin) return null

  const area = (ymax - ymin) * (xmax - xmin)
  if (area < MIN_BBOX_AREA) return null

  return coerced
}

function hardenItems(raw: RawGeminiAnalysis): ParsedItem[] {
  return raw.items
    .filter(item => {
      const conf = Number(item.confidence) || 0
      return conf >= MIN_CONFIDENCE
    })
    .map(item => ({
      itemName: item.itemName,
      category: item.category,
      color: item.color,
      style: item.style,
      materialHint: item.materialHint,
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
      bbox: hardenBbox(item.bbox),
    }))
}

type PlatformId = 'shopee' | 'lazada' | 'carousell'

function isPlatformId(p: string): p is PlatformId {
  return p === 'shopee' || p === 'lazada' || p === 'carousell'
}

function buildPlatformUrl(platform: PlatformId, query: string): string {
  const encoded = encodeURIComponent(query.trim())
  if (platform === 'shopee') return `https://shopee.ph/search?keyword=${encoded}`
  if (platform === 'lazada') return `https://www.lazada.com.ph/catalog/?q=${encoded}`
  return `https://www.carousell.ph/search/${encoded}/`
}

function buildFullAnalysis(raw: RawGeminiAnalysis) {
  const items = raw.items
    .filter(item => Number(item.confidence) >= MIN_CONFIDENCE)
    .flatMap((item, index) => {
      const bbox = hardenBbox(item.bbox)
      if (!bbox) return []

      const validDeals = item.platforms.flatMap(deal => {
        if (!isPlatformId(deal.platform)) return []
        const query = deal.query?.trim()
        if (!query) return []
        const price = Number(deal.estimatedPricePhp)
        if (!Number.isFinite(price) || price <= 0) return []
        return [{
          platform: deal.platform as PlatformId,
          query,
          url: buildPlatformUrl(deal.platform as PlatformId, query),
          estimatedPricePhp: Math.round(price),
          reason: deal.reason || 'Sulit option for this item.',
        }]
      })

      if (validDeals.length === 0) return []

      const bestDeal = [...validDeals].sort((a, b) => a.estimatedPricePhp - b.estimatedPricePhp)[0]

      return [{
        id: `${item.category}-${index}`,
        itemName: item.itemName,
        category: item.category,
        color: item.color,
        style: item.style,
        materialHint: item.materialHint,
        confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
        budgetNote: item.budgetNote,
        platforms: validDeals,
        bestPlatform: bestDeal.platform,
        bestBuyReason: item.bestBuyReason,
        bbox,
      }]
    })

  return {
    vibe: raw.vibe,
    summary: raw.summary,
    estimatedTotalPhp: Math.round(Number(raw.estimatedTotalPhp) || 0),
    tipidTip: raw.tipidTip,
    items,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' })
      return
    }

    const base64 = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype

    const rawText = await callGeminiVision(
      base64,
      mimeType,
      EXTRACTION_PROMPT,
      'Analyze this outfit for affordable Filipino shopping alternatives. Return JSON only.',
      EXTRACTION_SCHEMA,
    )

    const parsed = JSON.parse(rawText) as RawGeminiAnalysis
    const analysis = buildFullAnalysis(parsed)
    const hardenedItems = hardenItems(parsed)

    const topK = await retrieveTopK(hardenedItems, config.thresholds.topK)
    const ranked = rerankCandidates(hardenedItems, topK)
    const matchResult = applyConfidenceGate(ranked)

    res.json({ analysis, match: matchResult })
  } catch (error) {
    console.error('[Server] Analysis error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    })
  }
})

app.post('/api/catalog/reindex', async (_req, res) => {
  try {
    const indexed = await buildIndex()
    res.json({ indexed: indexed.length })
  } catch (error) {
    console.error('[Server] Reindex error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Reindex failed',
    })
  }
})

async function start() {
  console.log('[Server] Building lookbook index...')
  try {
    await buildIndex()
  } catch (error) {
    console.warn('[Server] Could not build index on startup (will start with empty index):', error)
  }

  app.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`)
  })
}

start()
