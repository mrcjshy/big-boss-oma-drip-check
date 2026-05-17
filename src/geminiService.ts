import {
  buildPlatformUrl,
  fallbackAnalysis,
} from './constants'
import type {
  ClothingItem,
  GeminiAnalysis,
  GeminiPlatformDeal,
  OutfitAnalysis,
  PlatformDeal,
  PlatformId,
} from './types'
import {
  AllProvidersFailedError,
  runFallbackChain,
} from './utils/llmFallbackChain'
import type { ProviderLabel } from './utils/providers/shared'

const isPlatformId = (platform: string): platform is PlatformId =>
  platform === 'shopee' || platform === 'lazada' || platform === 'carousell'

const normalizeDeal = (deal: GeminiPlatformDeal): PlatformDeal => {
  const platform = isPlatformId(deal.platform) ? deal.platform : 'shopee'
  const query = deal.query?.trim() || 'affordable outfit philippines'

  return {
    platform,
    query,
    url: buildPlatformUrl(platform, query),
    estimatedPricePhp: Math.max(1, Math.round(Number(deal.estimatedPricePhp) || 999)),
    reason: deal.reason || 'Sulit option for this item.',
  }
}

const SENTINEL_BBOX: ClothingItem['bbox'] = [0, 0, 1000, 1000]

const normalizeBbox = (
  bbox: GeminiAnalysis['items'][number]['bbox'] | undefined,
  item: GeminiAnalysis['items'][number],
): ClothingItem['bbox'] | null => {
  if (!Array.isArray(bbox)) {
    return SENTINEL_BBOX
  }

  if (bbox.length !== 4) {
    console.warn('Skipping clothing item with malformed bbox.', item)
    return null
  }

  const normalized = bbox.map((coord) => {
    const numericCoord = Number(coord)
    const safeCoord = Number.isFinite(numericCoord) ? numericCoord : 0
    return Math.round(Math.min(1000, Math.max(0, safeCoord)))
  }) as ClothingItem['bbox']
  const [ymin, xmin, ymax, xmax] = normalized

  if (ymax <= ymin || xmax <= xmin) {
    console.warn('Skipping clothing item with invalid bbox.', item)
    return null
  }

  return normalized
}

const normalizeAnalysis = (analysis: GeminiAnalysis): OutfitAnalysis => {
  const items: ClothingItem[] = analysis.items.flatMap((item, index) => {
    const bbox = normalizeBbox(item.bbox, item)

    if (!bbox) {
      return []
    }

    const platforms = (item.platforms ?? []).map(normalizeDeal)

    if (platforms.length === 0) {
      console.warn('Skipping clothing item without platforms.', item)
      return []
    }

    const bestDeal = [...platforms].sort(
      (a, b) => a.estimatedPricePhp - b.estimatedPricePhp,
    )[0]

    return {
      id: `${item.category}-${index}`,
      itemName: item.itemName,
      bbox,
      category: item.category,
      color: item.color,
      style: item.style,
      materialHint: item.materialHint,
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      budgetNote: item.budgetNote,
      platforms,
      bestPlatform: bestDeal.platform,
      bestBuyReason: item.bestBuyReason,
    }
  })

  return {
    vibe: analysis.vibe,
    summary: analysis.summary,
    estimatedTotalPhp: Math.round(Number(analysis.estimatedTotalPhp) || 0),
    tipidTip: analysis.tipidTip,
    items,
  }
}

export type AnalyzeOutfitResult = {
  analysis: OutfitAnalysis
  provider: ProviderLabel
}

export const DEMO_PROVIDER_LABEL: ProviderLabel = {
  id: 'demo',
  shortName: 'Safe demo output',
  pillLabel: 'Showing safe demo output',
}

export const getDemoAnalysis = (): OutfitAnalysis => normalizeAnalysis(fallbackAnalysis)

export const analyzeOutfit = async (file: File): Promise<AnalyzeOutfitResult> => {
  try {
    const { analysis, label } = await runFallbackChain(file)
    return {
      analysis: normalizeAnalysis(analysis),
      provider: label,
    }
  } catch (caughtError) {
    if (caughtError instanceof AllProvidersFailedError) {
      throw caughtError
    }
    throw caughtError instanceof Error
      ? caughtError
      : new Error('Unknown analysis error.')
  }
}
