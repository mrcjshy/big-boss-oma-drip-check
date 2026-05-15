/**
 * Build-time script that calls Gemini to embed every entry in
 * `server/lookbook.json` and writes the resulting vectors to
 * `server/embeddings.json`. Serverless functions load that file on cold
 * start instead of paying the Gemini cost on every container boot.
 *
 * Usage: `npm run build:embeddings`
 *
 * Requires `GEMINI_API_KEY` (or legacy `VITE_GEMINI_API_KEY`) in the
 * environment. Loaded via `server/config.ts` (which reads `.env.local`
 * and `.env`).
 */

import { buildIndex, writeIndexToFile } from './catalog/indexer'

const main = async (): Promise<void> => {
  console.log('[build:embeddings] Embedding lookbook...')
  const index = await buildIndex()
  const target = await writeIndexToFile(index)
  console.log(`[build:embeddings] Wrote ${index.length} embeddings to ${target}`)
}

main().catch(err => {
  console.error('[build:embeddings] Failed:', err)
  process.exit(1)
})
