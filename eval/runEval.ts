import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { buildIndex } from '../server/catalog/indexer'
import { retrieveTopK } from '../server/matching/retriever'
import { rerankCandidates } from '../server/matching/reranker'
import { applyConfidenceGate } from '../server/matching/decision'
import type { ParsedItem } from '../server/matching/types'
import { config } from '../server/config'

type EvalEntry = {
  id: string
  expectedLookId: string | null
  note?: string
  items: (ParsedItem & { confidence: number })[]
}

type EvalDataset = {
  description: string
  entries: EvalEntry[]
}

type EvalResult = {
  entryId: string
  expectedLookId: string | null
  predictedLookId: string | null
  matchScore: number
  confidenceLevel: string
  correct: boolean
  trueNegative: boolean
  falsePositive: boolean
}

async function runEval(datasetPath: string) {
  console.log(`\n=== Drip Check Eval Runner ===`)
  console.log(`Dataset: ${datasetPath}`)
  console.log(`Thresholds: autoAccept=${config.thresholds.autoAccept}, showTop3=${config.thresholds.showTop3}`)
  console.log()

  console.log('Building lookbook index...')
  await buildIndex()

  const raw = await fs.readFile(datasetPath, 'utf-8')
  const dataset = JSON.parse(raw) as EvalDataset
  console.log(`Loaded ${dataset.entries.length} eval entries\n`)

  const results: EvalResult[] = []

  for (const entry of dataset.entries) {
    const items: ParsedItem[] = entry.items.map(i => ({
      ...i,
      bbox: null,
    }))

    const topK = await retrieveTopK(items, config.thresholds.topK)
    const ranked = rerankCandidates(items, topK)
    const matchResult = applyConfidenceGate(ranked)

    const predictedLookId = matchResult.isLowConfidence
      ? null
      : matchResult.topMatch?.lookId ?? null
    const matchScore = matchResult.topMatch?.matchScore ?? 0

    const isDistractor = entry.expectedLookId === null
    const correct = isDistractor
      ? predictedLookId === null
      : predictedLookId === entry.expectedLookId
    const trueNegative = isDistractor && predictedLookId === null
    const falsePositive = isDistractor && predictedLookId !== null

    results.push({
      entryId: entry.id,
      expectedLookId: entry.expectedLookId,
      predictedLookId,
      matchScore,
      confidenceLevel: matchResult.confidenceLevel,
      correct,
      trueNegative,
      falsePositive,
    })

    const status = correct ? 'PASS' : 'FAIL'
    console.log(
      `  [${status}] ${entry.id}: expected=${entry.expectedLookId ?? 'none'} ` +
      `predicted=${predictedLookId ?? 'none'} score=${matchScore.toFixed(3)} ` +
      `confidence=${matchResult.confidenceLevel}`,
    )
  }

  console.log('\n=== Metrics ===')

  const total = results.length
  const correctCount = results.filter(r => r.correct).length
  const top1Accuracy = correctCount / total

  const positiveEntries = results.filter(r => r.expectedLookId !== null)
  const top1Positives = positiveEntries.filter(r => r.correct).length
  const top1PositiveAccuracy = positiveEntries.length > 0
    ? top1Positives / positiveEntries.length
    : 0

  const distractors = results.filter(r => r.expectedLookId === null)
  const falsePositives = distractors.filter(r => r.falsePositive).length
  const fpr = distractors.length > 0
    ? falsePositives / distractors.length
    : 0

  const trueNegatives = distractors.filter(r => r.trueNegative).length

  console.log(`  Total entries:         ${total}`)
  console.log(`  Overall accuracy:      ${(top1Accuracy * 100).toFixed(1)}%  (${correctCount}/${total})`)
  console.log(`  Top-1 positive acc:    ${(top1PositiveAccuracy * 100).toFixed(1)}%  (${top1Positives}/${positiveEntries.length})`)
  console.log(`  False positive rate:   ${(fpr * 100).toFixed(1)}%  (${falsePositives}/${distractors.length})`)
  console.log(`  True negatives:        ${trueNegatives}/${distractors.length}`)

  const highConf = results.filter(r => r.confidenceLevel === 'high')
  const highCorrect = highConf.filter(r => r.correct).length
  const highCalibration = highConf.length > 0
    ? highCorrect / highConf.length
    : 0
  console.log(`  High-confidence calib: ${(highCalibration * 100).toFixed(1)}%  (${highCorrect}/${highConf.length} high-conf predictions correct)`)

  console.log('\n=== Done ===\n')

  return { top1Accuracy, top1PositiveAccuracy, fpr, highCalibration, results }
}

const datasetArg = process.argv[2]
if (!datasetArg) {
  console.error('Usage: npx tsx eval/runEval.ts <dataset-path>')
  console.error('  e.g. npx tsx eval/runEval.ts eval/datasets/lookbook-dev.json')
  process.exit(1)
}

runEval(path.resolve(process.cwd(), datasetArg)).catch(err => {
  console.error('Eval failed:', err)
  process.exit(1)
})
