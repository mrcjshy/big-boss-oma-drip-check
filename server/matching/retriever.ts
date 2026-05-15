import type { IndexedLook, FeatureVector, ParsedItem } from './types'
import { buildQueryFeatureText } from './featureBuilder'
import { embedText } from '../gemini'
import { getIndex } from '../catalog/indexer'

function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export async function retrieveTopK(
  queryItems: ParsedItem[],
  topK: number,
): Promise<{ look: IndexedLook; vectorScore: number }[]> {
  const index = getIndex()
  if (index.length === 0) return []

  const queryText = buildQueryFeatureText(queryItems)
  if (!queryText) return []

  const queryEmbedding = await embedText(queryText)
  if (queryEmbedding.length === 0) return []

  const scored = index.map(look => ({
    look,
    vectorScore: cosineSimilarity(queryEmbedding, look.embedding),
  }))

  scored.sort((a, b) => b.vectorScore - a.vectorScore)
  return scored.slice(0, topK)
}

export { cosineSimilarity }
