/**
 * Local Express dev server. Thin adapter around `server/core/*` — the same
 * business logic powers the Vercel serverless functions under `api/`.
 *
 * Run with `npm run server` (or `npm run dev:full` for server + Vite UI).
 */

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { config } from './config'
import { buildIndex } from './catalog/indexer'
import { runAnalysis } from './core/analyze'
import { ensureIndexLoaded } from './core/loadIndex'
import { GeminiQuotaError } from './gemini'

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image provided' })
      return
    }

    const result = await runAnalysis({
      base64Image: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
    })

    res.json(result)
  } catch (error) {
    if (error instanceof GeminiQuotaError) {
      console.warn('[Server] Gemini quota exhausted; client should show demo fallback.')
      res.status(429).json({
        error: 'Gemini quota napuno for now. Try ulit later.',
        code: 'quota_exceeded',
      })
      return
    }

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

const start = async (): Promise<void> => {
  console.log('[Server] Loading lookbook index...')
  try {
    await ensureIndexLoaded()
  } catch (error) {
    console.warn(
      '[Server] Could not load index on startup (will start with empty index):',
      error,
    )
  }

  app.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`)
  })
}

start()
