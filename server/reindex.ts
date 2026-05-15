import { buildIndex } from './catalog/indexer'

async function main() {
  console.log('[Reindex] Starting...')
  const indexed = await buildIndex()
  console.log(`[Reindex] Done. Indexed ${indexed.length} looks.`)
}

main().catch(err => {
  console.error('[Reindex] Failed:', err)
  process.exit(1)
})
