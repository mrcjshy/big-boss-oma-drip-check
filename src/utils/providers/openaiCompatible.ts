// Shared helper for OpenAI-compatible chat-completions endpoints (NVIDIA NIM,
// OpenRouter, DeepSeek). Each provider hits `${baseUrl}/chat/completions` with
// the standard request body and returns the assistant text content.

import { GEMINI_SYSTEM_PROMPT } from '../../constants'
import type { GeminiAnalysis } from '../../types'
import {
  fetchWithTimeout,
  parseAnalysisJson,
  truncate,
  type ImagePayload,
} from './shared'

const JSON_SHAPE_REMINDER = `Return ONLY valid JSON with this exact shape:
{
  "vibe": string,
  "summary": string,
  "estimatedTotalPhp": number,
  "tipidTip": string,
  "items": [
    {
      "itemName": string,
      "bbox": [ymin, xmin, ymax, xmax] as 4 integers in 0-1000 image coords,
      "category": string,
      "color": string,
      "style": string,
      "materialHint": string,
      "confidence": number between 0 and 1,
      "budgetNote": string,
      "bestBuyReason": string,
      "platforms": [
        {
          "platform": "shopee" | "lazada" | "carousell",
          "query": string,
          "estimatedPricePhp": number,
          "reason": string
        }
      ]
    }
  ]
}
No markdown fences, no commentary, no leading text. JSON only.`

type ChatMessage = {
  role: 'system' | 'user'
  content: string | unknown[]
}

export type OpenAiCompatibleConfig = {
  providerName: string
  baseUrl: string
  apiKey: string | undefined
  model: string
  withImage: boolean
  image?: ImagePayload
  extraHeaders?: Record<string, string>
  temperature?: number
}

const buildUserContent = (config: OpenAiCompatibleConfig) => {
  if (!config.withImage || !config.image) {
    return [
      {
        type: 'text',
        text: `${JSON_SHAPE_REMINDER}\n\nNo outfit image is available. Generate a realistic, generic Manila campus/casual outfit (e.g. oversized tee + denim) as best-effort placeholder JSON. Set every item's confidence at most 0.45 and add "Generic Manila outfit (text-only fallback)" to each budgetNote. Use bbox [0,0,1000,1000] for every item.`,
      },
    ]
  }

  return [
    {
      type: 'text',
      text: `${JSON_SHAPE_REMINDER}\n\nAnalyze this outfit photo for affordable Filipino shopping alternatives.`,
    },
    {
      type: 'image_url',
      image_url: { url: config.image.dataUrl },
    },
  ]
}

export const callOpenAiCompatible = async (
  config: OpenAiCompatibleConfig,
): Promise<GeminiAnalysis> => {
  if (!config.apiKey) {
    throw new Error(`${config.providerName} API key is missing.`)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: GEMINI_SYSTEM_PROMPT },
    { role: 'user', content: buildUserContent(config) },
  ]

  const response = await fetchWithTimeout(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.35,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `${config.providerName} ${response.status}: ${truncate(errorText)}`,
    )
  }

  const payload = await response.json()
  const text: string | undefined = payload?.choices?.[0]?.message?.content

  if (!text) {
    throw new Error(`${config.providerName} returned no message content.`)
  }

  return parseAnalysisJson(text)
}
