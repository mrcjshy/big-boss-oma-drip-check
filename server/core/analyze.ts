/**
 * Shared analyze pipeline. Express and the Vercel serverless function both
 * call `runAnalysis(...)` so the response shape is identical across
 * environments and there is exactly one place to change behaviour.
 *
 * Pure with respect to its inputs — caller owns request parsing and any
 * env-var checks before invoking.
 */

import { config } from '../config'
import { callGeminiVision } from '../gemini'
import { retrieveTopK } from '../matching/retriever'
import { rerankCandidates } from '../matching/reranker'
import { applyConfidenceGate } from '../matching/decision'
import type { MatchResult } from '../matching/types'
import { EXTRACTION_PROMPT, EXTRACTION_SCHEMA, EXTRACTION_USER_PROMPT } from './prompts'
import { buildFullAnalysis, hardenItems, type RawGeminiAnalysis } from './normalize'

export type AnalyzeInput = {
  base64Image: string
  mimeType: string
}

export type AnalyzeResult = {
  analysis: ReturnType<typeof buildFullAnalysis>
  match: MatchResult
}

/**
 * Strip ```json fences that Gemini sometimes emits even when responseMime
 * is application/json. Belt-and-braces — safe to run on already-clean JSON.
 */
const stripCodeFences = (text: string): string =>
  text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

export const runAnalysis = async (input: AnalyzeInput): Promise<AnalyzeResult> => {
  const rawText = await callGeminiVision(
    input.base64Image,
    input.mimeType,
    EXTRACTION_PROMPT,
    EXTRACTION_USER_PROMPT,
    EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
  )

  const parsed = JSON.parse(stripCodeFences(rawText)) as RawGeminiAnalysis
  const analysis = buildFullAnalysis(parsed)
  const hardenedItems = hardenItems(parsed)

  const topK = await retrieveTopK(hardenedItems, config.thresholds.topK)
  const ranked = rerankCandidates(hardenedItems, topK)
  const match = applyConfidenceGate(ranked)

  return { analysis, match }
}
