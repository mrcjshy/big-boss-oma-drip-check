/**
 * POST /api/analyze — primary outfit analysis endpoint.
 *
 * Accepts: `multipart/form-data` with a single `image` field (jpeg/png/webp).
 * Returns: `{ analysis, match }` — identical shape to the Express dev route.
 *
 * The handler:
 *   1. Parses multipart with `formidable` (Vercel's default body parser is
 *      disabled below).
 *   2. Loads the precomputed lookbook embeddings on first invocation (cold
 *      start). In production this is mandatory — we never live-build the
 *      index because each Gemini embed call eats >1s and the lookbook has
 *      N entries.
 *   3. Delegates to the shared `runAnalysis` pipeline.
 *   4. Cleans up the temp file formidable wrote, even on error.
 *
 * Secret note: this runs server-side only and reads `GEMINI_API_KEY` (or
 * legacy `VITE_GEMINI_API_KEY`) via `server/config.ts`. The API key is
 * never returned to the client and stack traces are not echoed.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable, { type File as FormidableFile } from 'formidable'
import { readFile, unlink } from 'node:fs/promises'
import { runAnalysis } from '../server/core/analyze'
import { ensureIndexLoaded } from '../server/core/loadIndex'

export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB — matches Express multer limit.

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

type ParsedUpload = {
  buffer: Buffer
  mimeType: string
  cleanup: () => Promise<void>
}

const parseSingleImage = async (req: VercelRequest): Promise<ParsedUpload> => {
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
    keepExtensions: false,
  })

  const [, files] = await form.parse(req)
  const raw = files.image
  const fileEntry: FormidableFile | undefined = Array.isArray(raw) ? raw[0] : raw
  if (!fileEntry) {
    throw new HttpError(400, 'No image provided. Attach a file under the "image" field.')
  }

  const mimeType = fileEntry.mimetype || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    await safeUnlink(fileEntry.filepath)
    throw new HttpError(415, `Unsupported image type: ${mimeType}`)
  }

  const buffer = await readFile(fileEntry.filepath)
  return {
    buffer,
    mimeType,
    cleanup: () => safeUnlink(fileEntry.filepath),
  }
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const safeUnlink = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath)
  } catch {
    /* swallow — temp cleanup is best-effort */
  }
}

const isMaxFileSizeError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: unknown }).code === 'LIMIT_FILE_SIZE'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let upload: ParsedUpload | null = null

  try {
    try {
      upload = await parseSingleImage(req)
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message })
        return
      }
      if (isMaxFileSizeError(err)) {
        res.status(413).json({ error: 'Image is larger than the 10 MB limit.' })
        return
      }
      throw err
    }

    await ensureIndexLoaded({ strict: true })

    const result = await runAnalysis({
      base64Image: upload.buffer.toString('base64'),
      mimeType: upload.mimeType,
    })

    res.status(200).json(result)
  } catch (error) {
    console.error('[api/analyze] Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Analysis failed'
    res.status(500).json({ error: sanitizeErrorMessage(message) })
  } finally {
    if (upload) {
      await upload.cleanup()
    }
  }
}

/**
 * Strip anything that smells like a stack trace or an embedded API key out
 * of an error message before returning it to the client. `callGeminiVision`
 * already trims the upstream payload, but defense-in-depth.
 */
const sanitizeErrorMessage = (message: string): string => {
  const firstLine = message.split('\n')[0]
  return firstLine.replace(/key=[^&\s]+/gi, 'key=***').slice(0, 240)
}
