// Shared types and helpers used by every LLM provider in the fallback chain.
//
// SECURITY NOTE: each provider reads its API key from import.meta.env with a
// VITE_ prefix, which means the key is embedded in the client bundle and
// visible to anyone who inspects the network tab. This matches the existing
// VITE_GEMINI_API_KEY pattern, but for production you should proxy these
// requests through a server-side endpoint so the keys never leave your backend.

import type { GeminiAnalysis } from '../../types'

export type ProviderId = 'gemini' | 'nvidia' | 'openrouter' | 'deepseek' | 'demo'

export type ProviderLabel = {
  id: ProviderId
  shortName: string
  pillLabel: string
}

export type ImagePayload = {
  base64: string
  mimeType: string
  dataUrl: string
}

export type ProviderInput = {
  image: ImagePayload
}

export type ProviderResult = {
  analysis: GeminiAnalysis
  label: ProviderLabel
}

export type Provider = {
  label: ProviderLabel
  supportsImages: boolean
  isConfigured: () => boolean
  call: (input: ProviderInput) => Promise<GeminiAnalysis>
}

export const DEFAULT_TIMEOUT_MS = 20_000

export const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (caughtError) {
    if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`)
    }
    throw caughtError
  } finally {
    clearTimeout(timer)
  }
}

export const stripJsonFences = (text: string): string =>
  text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

export const parseAnalysisJson = (text: string): GeminiAnalysis => {
  const cleaned = stripJsonFences(text)
  const parsed = JSON.parse(cleaned) as GeminiAnalysis

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('Provider returned JSON without an items array.')
  }

  return parsed
}

export const truncate = (text: string, max = 180): string =>
  text.length > max ? `${text.slice(0, max)}...` : text
