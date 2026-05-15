import { config } from './config'

const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent`

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
    throw new Error(`Embedding API error: ${response.status}. ${errorText.slice(0, 200)}`)
  }

  const payload = await response.json() as { embedding?: { values?: number[] } }
  return payload.embedding?.values ?? []
}
