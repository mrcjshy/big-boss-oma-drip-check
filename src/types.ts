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
