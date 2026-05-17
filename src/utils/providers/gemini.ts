import { GEMINI_MODEL, GEMINI_SYSTEM_PROMPT } from '../../constants'
import type { GeminiAnalysis } from '../../types'
import {
  fetchWithTimeout,
  parseAnalysisJson,
  truncate,
  type Provider,
  type ProviderInput,
} from './shared'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

const responseSchema = {
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
          bbox: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            minItems: 4,
            maxItems: 4,
          },
          category: { type: 'STRING' },
          color: { type: 'STRING' },
          style: { type: 'STRING' },
          materialHint: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
          budgetNote: { type: 'STRING' },
          bestBuyReason: { type: 'STRING' },
          platforms: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                platform: {
                  type: 'STRING',
                  enum: ['shopee', 'lazada', 'carousell'],
                },
                query: { type: 'STRING' },
                estimatedPricePhp: { type: 'NUMBER' },
                reason: { type: 'STRING' },
              },
              required: ['platform', 'query', 'estimatedPricePhp', 'reason'],
            },
          },
        },
        required: [
          'itemName',
          'bbox',
          'category',
          'color',
          'style',
          'materialHint',
          'confidence',
          'budgetNote',
          'bestBuyReason',
          'platforms',
        ],
      },
    },
  },
  required: ['vibe', 'summary', 'estimatedTotalPhp', 'tipidTip', 'items'],
}

const callGemini = async ({ image }: ProviderInput): Promise<GeminiAnalysis> => {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is missing.')
  }

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: GEMINI_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Analyze this outfit for affordable Filipino shopping alternatives. Return JSON only.',
              },
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini ${response.status}: ${truncate(errorText)}`)
  }

  const payload = await response.json()
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Gemini returned no text content.')
  }

  return parseAnalysisJson(text)
}

export const geminiProvider: Provider = {
  label: {
    id: 'gemini',
    shortName: 'Gemini 2.5 Flash',
    pillLabel: 'Built with Gemini 2.5 Flash',
  },
  supportsImages: true,
  isConfigured: () => Boolean(API_KEY),
  call: callGemini,
}
