// DeepSeek is text-only (deepseek-chat has no vision support). The fallback
// chain skips DeepSeek's image analysis and instead asks it to generate a safe,
// best-effort generic Manila outfit so the user still sees structured JSON
// instead of the demo banner when every vision provider has failed.

import { callOpenAiCompatible } from './openaiCompatible'
import type { Provider } from './shared'

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined
const BASE_URL = 'https://api.deepseek.com/v1'
const MODEL = 'deepseek-chat'

export const deepseekProvider: Provider = {
  label: {
    id: 'deepseek',
    shortName: 'DeepSeek Chat (text-only)',
    pillLabel: 'Built with DeepSeek (text fallback)',
  },
  supportsImages: false,
  isConfigured: () => Boolean(API_KEY),
  call: ({ image }) =>
    callOpenAiCompatible({
      providerName: 'DeepSeek',
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      model: MODEL,
      // DeepSeek cannot see the photo, so we pass image=undefined and the
      // helper switches to the "generic Manila outfit" placeholder prompt.
      withImage: false,
      image,
    }),
}
