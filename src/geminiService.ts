import { normalizeBbox } from '../shared/bbox'
import {
  buildPlatformUrl,
  fallbackAnalysis,
  GEMINI_MODEL,
  GEMINI_SYSTEM_PROMPT,
} from './constants'
import type {
  AnalyzeResponse,
  ClothingItem,
  GeminiAnalysis,
  GeminiPlatformDeal,
  OutfitAnalysis,
  PlatformDeal,
  PlatformId,
} from './types'

export { normalizeBbox }

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

const responseSchema = {
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
          bbox: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
          },
          platforms: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                platform: {
                  type: 'STRING',
                  enum: ['shopee', 'lazada', 'carousell'],
                },
                query: { type: 'STRING' },
                estimatedPricePhp: { type: 'NUMBER' },
                reason: { type: 'STRING' },
              },
              required: ['platform', 'query', 'estimatedPricePhp', 'reason'],
            },
          },
        },
        required: [
          'itemName',
          'category',
          'color',
          'style',
          'materialHint',
          'confidence',
          'budgetNote',
          'bestBuyReason',
          'bbox',
          'platforms',
        ],
      },
    },
  },
  required: ['vibe', 'summary', 'estimatedTotalPhp', 'tipidTip', 'items'],
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.split(',')[1] ?? result)
    }
    reader.onerror = () => reject(new Error('Hindi mabasa yung image. Try another photo.'))
    reader.readAsDataURL(file)
  })

export const parseGeminiJson = (text: string): GeminiAnalysis => {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  return JSON.parse(cleaned) as GeminiAnalysis
}

const isPlatformId = (platform: string): platform is PlatformId =>
  platform === 'shopee' || platform === 'lazada' || platform === 'carousell'

const MIN_CONFIDENCE = 0.15

export const normalizeDeal = (deal: GeminiPlatformDeal): PlatformDeal | null => {
  if (!isPlatformId(deal.platform)) return null

  const query = deal.query?.trim()
  if (!query) return null

  const price = Number(deal.estimatedPricePhp)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    platform: deal.platform,
    query,
    url: buildPlatformUrl(deal.platform, query),
    estimatedPricePhp: Math.round(price),
    reason: deal.reason || 'Sulit option for this item.',
  }
}

export const normalizeAnalysis = (analysis: GeminiAnalysis): OutfitAnalysis => {
  const items: ClothingItem[] = analysis.items.flatMap((item, index) => {
    const confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0))
    if (confidence < MIN_CONFIDENCE) return []

    const bbox = normalizeBbox(item.bbox)
    if (!bbox) return []

    const platforms = item.platforms.flatMap((deal) => {
      const normalized = normalizeDeal(deal)
      return normalized ? [normalized] : []
    })
    if (platforms.length === 0) return []

    const bestDeal = [...platforms].sort(
      (a, b) => a.estimatedPricePhp - b.estimatedPricePhp,
    )[0]

    return [
      {
        id: `${item.category}-${index}`,
        itemName: item.itemName,
        category: item.category,
        color: item.color,
        style: item.style,
        materialHint: item.materialHint,
        confidence,
        budgetNote: item.budgetNote,
        platforms,
        bestPlatform: bestDeal.platform,
        bestBuyReason: item.bestBuyReason,
        bbox,
      },
    ]
  })

  return {
    vibe: analysis.vibe,
    summary: analysis.summary,
    estimatedTotalPhp: Math.round(Number(analysis.estimatedTotalPhp) || 0),
    tipidTip: analysis.tipidTip,
    items,
  }
}

export const getDemoAnalysis = (): OutfitAnalysis => normalizeAnalysis(fallbackAnalysis)

export const analyzeOutfit = async (file: File): Promise<OutfitAnalysis> => {
  if (!API_KEY) {
    throw new Error('Missing VITE_GEMINI_API_KEY. Add it to .env.local, then restart dev.')
  }

  const base64 = await fileToBase64(file)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: GEMINI_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Analyze this outfit for affordable Filipino shopping alternatives. Return JSON only.',
              },
              {
                inlineData: {
                  mimeType: file.type || 'image/jpeg',
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status}. ${errorText.slice(0, 180)}`)
  }

  const payload = await response.json()
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Walang JSON na binalik si Gemini. Try a clearer outfit photo.')
  }

  return normalizeAnalysis(parseGeminiJson(text))
}

export const matchOutfit = async (file: File): Promise<AnalyzeResponse> => {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Server unavailable' })) as { error?: string }
    throw new Error(payload.error || `Server error: ${response.status}`)
  }

  return response.json() as Promise<AnalyzeResponse>
}
