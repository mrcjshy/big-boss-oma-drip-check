import type { PlatformId, SampleOutfit } from './types'

export const GEMINI_MODEL = 'gemini-2.5-flash'

export const GEMINI_SYSTEM_PROMPT = `
You are Drip Check, a hyper-local Filipino fashion shopping agent for GDG Manila Build with AI 2026.

Act like an autonomous shopping assistant, not a passive image captioner. Analyze the uploaded outfit photo and return only valid JSON that follows the requested schema.

Your job:
1. Identify every visible clothing item and wearable accessory in the photo.
2. For each item, infer category, color, style, and a practical material hint.
3. Generate optimized Filipino shopping search queries for Shopee PH, Lazada PH, and Carousell/ukay-style resale.
4. Estimate realistic budget prices in Philippine pesos for a working student, favoring affordable alternatives over premium brands.
5. Compare the platforms per item and choose a Best Buy platform automatically.
6. Keep copy concise, practical, hype, and Taglish.

Local rules:
- Use Philippine fashion vocabulary when helpful: ukay, thrifted, pambahay, pang-campus, pang-date, oversized, coords, denim, linen, sneakers, sandals.
- Assume a budget-first shopper. Prefer search terms like "affordable", "sale", "korean style", "ukay", "preloved", "below 500" when relevant.
- Never invent exact live prices or claim real-time availability. Return estimated prices only.
- Make recommendations useful for Metro Manila / PH shoppers.
- If the image is unclear, still provide best-effort items with lower confidence.
`.trim()

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  carousell: 'Ukay / Carousell',
}

export const PLATFORM_ACCENTS: Record<PlatformId, string> = {
  shopee: '#ff6b35',
  lazada: '#7c3aed',
  carousell: '#22c55e',
}

export const buildPlatformUrl = (platform: PlatformId, query: string) => {
  const encoded = encodeURIComponent(query.trim())

  if (platform === 'shopee') {
    return `https://shopee.ph/search?keyword=${encoded}`
  }

  if (platform === 'lazada') {
    return `https://www.lazada.com.ph/catalog/?q=${encoded}`
  }

  return `https://www.carousell.ph/search/${encoded}/`
}

export const fallbackAnalysis = {
  vibe: 'Campus-ready tipid fit',
  summary:
    'Fallback demo mode: set VITE_GEMINI_API_KEY to let Gemini identify your real outfit.',
  estimatedTotalPhp: 980,
  tipidTip: 'Start sa ukay/preloved, then Shopee for basics na kailangan ng exact size.',
  items: [
    {
      itemName: 'Oversized graphic tee',
      category: 'Top',
      color: 'Black / neutral',
      style: 'Streetwear',
      materialHint: 'Cotton jersey',
      confidence: 0.74,
      budgetNote: 'Madaling hanapin under ₱250 sa Shopee or ukay racks.',
      bestBuyReason: 'Shopee wins for size filters and cheap bundles.',
      platforms: [
        {
          platform: 'shopee' as const,
          query: 'oversized graphic tee black affordable below 250',
          estimatedPricePhp: 199,
          reason: 'Best for new basics with size options.',
        },
        {
          platform: 'lazada' as const,
          query: 'oversized graphic shirt men women black sale philippines',
          estimatedPricePhp: 249,
          reason: 'Good sale backup if Shopee stock is thin.',
        },
        {
          platform: 'carousell' as const,
          query: 'preloved oversized graphic tee ukay black',
          estimatedPricePhp: 180,
          reason: 'Cheapest if you are okay with preloved.',
        },
      ],
    },
    {
      itemName: 'Straight-leg denim jeans',
      category: 'Bottom',
      color: 'Light blue',
      style: 'Casual',
      materialHint: 'Denim',
      confidence: 0.72,
      budgetNote: 'Ukay denim is usually the sulit move if you can check measurements.',
      bestBuyReason: 'Carousell/ukay wins because denim quality is better preloved.',
      platforms: [
        {
          platform: 'shopee' as const,
          query: 'straight leg denim jeans light blue affordable philippines',
          estimatedPricePhp: 399,
          reason: 'Reliable if you need return options.',
        },
        {
          platform: 'lazada' as const,
          query: 'women men straight jeans light blue sale',
          estimatedPricePhp: 450,
          reason: 'Good for vouchers during campaign days.',
        },
        {
          platform: 'carousell' as const,
          query: 'ukay straight leg jeans light wash denim',
          estimatedPricePhp: 280,
          reason: 'Best value for sturdy denim under student budget.',
        },
      ],
    },
  ],
}

