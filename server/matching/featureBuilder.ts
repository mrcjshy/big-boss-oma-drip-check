import type { LookbookEntry, LookbookItem } from '../catalog/schema'
import type { ParsedItem } from './types'

function itemToFeatureText(item: {
  category: string
  color: string
  style: string
  materialHint: string
  itemName: string
}): string {
  return `${item.category}: ${item.color} ${item.itemName}, ${item.style} style, ${item.materialHint}`
}

export function buildLookFeatureText(entry: LookbookEntry): string {
  const itemDescriptions = entry.items.map(itemToFeatureText).join(' | ')
  return `Outfit: ${entry.name}. Tags: ${entry.tags.join(', ')}. Items: ${itemDescriptions}`
}

export function buildQueryFeatureText(items: ParsedItem[]): string {
  const filtered = items.filter(i => i.confidence >= 0.3)
  if (filtered.length === 0) return ''
  const itemDescriptions = filtered.map(itemToFeatureText).join(' | ')
  return `Query outfit. Items: ${itemDescriptions}`
}

export type ItemFeatures = {
  category: string
  color: string
  style: string
  material: string
  name: string
}

export function extractItemFeatures(item: ParsedItem | LookbookItem): ItemFeatures {
  return {
    category: item.category.toLowerCase().trim(),
    color: item.color.toLowerCase().trim(),
    style: item.style.toLowerCase().trim(),
    material: item.materialHint.toLowerCase().trim(),
    name: item.itemName.toLowerCase().trim(),
  }
}
