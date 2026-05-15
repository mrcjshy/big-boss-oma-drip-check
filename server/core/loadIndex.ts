/**
 * Lazy loader for the pre-computed lookbook embeddings.
 *
 * Build flow:
 *   1. Developer runs `npm run build:embeddings` (calls Gemini, writes
 *      `server/embeddings.json`).
 *   2. The file is committed and shipped with the deployment.
 *   3. Serverless / Express entry points call `ensureIndexLoaded()` on
 *      cold start, which reads the JSON synchronously and hydrates the
 *      in-memory `indexedLooks` array consumed by `retriever.ts`.
 *
 * Fallback: if the file is missing (e.g. fresh clone before reindex), and
 * a GEMINI_API_KEY is available, we live-build the index. This keeps
 * `npm run server` ergonomic without forcing every contributor to run the
 * embeddings script first. In a Vercel function we never fall back —
 * the precomputed file is required because cold-start Gemini calls would
 * exceed the 10s function budget and burn a quota every cold start.
 */

import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import type { IndexedLook } from '../matching/types'
import { buildIndex, setIndex } from '../catalog/indexer'

const EMBEDDINGS_FILENAME = 'embeddings.json'

let loaded = false
let loadPromise: Promise<void> | null = null

const resolveEmbeddingsPath = (): string =>
  process.env.EMBEDDINGS_PATH
    ?? path.resolve(process.cwd(), 'server', EMBEDDINGS_FILENAME)

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

type LoadOptions = {
  /**
   * When true, refuses to fall back to a live `buildIndex()` call. Vercel
   * handlers should pass `true` so missing embeddings surface as a clear
   * deploy-time error rather than a silent Gemini storm.
   */
  strict?: boolean
}

const loadOnce = async ({ strict = false }: LoadOptions): Promise<void> => {
  const filePath = resolveEmbeddingsPath()
  if (await fileExists(filePath)) {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as IndexedLook[]
    if (!Array.isArray(parsed)) {
      throw new Error(`Malformed embeddings file at ${filePath}: expected array`)
    }
    setIndex(parsed)
    return
  }

  if (strict) {
    throw new Error(
      `Missing ${filePath}. Run \`npm run build:embeddings\` and ship the result with the deploy.`,
    )
  }

  console.warn(
    `[loadIndex] ${filePath} not found — falling back to live buildIndex(). ` +
      'Run `npm run build:embeddings` to avoid this.',
  )
  await buildIndex()
}

/**
 * Idempotent. Safe to call from every request handler — the heavy load
 * runs exactly once per process, subsequent calls await the same
 * resolved promise. The cache reset on failure prevents a poisoned
 * promise from breaking every later invocation on the same container.
 */
export const ensureIndexLoaded = async (options: LoadOptions = {}): Promise<void> => {
  if (loaded) return
  if (loadPromise) return loadPromise

  loadPromise = loadOnce(options)
    .then(() => {
      loaded = true
    })
    .catch(err => {
      loadPromise = null
      throw err
    })

  return loadPromise
}

/** Reset for tests / hot-reload. */
export const __resetIndexLoaderForTests = (): void => {
  loaded = false
  loadPromise = null
}
