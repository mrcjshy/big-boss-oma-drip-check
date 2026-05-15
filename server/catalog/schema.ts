export type LookbookItem = {
  itemName: string
  category: string
  color: string
  style: string
  materialHint: string
}

export type LookbookEntry = {
  lookId: string
  name: string
  tags: string[]
  items: LookbookItem[]
  imagePath: string
}

export type LookbookCatalog = {
  looks: LookbookEntry[]
}
