import type { ParsedItem, MatchCandidate, IndexedLook } from './types'
import { extractItemFeatures } from './featureBuilder'

function fuzzyMatch(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.8

  const wordsA = new Set(a.split(/\s+/))
  const wordsB = new Set(b.split(/\s+/))
  const intersection = [...wordsA].filter(w => wordsB.has(w))
  const union = new Set([...wordsA, ...wordsB])
  return union.size > 0 ? intersection.length / union.size : 0
}

function computeAttributeScore(
  queryItems: ParsedItem[],
  look: IndexedLook,
): { score: number; explanations: string[] } {
  const lookItems = look.entry.items
  const explanations: string[] = []

  const queryCategories = new Set(queryItems.map(i => i.category.toLowerCase().trim()))
  const lookCategories = new Set(lookItems.map(i => i.category.toLowerCase().trim()))
  const catIntersection = [...queryCategories].filter(c => lookCategories.has(c))
  const catUnion = new Set([...queryCategories, ...lookCategories])
  const categoryScore = catUnion.size > 0 ? catIntersection.length / catUnion.size : 0

  if (categoryScore >= 0.8) {
    explanations.push(`Strong category overlap: ${catIntersection.join(', ')}`)
  } else if (categoryScore < 0.4) {
    explanations.push('Weak category overlap')
  }

  const countDiff = Math.abs(queryItems.length - lookItems.length)
  const maxCount = Math.max(queryItems.length, lookItems.length, 1)
  const countScore = 1 - countDiff / maxCount

  if (countDiff > 0) {
    explanations.push(`Item count differs by ${countDiff}`)
  }

  let pairScoreSum = 0
  let pairCount = 0

  for (const qi of queryItems) {
    const qf = extractItemFeatures(qi)
    let bestPairScore = 0

    for (const li of lookItems) {
      const lf = extractItemFeatures(li)
      const catMatch = qf.category === lf.category ? 1 : 0
      const colorMatch = fuzzyMatch(qf.color, lf.color)
      const styleMatch = fuzzyMatch(qf.style, lf.style)
      const materialMatch = fuzzyMatch(qf.material, lf.material)
      const pairScore = catMatch * 0.35 + colorMatch * 0.3 + styleMatch * 0.2 + materialMatch * 0.15
      bestPairScore = Math.max(bestPairScore, pairScore)
    }

    pairScoreSum += bestPairScore
    pairCount++
  }

  const pairScore = pairCount > 0 ? pairScoreSum / pairCount : 0

  if (pairScore >= 0.7) {
    explanations.push('Strong attribute agreement across items')
  } else if (pairScore < 0.4) {
    explanations.push('Weak attribute agreement')
  }

  const score = categoryScore * 0.25 + countScore * 0.15 + pairScore * 0.6
  return { score, explanations }
}

export function rerankCandidates(
  queryItems: ParsedItem[],
  candidates: { look: IndexedLook; vectorScore: number }[],
): MatchCandidate[] {
  return candidates
    .map(({ look, vectorScore }) => {
      const { score: attributeScore, explanations } = computeAttributeScore(queryItems, look)
      const matchScore = vectorScore * 0.55 + attributeScore * 0.45

      return {
        lookId: look.entry.lookId,
        lookName: look.entry.name,
        matchScore,
        vectorScore,
        attributeScore,
        explanations,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
}

export { fuzzyMatch, computeAttributeScore }