type FlatLay = {
  bg: string
  ink: string
  accent: string
  top: string
  bottom: string
  shoe: string
  label: string
  meta: string
}

const sampleSvg = ({
  bg,
  ink,
  accent,
  top,
  bottom,
  shoe,
  label,
  meta,
}: FlatLay) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
      <rect width="900" height="1200" fill="${bg}" />
      <g opacity="0.18" stroke="${ink}" stroke-width="1">
        <line x1="0" y1="220" x2="900" y2="220" />
        <line x1="0" y1="600" x2="900" y2="600" />
        <line x1="0" y1="980" x2="900" y2="980" />
        <line x1="225" y1="0" x2="225" y2="1200" />
        <line x1="675" y1="0" x2="675" y2="1200" />
      </g>
      <rect x="60" y="60" width="780" height="80" rx="12" fill="${ink}" />
      <text x="92" y="115" fill="${bg}" font-family="Arial" font-size="44" font-weight="900" letter-spacing="-1">${label}</text>
      <rect x="280" y="200" width="340" height="320" rx="22" fill="${top}" />
      <path d="M280 200 L380 160 L520 160 L620 200 L600 240 L520 220 L380 220 L300 240 Z" fill="${top}" stroke="${ink}" stroke-width="3" opacity="0.9" />
      <rect x="320" y="220" width="260" height="280" rx="16" fill="none" stroke="${ink}" stroke-width="2" opacity="0.25" />
      <rect x="320" y="540" width="120" height="380" rx="18" fill="${bottom}" />
      <rect x="460" y="540" width="120" height="380" rx="18" fill="${bottom}" />
      <rect x="320" y="540" width="260" height="40" rx="8" fill="${ink}" opacity="0.25" />
      <ellipse cx="220" cy="980" rx="100" ry="42" fill="${shoe}" />
      <ellipse cx="220" cy="980" rx="100" ry="42" fill="none" stroke="${ink}" stroke-width="3" />
      <ellipse cx="680" cy="980" rx="100" ry="42" fill="${shoe}" />
      <ellipse cx="680" cy="980" rx="100" ry="42" fill="none" stroke="${ink}" stroke-width="3" />
      <circle cx="730" cy="320" r="60" fill="${accent}" />
      <circle cx="730" cy="320" r="36" fill="${bg}" />
      <circle cx="730" cy="320" r="20" fill="${ink}" />
      <rect x="60" y="1080" width="780" height="80" rx="12" fill="${accent}" />
      <text x="90" y="1135" fill="${ink}" font-family="Arial" font-size="34" font-weight="900" letter-spacing="-1">${meta}</text>
    </svg>
  `)}`

export const SAMPLE_OUTFITS: SampleOutfit[] = [
  {
    name: 'Campus Street',
    caption: 'Oversized tee + denim pang-commute',
    dataUrl: sampleSvg({
      bg: '#f4efe2',
      ink: '#0a0a0a',
      accent: '#ff4d2e',
      top: '#1f2937',
      bottom: '#3b82f6',
      shoe: '#fafaf9',
      label: 'CAMPUS STREET',
      meta: 'TEE · DENIM · CHUNKY SNEAKERS',
    }),
  },
  {
    name: 'Cafe Date',
    caption: 'Earth-tone top + relaxed trousers',
    dataUrl: sampleSvg({
      bg: '#f4efe2',
      ink: '#0a0a0a',
      accent: '#c4f53c',
      top: '#fde68a',
      bottom: '#7c2d12',
      shoe: '#1f2937',
      label: 'CAFE DATE',
      meta: 'KNIT TOP · TROUSERS · LOAFERS',
    }),
  },
]
