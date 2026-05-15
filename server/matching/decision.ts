import type { MatchCandidate, MatchResult, ConfidenceLevel } from './types'
import { config } from '../config'

export function applyConfidenceGate(candidates: MatchCandidate[]): MatchResult {
  const { autoAccept, showTop3 } = config.thresholds

  if (candidates.length === 0) {
    return {
      topMatch: null,
      candidates: [],
      isLowConfidence: true,
      confidenceLevel: 'low',
    }
  }

  const top = candidates[0]
  let confidenceLevel: ConfidenceLevel

  if (top.matchScore >= autoAccept) {
    confidenceLevel = 'high'
  } else if (top.matchScore >= showTop3) {
    confidenceLevel = 'medium'
  } else {
    confidenceLevel = 'low'
  }

  const visibleCandidates =
    confidenceLevel === 'high' ? [top] : candidates.slice(0, 3)

  return {
    topMatch: top,
    candidates: visibleCandidates,
    isLowConfidence: confidenceLevel === 'low',
    confidenceLevel,
  }
}
