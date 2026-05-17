import { callOpenAiCompatible } from './openaiCompatible'
import type { Provider, ProviderInput } from './shared'

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
const BASE_URL = 'https://openrouter.ai/api/v1'
// Free-tier vision model on OpenRouter. Swap to a paid model if rate-limited.
const MODEL = 'meta-llama/llama-3.2-11b-vision-instruct:free'

const extraHeaders: Record<string, string> = {
  // OpenRouter recommends these for attribution and free-tier quota tracking.
  'HTTP-Referer':
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
  'X-Title': 'Drip Check',
}

export const openrouterProvider: Provider = {
  label: {
    id: 'openrouter',
    shortName: 'Llama 3.2 11B Vision',
    pillLabel: 'Built with Llama 3.2 Vision (OpenRouter)',
  },
  supportsImages: true,
  isConfigured: () => Boolean(API_KEY),
  call: ({ image }: ProviderInput) =>
    callOpenAiCompatible({
      providerName: 'OpenRouter',
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      model: MODEL,
      withImage: true,
      image,
      extraHeaders,
    }),
}
