/**
 * GET /api/health — minimal liveness probe used to confirm the function
 * runtime is healthy and the deploy succeeded. Intentionally avoids any
 * dependency on Gemini, embeddings, or env vars so it returns 200 even
 * when the rest of the stack is misconfigured.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({ status: 'ok' })
}
