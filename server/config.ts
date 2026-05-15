import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

export const config = {
  port: Number(process.env.PORT) || 3001,
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',
  geminiModel: 'gemini-2.5-flash',
  embeddingModel: 'text-embedding-004',
  catalogPath: process.env.CATALOG_PATH || path.resolve(process.cwd(), 'server', 'lookbook.json'),
  thresholds: {
    autoAccept: 0.82,
    showTop3: 0.55,
    topK: 5,
  },
} as const
