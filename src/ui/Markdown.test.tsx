// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { nip19 } from 'nostr-tools'
import { Markdown } from './Markdown'

/**
 * The rendered page, checked against the editor's live formatting: a mention
 * is a chip on both sides, and a list is indented the same way.
 * src/ui/markdown-live.test.ts
 */
const NPUB = nip19.npubEncode('1'.repeat(64))

function render(markdown: string): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<Markdown>{markdown}</Markdown>)
  })
  return host
}

describe('Markdown', () => {
  it('draws a mention as a chip carrying the npub, not as a bare link', () => {
    const page = render(`Ask nostr:${NPUB} please`)
    const chip = page.querySelector<HTMLElement>('[title]')
    expect(chip?.title).toBe(NPUB)
    expect(chip?.textContent?.startsWith('@')).toBe(true)
    // The whole point: react-markdown blanks an unknown scheme, and the
    // mention then arrives as a plain link showing all 63 characters.
    expect(page.querySelector('a')).toBeNull()
    expect(page.textContent).not.toContain(NPUB)
  })

  it('draws a written nostr link as a chip as well', () => {
    const page = render(`see [Alice](nostr:${NPUB}) now`)
    expect(page.querySelector<HTMLElement>('[title]')?.title).toBe(NPUB)
    expect(page.querySelector('a')).toBeNull()
  })

  it('leaves an ordinary link alone and still drops an unsafe scheme', () => {
    const page = render('[docs](https://example.com) and [x](javascript:alert(1))')
    const links = [...page.querySelectorAll('a')]
    // the sanitiser drops the attribute outright — `nostr:` is let through
    // one step earlier, it is not an exception to this
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.com', null])
  })

  it('keeps the empty lines the writer left, which Markdown itself collapses', () => {
    const page = render('Para A\n\n\n\nPara B\n\nPara C\n\n\n')
    const spacers = [...page.querySelectorAll('div[aria-hidden]')]
    // One before B — three empty lines, one of which separates the paragraphs
    // — and none before C or at the end. 59.5px is two lines at the page's
    // 17px over 1.75, so the gap is as tall here as it is in the editor.
    expect(spacers.map((s) => (s as HTMLElement).style.height)).toEqual(['calc(59.5px)'])
    expect(spacers[0].nextElementSibling?.textContent).toBe('Para B')
  })

  it('gives a nested list its own bullet shape, the way the editor does', () => {
    const page = render('- outer\n  - inner\n    - deep')
    const lists = [...page.querySelectorAll('ul')]
    expect(lists).toHaveLength(3)
    expect(lists[0].className).toContain('list-disc')
    // the nested levels are selected from the outermost list, so a level keeps
    // its shape however deep the tree already is
    expect(lists[0].className).toContain('[&_ul]:list-[circle]')
    expect(lists[0].className).toContain('[&_ul_ul]:list-[square]')
  })
})

