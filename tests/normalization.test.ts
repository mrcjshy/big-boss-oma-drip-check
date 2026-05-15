import { describe, it, expect } from 'vitest'
import { normalizeBbox, normalizeDeal, normalizeAnalysis, parseGeminiJson } from '../src/geminiService'
import type { GeminiPlatformDeal, GeminiAnalysis } from '../src/types'

describe('parseGeminiJson', () => {
  it('parses plain JSON', () => {
    const result = parseGeminiJson('{"vibe":"test"}')
    expect(result.vibe).toBe('test')
  })

  it('strips markdown json fences', () => {
    const result = parseGeminiJson('```json\n{"vibe":"test"}\n```')
    expect(result.vibe).toBe('test')
  })

  it('strips bare fences', () => {
    const result = parseGeminiJson('```\n{"vibe":"test"}\n```')
    expect(result.vibe).toBe('test')
  })

  it('throws on invalid JSON', () => {
    expect(() => parseGeminiJson('not json')).toThrow()
  })
})

describe('normalizeBbox', () => {
  it('returns null for non-array input', () => {
    expect(normalizeBbox('bad')).toBeNull()
  })

  it('returns null for wrong-length array', () => {
    expect(normalizeBbox([0, 0, 100])).toBeNull()
  })

  it('returns null for degenerate bbox (ymax <= ymin)', () => {
    expect(normalizeBbox([500, 200, 500, 600])).toBeNull()
    expect(normalizeBbox([600, 200, 500, 600])).toBeNull()
  })

  it('returns null for degenerate bbox (xmax <= xmin)', () => {
    expect(normalizeBbox([100, 500, 600, 500])).toBeNull()
  })

  it('returns null for tiny bbox (area < 5000)', () => {
    expect(normalizeBbox([100, 100, 110, 150])).toBeNull()
  })

  it('clamps values to 0–1000', () => {
    const result = normalizeBbox([-50, -10, 1200, 1100])
    expect(result).toEqual([0, 0, 1000, 1000])
  })

  it('returns valid bbox', () => {
    const result = normalizeBbox([100, 200, 500, 700])
    expect(result).toEqual([100, 200, 500, 700])
  })
})

describe('normalizeDeal', () => {
  it('returns null for unknown platform', () => {
    const deal: GeminiPlatformDeal = {
      platform: 'amazon' as 'shopee',
      query: 'test query',
      estimatedPricePhp: 100,
      reason: 'test',
    }
    expect(normalizeDeal(deal)).toBeNull()
  })

  it('returns null for empty query', () => {
    const deal: GeminiPlatformDeal = {
      platform: 'shopee',
      query: '',
      estimatedPricePhp: 100,
      reason: 'test',
    }
    expect(normalizeDeal(deal)).toBeNull()
  })

  it('returns null for invalid price', () => {
    const deal: GeminiPlatformDeal = {
      platform: 'shopee',
      query: 'test query',
      estimatedPricePhp: NaN,
      reason: 'test',
    }
    expect(normalizeDeal(deal)).toBeNull()
  })

  it('returns null for zero price', () => {
    const deal: GeminiPlatformDeal = {
      platform: 'shopee',
      query: 'test query',
      estimatedPricePhp: 0,
      reason: 'test',
    }
    expect(normalizeDeal(deal)).toBeNull()
  })

  it('normalizes a valid deal', () => {
    const deal: GeminiPlatformDeal = {
      platform: 'lazada',
      query: 'oversized tee black',
      estimatedPricePhp: 249.5,
      reason: 'Good deal',
    }
    const result = normalizeDeal(deal)
    expect(result).not.toBeNull()
    expect(result!.platform).toBe('lazada')
    expect(result!.estimatedPricePhp).toBe(250)
    expect(result!.url).toContain('lazada.com.ph')
  })
})

describe('normalizeAnalysis', () => {
  const validItem = {
    itemName: 'Test Tee',
    category: 'Top',
    color: 'Black',
    style: 'Casual',
    materialHint: 'Cotton',
    confidence: 0.85,
    budgetNote: 'Cheap',
    bestBuyReason: 'Best price',
    bbox: [100, 200, 500, 700] as [number, number, number, number],
    platforms: [
      { platform: 'shopee' as const, query: 'test tee', estimatedPricePhp: 199, reason: 'Good' },
    ],
  }

  const baseAnalysis: GeminiAnalysis = {
    vibe: 'Test vibe',
    summary: 'Test summary',
    estimatedTotalPhp: 500,
    tipidTip: 'Test tip',
    items: [validItem],
  }

  it('keeps valid items', () => {
    const result = normalizeAnalysis(baseAnalysis)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].itemName).toBe('Test Tee')
  })

  it('drops items with confidence below threshold', () => {
    const analysis: GeminiAnalysis = {
      ...baseAnalysis,
      items: [{ ...validItem, confidence: 0.05 }],
    }
    const result = normalizeAnalysis(analysis)
    expect(result.items).toHaveLength(0)
  })

  it('drops items with invalid bbox', () => {
    const analysis: GeminiAnalysis = {
      ...baseAnalysis,
      items: [{ ...validItem, bbox: [0, 0, 0, 0] as [number, number, number, number] }],
    }
    const result = normalizeAnalysis(analysis)
    expect(result.items).toHaveLength(0)
  })

  it('drops items with no valid deals', () => {
    const analysis: GeminiAnalysis = {
      ...baseAnalysis,
      items: [{
        ...validItem,
        platforms: [{ platform: 'unknown' as 'shopee', query: '', estimatedPricePhp: 0, reason: '' }],
      }],
    }
    const result = normalizeAnalysis(analysis)
    expect(result.items).toHaveLength(0)
  })

  it('selects cheapest platform as bestPlatform', () => {
    const analysis: GeminiAnalysis = {
      ...baseAnalysis,
      items: [{
        ...validItem,
        platforms: [
          { platform: 'shopee' as const, query: 'tee', estimatedPricePhp: 300, reason: 'A' },
          { platform: 'carousell' as const, query: 'tee ukay', estimatedPricePhp: 150, reason: 'B' },
          { platform: 'lazada' as const, query: 'tee sale', estimatedPricePhp: 280, reason: 'C' },
        ],
      }],
    }
    const result = normalizeAnalysis(analysis)
    expect(result.items[0].bestPlatform).toBe('carousell')
  })
})
