// Sequential LLM fallback chain for Drip Check outfit analysis.
//
// Order:
//   1. Gemini 2.5 Flash      (vision)
//   2. NVIDIA NIM Llama 3.2  (vision)
//   3. OpenRouter Llama 3.2  (vision)
//   4. DeepSeek deepseek-chat (TEXT-ONLY — cannot see the image, returns a
//      generic Manila outfit so the UI still has structured JSON to render.)
//
// Each provider has a 20s timeout. The first provider that returns a parsable
// JSON analysis wins, and we surface which provider succeeded so the UI can
// show an honest "BUILT WITH ..." pill.
//
// SECURITY: every API key is read via VITE_* env vars, which means it is
// embedded in the client bundle. Anyone can read these keys from devtools.
// For production move every provider call behind a server proxy you control.

import { deepseekProvider } from './providers/deepseek'
import { geminiProvider } from './providers/gemini'
import { nvidiaNimProvider } from './providers/nvidiaNim'
import { openrouterProvider } from './providers/openrouter'
import type {
  ImagePayload,
  Provider,
  ProviderLabel,
  ProviderResult,
} from './providers/shared'

const PROVIDER_CHAIN: readonly Provider[] = [
  geminiProvider,
  nvidiaNimProvider,
  openrouterProvider,
  deepseekProvider,
] as const

export type FallbackAttempt = {
  provider: ProviderLabel
  error: string
}

export class AllProvidersFailedError extends Error {
  readonly attempts: readonly FallbackAttempt[]

  constructor(attempts: readonly FallbackAttempt[]) {
    super('All AI providers unavailable.')
    this.name = 'AllProvidersFailedError'
    this.attempts = attempts
  }
}

const fileToImagePayload = (file: File): Promise<ImagePayload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const base64 = dataUrl.split(',')[1] ?? dataUrl
      resolve({
        base64,
        mimeType: file.type || 'image/jpeg',
        dataUrl,
      })
    }
    reader.onerror = () =>
      reject(new Error('Hindi mabasa yung image. Try another photo.'))
    reader.readAsDataURL(file)
  })

export const runFallbackChain = async (file: File): Promise<ProviderResult> => {
  const image = await fileToImagePayload(file)
  const attempts: FallbackAttempt[] = []

  for (const provider of PROVIDER_CHAIN) {
    if (!provider.isConfigured()) {
      attempts.push({
        provider: provider.label,
        error: 'API key not configured.',
      })
      continue
    }

    try {
      const analysis = await provider.call({ image })
      if (attempts.length > 0) {
        console.info(
          `[Drip Check] Falling forward to ${provider.label.shortName} after ${attempts.length} failed provider(s).`,
          attempts,
        )
      } else {
        console.info(`[Drip Check] Analyzed with ${provider.label.shortName}.`)
      }
      return { analysis, label: provider.label }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : String(caughtError)
      console.warn(
        `[Drip Check] ${provider.label.shortName} failed: ${message}`,
      )
      attempts.push({ provider: provider.label, error: message })
    }
  }

  throw new AllProvidersFailedError(attempts)
}
