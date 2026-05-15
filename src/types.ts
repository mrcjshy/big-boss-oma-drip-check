export type PlatformId = 'shopee' | 'lazada' | 'carousell'

export type PlatformDeal = {
  platform: PlatformId
  query: string
  url: string
  estimatedPricePhp: number
  reason: string
}

export type ClothingItem = {
  id: string
  itemName: string
  category: string
  color: string
  style: string
  materialHint: string
  confidence: number
  budgetNote: string
  platforms: PlatformDeal[]
  bestPlatform: PlatformId
  bestBuyReason: string
  bbox: [number, number, number, number]
}

export type OutfitAnalysis = {
  vibe: string
  summary: string
  estimatedTotalPhp: number
  tipidTip: string
  items: ClothingItem[]
}

export type GeminiPlatformDeal = Omit<PlatformDeal, 'url'>

export type GeminiClothingItem = Omit<ClothingItem, 'id' | 'platforms' | 'bestPlatform'> & {
  platforms: GeminiPlatformDeal[]
}

export type GeminiAnalysis = Omit<OutfitAnalysis, 'items'> & {
  items: GeminiClothingItem[]
}

export type SampleOutfit = {
  name: string
  caption: string
  dataUrl: string
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

export type AnalyzeResponse = {
  analysis: OutfitAnalysis
  match: MatchResult
}
