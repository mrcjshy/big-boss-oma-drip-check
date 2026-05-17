export type Collaborator = {
  name: string
  handle: string
  githubUrl: string
}

export const SITE_METADATA = {
  title: 'Drip Check — Filipino Fashion Finder',
  description:
    'Upload a fit pic. Compare Shopee, Lazada, and ukay-style resale with AI-powered Best Buy picks for Metro Manila shoppers.',
  event: 'GDG Manila Build with AI 2026',
  location: 'Manila',
  year: 2026,
  collaborators: [
    {
      name: 'Owen',
      handle: 'owenlim225',
      githubUrl: 'https://github.com/owenlim225',
    },
  ] satisfies Collaborator[],
} as const
