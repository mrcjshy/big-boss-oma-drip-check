import { config } from './config'

const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent`

/**
 * Tagged error for Gemini quota / rate-limit failures. Lets the API layer
 * return a clean 429 with a structured `code` instead of leaking Google's
 * verbose error JSON (which contains the raw model id and the user's plan
 * URL) back to the browser.
 */
export class GeminiQuotaError extends Error {
  readonly code = 'quota_exceeded' as const
  readonly status = 429
  constructor(message = 'Gemini quota exhausted') {
    super(message)
    this.name = 'GeminiQuotaError'
  }
}

const isQuotaResponse = (status: number, body: string): boolean =>
  status === 429 || /quota|rate.?limit|resource.?exhausted/i.test(body)

export async function callGeminiVision(
  base64Data: string,
  mimeType: string,
  systemPrompt: string,
  userPrompt: string,
  responseSchema: Record<string, unknown>,
): Promise<string> {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY / VITE_GEMINI_API_KEY not set in environment')
  }

  const response = await fetch(`${GENERATE_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        role: 'user',
        parts: [
          { text: userPrompt },
          { inlineData: { mimeType, data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (isQuotaResponse(response.status, errorText)) {
      throw new GeminiQuotaError()
    }
    throw new Error(`Gemini API error: ${response.status}. ${errorText.slice(0, 200)}`)
  }

  const payload = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No text returned from Gemini')
  return text
}

export async function embedText(text: string): Promise<number[]> {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY / VITE_GEMINI_API_KEY not set in environment')
  }

  const response = await fetch(`${EMBED_URL}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    if (isQuotaResponse(response.status, errorText)) {
      throw new GeminiQuotaError()
    }
    throw new Error(`Embedding API error: ${response.status}. ${errorText.slice(0, 200)}`)
  }

  const payload = await response.json() as { embedding?: { values?: number[] } }
  return payload.embedding?.values ?? []
}
