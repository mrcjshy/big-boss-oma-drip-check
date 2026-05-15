import fs from 'fs/promises'
import type { LookbookCatalog } from './schema'
import type { IndexedLook } from '../matching/types'
import { buildLookFeatureText } from '../matching/featureBuilder'
import { embedText } from '../gemini'
import { config } from '../config'

let indexedLooks: IndexedLook[] = []

export function getIndex(): IndexedLook[] {
  return indexedLooks
}

export async function loadCatalog(): Promise<LookbookCatalog> {
  const raw = await fs.readFile(config.catalogPath, 'utf-8')
  return JSON.parse(raw) as LookbookCatalog
}

export async function buildIndex(): Promise<IndexedLook[]> {
  const catalog = await loadCatalog()
  const results: IndexedLook[] = []

  for (const entry of catalog.looks) {
    const featureText = buildLookFeatureText(entry)
    const embedding = await embedText(featureText)
    results.push({ entry, embedding })
  }

  indexedLooks = results
  console.log(`[Indexer] Indexed ${results.length} looks`)
  return results
}
