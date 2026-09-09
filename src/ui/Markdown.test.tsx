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
})

