import { describe, it, expect } from 'vitest'
import { rerankCandidates } from '../server/matching/reranker'
import { applyConfidenceGate } from '../server/matching/decision'
import type { IndexedLook, ParsedItem } from '../server/matching/types'
import type { LookbookEntry } from '../server/catalog/schema'

const lookbook: LookbookEntry[] = [
  {
    lookId: 'look-001',
    name: 'Campus Street',
    tags: ['streetwear', 'casual'],
    items: [
      { itemName: 'Oversized graphic tee', category: 'Top', color: 'Black', style: 'Streetwear', materialHint: 'Cotton jersey' },
      { itemName: 'Straight-leg denim jeans', category: 'Bottom', color: 'Light blue', style: 'Casual', materialHint: 'Denim' },
      { itemName: 'Chunky sneakers', category: 'Footwear', color: 'White', style: 'Streetwear', materialHint: 'Synthetic leather' },
    ],
    imagePath: 'lookbook/look-001.jpg',
  },
  {
    lookId: 'look-002',
    name: 'Cafe Date',
    tags: ['smart casual', 'date'],
    items: [
      { itemName: 'Knit crop top', category: 'Top', color: 'Cream / beige', style: 'Smart Casual', materialHint: 'Knit cotton' },
      { itemName: 'Wide-leg trousers', category: 'Bottom', color: 'Brown', style: 'Smart Casual', materialHint: 'Linen blend' },
      { itemName: 'Loafers', category: 'Footwear', color: 'Dark brown', style: 'Smart Casual', materialHint: 'Faux leather' },
    ],
    imagePath: 'lookbook/look-002.jpg',
  },
  {
    lookId: 'look-005',
    name: 'Weekend Chill',
    tags: ['casual', 'weekend'],
    items: [
      { itemName: 'Oversized hoodie', category: 'Outerwear', color: 'Gray', style: 'Casual', materialHint: 'Fleece cotton' },
      { itemName: 'Jogger pants', category: 'Bottom', color: 'Black', style: 'Athleisure', materialHint: 'French terry' },
      { itemName: 'Slides', category: 'Footwear', color: 'Black', style: 'Casual', materialHint: 'Rubber / EVA' },
    ],
    imagePath: 'lookbook/look-005.jpg',
  },
]

function fakeIndex(entries: LookbookEntry[]): IndexedLook[] {
  return entries.map(entry => ({ entry, embedding: [] }))
}

function runMatching(
  queryItems: ParsedItem[],
  indexed: IndexedLook[],
  fakeVectorScores: Map<string, number>,
) {
  const candidates = indexed.map(look => ({
    look,
    vectorScore: fakeVectorScores.get(look.entry.lookId) ?? 0.5,
  }))
  const ranked = rerankCandidates(queryItems, candidates)
  return applyConfidenceGate(ranked)
}

describe('golden cases — attribute reranking', () => {
  const indexed = fakeIndex(lookbook)

  it('ranks Campus Street first for matching streetwear query', () => {
    const queryItems: ParsedItem[] = [
      { itemName: 'Black graphic tee oversized', category: 'Top', color: 'Black', style: 'Streetwear', materialHint: 'Cotton', confidence: 0.9, bbox: null },
      { itemName: 'Straight leg light jeans', category: 'Bottom', color: 'Light blue', style: 'Casual', materialHint: 'Denim', confidence: 0.85, bbox: null },
      { itemName: 'White chunky sneakers', category: 'Footwear', color: 'White', style: 'Streetwear', materialHint: 'Synthetic', confidence: 0.80, bbox: null },
    ]

    const vectorScores = new Map([
      ['look-001', 0.90],
      ['look-002', 0.50],
      ['look-005', 0.55],
    ])

    const result = runMatching(queryItems, indexed, vectorScores)
    expect(result.topMatch?.lookId).toBe('look-001')
  })

  it('ranks Cafe Date first for smart casual query', () => {
    const queryItems: ParsedItem[] = [
      { itemName: 'Cream knit top', category: 'Top', color: 'Cream', style: 'Smart Casual', materialHint: 'Knit', confidence: 0.88, bbox: null },
      { itemName: 'Brown wide trousers', category: 'Bottom', color: 'Brown', style: 'Smart Casual', materialHint: 'Linen', confidence: 0.84, bbox: null },
      { itemName: 'Dark brown loafers', category: 'Footwear', color: 'Dark brown', style: 'Smart Casual', materialHint: 'Leather', confidence: 0.80, bbox: null },
    ]

    const vectorScores = new Map([
      ['look-001', 0.45],
      ['look-002', 0.88],
      ['look-005', 0.40],
    ])

    const result = runMatching(queryItems, indexed, vectorScores)
    expect(result.topMatch?.lookId).toBe('look-002')
  })

  it('returns low confidence for a distractor not in lookbook', () => {
    const queryItems: ParsedItem[] = [
      { itemName: 'Leather jacket', category: 'Outerwear', color: 'Black', style: 'Rock', materialHint: 'Leather', confidence: 0.90, bbox: null },
      { itemName: 'Ripped skinny jeans', category: 'Bottom', color: 'Dark blue', style: 'Rock', materialHint: 'Denim', confidence: 0.85, bbox: null },
      { itemName: 'Combat boots', category: 'Footwear', color: 'Black', style: 'Rock', materialHint: 'Leather', confidence: 0.88, bbox: null },
    ]

    const vectorScores = new Map([
      ['look-001', 0.30],
      ['look-002', 0.25],
      ['look-005', 0.35],
    ])

    const result = runMatching(queryItems, indexed, vectorScores)
    expect(result.isLowConfidence).toBe(true)
  })

  it('Weekend Chill ranks first for athleisure query', () => {
    const queryItems: ParsedItem[] = [
      { itemName: 'Gray hoodie oversized', category: 'Outerwear', color: 'Gray', style: 'Casual', materialHint: 'Fleece', confidence: 0.89, bbox: null },
      { itemName: 'Black jogger pants', category: 'Bottom', color: 'Black', style: 'Athleisure', materialHint: 'Terry', confidence: 0.87, bbox: null },
      { itemName: 'Black slides', category: 'Footwear', color: 'Black', style: 'Casual', materialHint: 'Rubber', confidence: 0.80, bbox: null },
    ]

    const vectorScores = new Map([
      ['look-001', 0.40],
      ['look-002', 0.35],
      ['look-005', 0.88],
    ])

    const result = runMatching(queryItems, indexed, vectorScores)
    expect(result.topMatch?.lookId).toBe('look-005')
  })
})
