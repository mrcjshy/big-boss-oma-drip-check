/**
 * POST /api/catalog/reindex — admin/utility endpoint.
 *
 * Why this is a soft-no in production:
 *   - Reindex calls Gemini once per lookbook entry. Doing that inside a
 *     serverless function would burn budget and routinely time out as
 *     the catalog grows.
 *   - The serverless filesystem is read-only — even if we re-embedded,
 *     we could not persist `embeddings.json` back to the deploy.
 *
 * Correct workflow:
 *   1. Edit `server/lookbook.json` locally.
 *   2. Run `npm run build:embeddings` to regenerate `server/embeddings.json`.
 *   3. Commit + redeploy.
 *
 * To unlock a real reindex (e.g. behind a feature flag), set
 * `ALLOW_REMOTE_REINDEX=true` in the Vercel project. The endpoint will
 * then attempt a live `buildIndex()` — useful for short-lived previews
 * but never recommended for `production`.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildIndex } from '../../server/catalog/indexer'

const isAuthorized = (req: VercelRequest): boolean => {
  const expected = process.env.REINDEX_TOKEN
  if (!expected) return false
  const header = req.headers['x-reindex-token']
  const provided = Array.isArray(header) ? header[0] : header
  return typeof provided === 'string' && provided === expected
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (process.env.ALLOW_REMOTE_REINDEX !== 'true') {
    res.status(403).json({
      error:
        'Remote reindex is disabled. Run `npm run build:embeddings` locally and redeploy.',
    })
    return
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Missing or invalid x-reindex-token header.' })
    return
  }

  try {
    const indexed = await buildIndex()
    res.status(200).json({
      indexed: indexed.length,
      note:
        'Index rebuilt in-memory for this function instance only. Cold-start' +
        ' replicas will revert to the shipped embeddings.json.',
    })
  } catch (error) {
    console.error('[api/catalog/reindex] Reindex error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message.split('\n')[0] : 'Reindex failed',
    })
  }
}
