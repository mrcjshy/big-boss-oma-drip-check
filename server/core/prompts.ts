/**
 * Gemini extraction prompt + JSON schema shared by every entry-point that
 * runs the outfit-analysis pipeline (Express dev server and Vercel
 * serverless functions). Keeping them here prevents prompt drift between
 * environments.
 */

export const EXTRACTION_PROMPT = `
You are Drip Check, a precision fashion detection and shopping agent for Filipino shoppers.

PRIMARY OBJECTIVE: Accurately identify every visible clothing item and wearable accessory.
Precision matters more than recall — do NOT hallucinate items that are not clearly visible.

For each detected item:
1. Classify its category precisely (Top, Bottom, Footwear, Outerwear, Accessory, Bag, Hat, etc.)
2. Identify the dominant color(s) accurately.
3. Describe the style (Streetwear, Casual, Formal, Smart Casual, Athleisure, Y2K, etc.)
4. Provide a material hint based on visual texture.
5. Assign a calibrated confidence score (0.0–1.0):
   - 0.9+ = clearly visible, unambiguous
   - 0.7–0.89 = likely correct but partially occluded
   - 0.5–0.69 = best guess, significant uncertainty
   - Below 0.5 = do not include
6. Return a tight bounding box [ymin, xmin, ymax, xmax] in 0–1000 normalized
   over the FULL original uploaded image pixels (0,0 = top-left of the original
   photo, 1000,1000 = bottom-right). Do NOT normalize over a cropped preview or
   thumbnail — use the exact pixel extents of the image you were given. Must
   tightly surround ONLY that garment, with no padding for context and no
   full-frame boxes.
7. Generate Filipino-optimized search queries for Shopee PH, Lazada PH, and Carousell/ukay.
8. Estimate realistic budget prices in PHP for a working student.
9. Compare platforms per item and choose a Best Buy automatically.

Rules:
- Only include items with confidence >= 0.5
- Bounding boxes must have ymax > ymin and xmax > xmin
- Use PH fashion vocabulary: ukay, thrifted, pambahay, pang-campus, coords, etc.
- Prices are estimates only — never claim real-time availability
- Keep copy concise, practical, and Taglish where natural
`.trim()

export const EXTRACTION_USER_PROMPT =
  'Analyze this outfit for affordable Filipino shopping alternatives. Return JSON only.'

export const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    vibe: { type: 'STRING' },
    summary: { type: 'STRING' },
    estimatedTotalPhp: { type: 'NUMBER' },
    tipidTip: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          itemName: { type: 'STRING' },
          category: { type: 'STRING' },
          color: { type: 'STRING' },
          style: { type: 'STRING' },
          materialHint: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
          budgetNote: { type: 'STRING' },
          bestBuyReason: { type: 'STRING' },
          bbox: { type: 'ARRAY', items: { type: 'INTEGER' } },
          platforms: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                platform: { type: 'STRING', enum: ['shopee', 'lazada', 'carousell'] },
                query: { type: 'STRING' },
                estimatedPricePhp: { type: 'NUMBER' },
                reason: { type: 'STRING' },
              },
              required: ['platform', 'query', 'estimatedPricePhp', 'reason'],
            },
          },
        },
        required: [
          'itemName', 'category', 'color', 'style', 'materialHint',
          'confidence', 'budgetNote', 'bestBuyReason', 'bbox', 'platforms',
        ],
      },
    },
  },
  required: ['vibe', 'summary', 'estimatedTotalPhp', 'tipidTip', 'items'],
} as const
