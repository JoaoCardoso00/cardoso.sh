import type { Locale } from './i18n'

export type Project = {
  slug: string
  title: string
  // Shown next to the title on the home list.
  year: number
  // Shown on the tile, e.g. "June 2025".
  date: Record<Locale, string>
  description: Record<Locale, string>
  href: string
  // Tile background. Dark tiles get light text.
  tone: 'white' | 'light' | 'grey' | 'dark'
  // Optional preview shown inside the tile.
  image?: { src: string; alt: Record<Locale, string> }
}

// Newest first. The home page lists the first `HOME_LIMIT` entries.
export const projects: Project[] = []

export const HOME_LIMIT = 6
