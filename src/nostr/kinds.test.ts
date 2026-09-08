import { describe, expect, it } from 'vitest'
import { SLUG_MAX_LENGTH, normalizeSlug } from './kinds'

describe('normalizeSlug', () => {
  // The example table from NIP-54. If one of these breaks, our slugs stop
  // agreeing with every other wiki client's.
  it.each([
    ['Wiki Article', 'wiki-article'],
    ["What's Up?", 'whats-up'],
    ['  Hello  World  ', 'hello-world'],
    ['Article 1', 'article-1'],
    ['ウィキペディア', 'ウィキペディア'],
    ['Ñoño', 'ñoño'],
    ['Москва', 'москва'],
    ['日本語 Article', '日本語-article'],
  ])('normalises %j to %j as NIP-54 does', (input, expected) => {
    expect(normalizeSlug(input)).toBe(expected)
  })

  it('composes first, so a typed and a pasted tilde agree', () => {
    const mixed = 'N' + '\u0303' + 'o' + '\u00f1' + 'o'
    expect(normalizeSlug(mixed)).toBe(normalizeSlug('Ñoño'))
  })

  it('keeps the marks a script needs to be readable', () => {
    expect(normalizeSlug('हिन्दी Seite')).toBe('हिन्दी-seite')
  })

  it('keeps umlauts instead of transliterating them', () => {
    expect(normalizeSlug('Möbel für das Büro')).toBe('möbel-für-das-büro')
    expect(normalizeSlug('Straße')).toBe('straße')
  })

  it('drops an emoji without leaving an invisible remainder', () => {
    expect(normalizeSlug('Roadmap 🚀')).toBe('roadmap')
    expect(normalizeSlug('1' + '\ufe0f' + '\u20e3' + ' Intro')).toBe('1-intro')
  })

  it('drops letters outside the basic multilingual plane', () => {
    // Pasted from a "fancy font" generator: mathematical bold capitals.
    expect(normalizeSlug('\u{1d407}\u{1d41e}\u{1d425}\u{1d425}\u{1d428}')).toBe('')
  })

  it('has nothing to derive from punctuation alone', () => {
    // The editor refuses to save this and says so — src/ui/PageEditor.tsx.
    expect(normalizeSlug('???')).toBe('')
    expect(normalizeSlug('   ')).toBe('')
  })

  it('caps the result without leaving a trailing hyphen', () => {
    const slug = normalizeSlug('a '.repeat(80))
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH)
    expect(slug.endsWith('-')).toBe(false)
  })
})
