import { describe, expect, it } from 'vitest'
import { mergeProfileContent, preservedFields } from './publish-profile'

const draft = { name: 'alice', about: 'writes docs', picture: 'https://example.com/a.png' }

describe('mergeProfileContent', () => {
  it('writes the three NIP-01 fields', () => {
    expect(JSON.parse(mergeProfileContent(null, draft))).toEqual({
      name: 'alice',
      about: 'writes docs',
      picture: 'https://example.com/a.png',
    })
  })

  // The important one: kind 0 is replaceable, so a save that only serialises
  // our own fields would silently delete what other clients have set.
  it('keeps fields it does not know about', () => {
    const existing = JSON.stringify({
      name: 'old',
      nip05: 'alice@example.com',
      lud16: 'alice@wallet.example',
      banner: 'https://example.com/b.png',
      birthday: { year: 1990, month: 4, day: 1 },
    })
    const merged = JSON.parse(mergeProfileContent(existing, draft))
    expect(merged.nip05).toBe('alice@example.com')
    expect(merged.lud16).toBe('alice@wallet.example')
    expect(merged.banner).toBe('https://example.com/b.png')
    expect(merged.birthday).toEqual({ year: 1990, month: 4, day: 1 })
    expect(merged.name).toBe('alice')
  })

  it('removes an emptied field instead of storing an empty string', () => {
    const existing = JSON.stringify({ name: 'old', about: 'old bio', nip05: 'a@b.c' })
    const merged = JSON.parse(
      mergeProfileContent(existing, { name: 'alice', about: '   ', picture: '' }),
    )
    expect(merged).not.toHaveProperty('about')
    expect(merged).not.toHaveProperty('picture')
    expect(merged.nip05).toBe('a@b.c')
  })

  it('trims whitespace around a value', () => {
    const merged = JSON.parse(
      mergeProfileContent(null, { name: '  alice  ', about: '', picture: '' }),
    )
    expect(merged.name).toBe('alice')
  })

  // Foreign content: anyone can publish any string as kind 0 content.
  it('starts from scratch when the existing content is not a JSON object', () => {
    for (const broken of ['', 'not json', '[1,2,3]', '"a string"', 'null']) {
      expect(JSON.parse(mergeProfileContent(broken, draft))).toEqual(draft)
    }
  })
})

describe('preservedFields', () => {
  it('names exactly the keys the editor leaves alone', () => {
    const existing = JSON.stringify({ name: 'a', picture: 'p', nip05: 'x', lud16: 'y' })
    expect(preservedFields(existing).sort()).toEqual(['lud16', 'nip05'])
  })

  it('is empty without an existing profile', () => {
    expect(preservedFields(null)).toEqual([])
    expect(preservedFields('kaputt')).toEqual([])
  })
})
