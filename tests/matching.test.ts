import { describe, it, expect } from 'vitest'
import { buildLookFeatureText, buildQueryFeatureText, extractItemFeatures } from '../server/matching/featureBuilder'
import { rerankCandidates, fuzzyMatch } from '../server/matching/reranker'
import { applyConfidenceGate } from '../server/matching/decision'
import type { LookbookEntry } from '../server/catalog/schema'
import type { ParsedItem, IndexedLook, MatchCandidate } from '../server/matching/types'

const sampleLook: LookbookEntry = {
  lookId: 'look-001',
  name: 'Campus Street',
  tags: ['streetwear', 'casual'],
  items: [
    { itemName: 'Oversized graphic tee', category: 'Top', color: 'Black', style: 'Streetwear', materialHint: 'Cotton' },
    { itemName: 'Straight-leg jeans', category: 'Bottom', color: 'Light blue', style: 'Casual', materialHint: 'Denim' },
  ],
  imagePath: 'lookbook/look-001.jpg',
}

const sampleQueryItems: ParsedItem[] = [
  { itemName: 'Black oversized tee', category: 'Top', color: 'Black', style: 'Streetwear', materialHint: 'Cotton', confidence: 0.9, bbox: null },
  { itemName: 'Light wash straight jeans', category: 'Bottom', color: 'Light blue', style: 'Casual', materialHint: 'Denim', confidence: 0.85, bbox: null },
]

describe('featureBuilder', () => {
  describe('buildLookFeatureText', () => {
    it('produces a non-empty description', () => {
      const text = buildLookFeatureText(sampleLook)
      expect(text).toContain('Campus Street')
      expect(text).toContain('Top')
      expect(text).toContain('Black')
    })
  })

  describe('buildQueryFeatureText', () => {
    it('produces text from query items', () => {
      const text = buildQueryFeatureText(sampleQueryItems)
      expect(text).toContain('Top')
      expect(text).toContain('Black')
    })

    it('filters out low-confidence items', () => {
      const items: ParsedItem[] = [
        { itemName: 'Low conf item', category: 'Top', color: 'Red', style: 'Casual', materialHint: 'Cotton', confidence: 0.1, bbox: null },
      ]
      const text = buildQueryFeatureText(items)
      expect(text).toBe('')
    })
  })

  describe('extractItemFeatures', () => {
    it('lowercases and trims', () => {
      const features = extractItemFeatures({
        itemName: ' Test Item ',
        category: ' Top ',
        color: ' BLACK ',
        style: ' Casual ',
        materialHint: ' Cotton ',
        confidence: 0.9,
        bbox: null,
      })
      expect(features.category).toBe('top')
      expect(features.color).toBe('black')
      expect(features.name).toBe('test item')
    })
  })
})

describe('reranker', () => {
  describe('fuzzyMatch', () => {
    it('returns 1 for exact match', () => {
      expect(fuzzyMatch('black', 'black')).toBe(1)
    })

    it('returns 0.8 for substring match', () => {
      expect(fuzzyMatch('light blue', 'blue')).toBe(0.8)
    })

    it('returns word overlap for partial matches', () => {
      const score = fuzzyMatch('dark navy blue', 'navy blue tone')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(1)
    })

    it('returns 0 for empty strings', () => {
      expect(fuzzyMatch('', 'test')).toBe(0)
      expect(fuzzyMatch('test', '')).toBe(0)
    })
  })

  describe('rerankCandidates', () => {
    it('produces scored candidates sorted by matchScore', () => {
      const indexedLook1: IndexedLook = { entry: sampleLook, embedding: [1, 0, 0] }
      const indexedLook2: IndexedLook = {
        entry: { ...sampleLook, lookId: 'look-999', name: 'Totally Different' },
        embedding: [0, 1, 0],
      }

      const candidates = [
        { look: indexedLook1, vectorScore: 0.95 },
        { look: indexedLook2, vectorScore: 0.4 },
      ]

      const ranked = rerankCandidates(sampleQueryItems, candidates)
      expect(ranked).toHaveLength(2)
      expect(ranked[0].matchScore).toBeGreaterThanOrEqual(ranked[1].matchScore)
      expect(ranked[0].lookId).toBe('look-001')
    })

    it('returns explanations array', () => {
      const indexedLook: IndexedLook = { entry: sampleLook, embedding: [1, 0, 0] }
      const ranked = rerankCandidates(sampleQueryItems, [{ look: indexedLook, vectorScore: 0.9 }])
      expect(ranked[0].explanations).toBeInstanceOf(Array)
    })
  })
})

describe('decision gate', () => {
  it('returns low confidence for empty candidates', () => {
    const result = applyConfidenceGate([])
    expect(result.isLowConfidence).toBe(true)
    expect(result.confidenceLevel).toBe('low')
    expect(result.topMatch).toBeNull()
  })

  it('returns high confidence for strong match', () => {
    const candidates: MatchCandidate[] = [{
      lookId: 'look-001',
      lookName: 'Campus Street',
      matchScore: 0.90,
      vectorScore: 0.92,
      attributeScore: 0.88,
      explanations: ['Strong match'],
    }]
    const result = applyConfidenceGate(candidates)
    expect(result.confidenceLevel).toBe('high')
    expect(result.isLowConfidence).toBe(false)
    expect(result.candidates).toHaveLength(1)
  })

  it('returns medium confidence and top-3 for moderate match', () => {
    const candidates: MatchCandidate[] = [
      { lookId: 'a', lookName: 'A', matchScore: 0.70, vectorScore: 0.7, attributeScore: 0.7, explanations: [] },
      { lookId: 'b', lookName: 'B', matchScore: 0.65, vectorScore: 0.6, attributeScore: 0.7, explanations: [] },
      { lookId: 'c', lookName: 'C', matchScore: 0.60, vectorScore: 0.6, attributeScore: 0.6, explanations: [] },
      { lookId: 'd', lookName: 'D', matchScore: 0.40, vectorScore: 0.4, attributeScore: 0.4, explanations: [] },
    ]
    const result = applyConfidenceGate(candidates)
    expect(result.confidenceLevel).toBe('medium')
    expect(result.candidates).toHaveLength(3)
  })

  it('returns low confidence for weak match', () => {
    const candidates: MatchCandidate[] = [{
      lookId: 'look-001',
      lookName: 'Test',
      matchScore: 0.30,
      vectorScore: 0.3,
      attributeScore: 0.3,
      explanations: ['Weak match'],
    }]
    const result = applyConfidenceGate(candidates)
    expect(result.confidenceLevel).toBe('low')
    expect(result.isLowConfidence).toBe(true)
  })
})
