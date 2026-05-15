import fs from 'node:fs/promises'
import path from 'node:path'
import type { LookbookCatalog } from './schema'
import type { IndexedLook } from '../matching/types'
import { buildLookFeatureText } from '../matching/featureBuilder'
import { embedText } from '../gemini'
import { config } from '../config'

let indexedLooks: IndexedLook[] = []

export const getIndex = (): IndexedLook[] => indexedLooks

/**
 * Replace the in-memory index. Used by the runtime loader to hydrate from
 * a precomputed embeddings file without paying Gemini cold-start cost.
 */
export const setIndex = (next: IndexedLook[]): void => {
  indexedLooks = next
}

export const loadCatalog = async (): Promise<LookbookCatalog> => {
  const raw = await fs.readFile(config.catalogPath, 'utf-8')
  return JSON.parse(raw) as LookbookCatalog
}

/**
 * Live-embed the lookbook by calling Gemini for each look. Mutates the
 * module-scoped index AND returns it so callers (`reindex.ts`,
 * `precomputeEmbeddings.ts`) can do whatever they need.
 */
export const buildIndex = async (): Promise<IndexedLook[]> => {
  const catalog = await loadCatalog()
  const results: IndexedLook[] = []

  for (const entry of catalog.looks) {
    const featureText = buildLookFeatureText(entry)
    const embedding = await embedText(featureText)
    results.push({ entry, embedding })
  }

  setIndex(results)
  console.log(`[Indexer] Indexed ${results.length} looks`)
  return results
}

/**
 * Persist the current (or freshly built) index to disk as `embeddings.json`.
 * The file is the single source of truth that serverless functions load on
 * cold start. Keeping the writer here (rather than in the build script)
 * means tests and ad-hoc scripts can also call it.
 */
export const writeIndexToFile = async (
  index: IndexedLook[],
  filePath?: string,
): Promise<string> => {
  const target = filePath
    ?? process.env.EMBEDDINGS_PATH
    ?? path.resolve(process.cwd(), 'server', 'embeddings.json')
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify(index), 'utf-8')
  return target
}
