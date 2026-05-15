import type { LookbookEntry } from '../catalog/schema'

export type FeatureVector = number[]

export type IndexedLook = {
  entry: LookbookEntry
  embedding: FeatureVector
}

export type MatchCandidate = {
  lookId: string
  lookName: string
  matchScore: number
  vectorScore: number
  attributeScore: number
  explanations: string[]
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type MatchResult = {
  topMatch: MatchCandidate | null
  candidates: MatchCandidate[]
  isLowConfidence: boolean
  confidenceLevel: ConfidenceLevel
}

export type ParsedItem = {
  itemName: string
  category: string
  color: string
  style: string
  materialHint: string
  confidence: number
  bbox: [number, number, number, number] | null
}
