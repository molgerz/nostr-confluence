import { describe, expect, it } from 'vitest'
import { highlightParts, searchPages } from './search'
import { buildPages } from './pages'
import type { Revision } from './revision'

function rev(slug: string, title: string, content: string): Revision {
  return {
    id: slug,
    author: 'alice',
    createdAt: 1000,
    group: 'engineering',
    slug,
    title,
    parentSlug: null,
    parentRevs: [],
    summary: null,
    content,
  }
}

const pages = buildPages([
  rev('onboarding', 'Onboarding', '# Onboarding\n\nZugang zum VPN beantragen.\n\nLaptop abholen.'),
  rev('deployment', 'Deployment', '# Deployment\n\nBuild, Test, Deploy.\n\nVPN ist dafür nötig.'),
  rev('urlaub', 'Urlaub', '# Urlaub\n\nAntrag im Tool stellen.'),
])

describe('searchPages', () => {
  it('findet Seiten über den Inhalt und sortiert nach Relevanz', () => {
    const hits = searchPages(pages, 'vpn')
    expect(hits.map((hit) => hit.page.slug)).toEqual(['deployment', 'onboarding'])
  })

  it('gewichtet einen Titeltreffer höher als einen Inhaltstreffer', () => {
    const hits = searchPages(pages, 'deployment')
    expect(hits[0].page.slug).toBe('deployment')
    expect(hits[0].titleMatch).toBe(true)
  })

  it('verlangt alle Suchbegriffe', () => {
    expect(searchPages(pages, 'vpn laptop').map((hit) => hit.page.slug)).toEqual(['onboarding'])
    expect(searchPages(pages, 'vpn gibtsnicht')).toEqual([])
  })

  it('ignoriert Groß- und Kleinschreibung', () => {
    expect(searchPages(pages, 'ONBOARDING')).toHaveLength(1)
  })

  it('gibt bei leerer Eingabe nichts zurück', () => {
    expect(searchPages(pages, '   ')).toEqual([])
  })

  it('liefert Textausschnitte mit Zeilennummer und ohne Leerzeilen', () => {
    const [hit] = searchPages(pages, 'laptop')
    expect(hit.snippets).toEqual([{ line: 5, text: 'Laptop abholen.' }])
  })
})

describe('highlightParts', () => {
  it('trennt Treffer vom übrigen Text', () => {
    expect(highlightParts('Zugang zum VPN beantragen', 'vpn')).toEqual([
      { text: 'Zugang zum ', hit: false },
      { text: 'VPN', hit: true },
      { text: ' beantragen', hit: false },
    ])
  })

  it('markiert mehrere Vorkommen', () => {
    const parts = highlightParts('VPN und VPN', 'vpn')
    expect(parts.filter((part) => part.hit)).toHaveLength(2)
  })

  it('gibt den Text unverändert zurück, wenn nichts passt', () => {
    expect(highlightParts('nichts hier', 'vpn')).toEqual([{ text: 'nichts hier', hit: false }])
  })
})
