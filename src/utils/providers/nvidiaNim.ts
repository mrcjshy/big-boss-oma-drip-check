import { callOpenAiCompatible } from './openaiCompatible'
import type { Provider, ProviderInput } from './shared'

const API_KEY = import.meta.env.VITE_NVIDIA_NIM_API_KEY as string | undefined
const BASE_URL = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'meta/llama-3.2-90b-vision-instruct'

export const nvidiaNimProvider: Provider = {
  label: {
    id: 'nvidia',
    shortName: 'Llama 3.2 90B Vision',
    pillLabel: 'Built with Llama 3.2 Vision (NIM)',
  },
  supportsImages: true,
  isConfigured: () => Boolean(API_KEY),
  call: ({ image }: ProviderInput) =>
    callOpenAiCompatible({
      providerName: 'NVIDIA NIM',
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      model: MODEL,
      withImage: true,
      image,
    }),
}
