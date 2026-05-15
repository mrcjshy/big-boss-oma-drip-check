/**
 * Normalization helpers that convert raw Gemini JSON into the wire-format
 * the client expects (`OutfitAnalysis` + `ParsedItem`). Pure functions: no
 * I/O, no shared mutable state.
 */

import { normalizeBbox } from '../../shared/bbox'
import type { ParsedItem } from '../matching/types'

export type PlatformId = 'shopee' | 'lazada' | 'carousell'

export type RawGeminiPlatform = {
  platform: string
  query: string
  estimatedPricePhp: number
  reason: string
}

export type RawGeminiItem = {
  itemName: string
  category: string
  color: string
  style: string
  materialHint: string
  confidence: number
  budgetNote: string
  bestBuyReason: string
  bbox: unknown
  platforms: RawGeminiPlatform[]
}

export type RawGeminiAnalysis = {
  vibe: string
  summary: string
  estimatedTotalPhp: number
  tipidTip: string
  items: RawGeminiItem[]
}

const MIN_CONFIDENCE = 0.15

const isPlatformId = (p: string): p is PlatformId =>
  p === 'shopee' || p === 'lazada' || p === 'carousell'

export const buildPlatformUrl = (platform: PlatformId, query: string): string => {
  const encoded = encodeURIComponent(query.trim())
  if (platform === 'shopee') return `https://shopee.ph/search?keyword=${encoded}`
  if (platform === 'lazada') return `https://www.lazada.com.ph/catalog/?q=${encoded}`
  return `https://www.carousell.ph/search/${encoded}/`
}

/**
 * Reduce raw Gemini output into the lightweight `ParsedItem[]` used by the
 * matching pipeline. Drops low-confidence detections.
 */
export const hardenItems = (raw: RawGeminiAnalysis): ParsedItem[] =>
  raw.items
    .filter(item => (Number(item.confidence) || 0) >= MIN_CONFIDENCE)
    .map(item => ({
      itemName: item.itemName,
      category: item.category,
      color: item.color,
      style: item.style,
      materialHint: item.materialHint,
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
      bbox: normalizeBbox(item.bbox),
    }))

/**
 * Build the full client-facing analysis object: same shape the legacy
 * Express endpoint emitted. Items missing a usable bbox or any valid
 * platform deal are filtered out (the client renders hotspots, so an item
 * with no bbox is useless).
 */
export const buildFullAnalysis = (raw: RawGeminiAnalysis) => {
  const items = raw.items
    .filter(item => Number(item.confidence) >= MIN_CONFIDENCE)
    .flatMap((item, index) => {
      const bbox = normalizeBbox(item.bbox)
      if (!bbox) return []

      const validDeals = item.platforms.flatMap(deal => {
        if (!isPlatformId(deal.platform)) return []
        const query = deal.query?.trim()
        if (!query) return []
        const price = Number(deal.estimatedPricePhp)
        if (!Number.isFinite(price) || price <= 0) return []
        return [{
          platform: deal.platform,
          query,
          url: buildPlatformUrl(deal.platform, query),
          estimatedPricePhp: Math.round(price),
          reason: deal.reason || 'Sulit option for this item.',
        }]
      })

      if (validDeals.length === 0) return []

      const bestDeal = [...validDeals].sort(
        (a, b) => a.estimatedPricePhp - b.estimatedPricePhp,
      )[0]

      return [{
        id: `${item.category}-${index}`,
        itemName: item.itemName,
        category: item.category,
        color: item.color,
        style: item.style,
        materialHint: item.materialHint,
        confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
        budgetNote: item.budgetNote,
        platforms: validDeals,
        bestPlatform: bestDeal.platform,
        bestBuyReason: item.bestBuyReason,
        bbox,
      }]
    })

  return {
    vibe: raw.vibe,
    summary: raw.summary,
    estimatedTotalPhp: Math.round(Number(raw.estimatedTotalPhp) || 0),
    tipidTip: raw.tipidTip,
    items,
  }
}
