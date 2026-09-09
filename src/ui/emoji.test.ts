import { describe, expect, it } from 'vitest'
import { EMOJI, searchEmoji } from './emoji'

describe('searchEmoji', () => {
  it('puts an exact shortcode first', () => {
    expect(searchEmoji('smile')[0]).toMatchObject({ name: 'smile', char: '😄' })
  })

  it('prefers a prefix over a hit in the middle of the name', () => {
    const names = searchEmoji('ear', 40).map((emoji) => emoji.name)
    expect(names.indexOf('earth_africa')).toBeLessThan(names.indexOf('bear'))
  })

  it('finds by keyword as well, so :thumb and :+1 both work', () => {
    expect(searchEmoji('+1').map((emoji) => emoji.char)).toContain('👍')
    expect(searchEmoji('thumbs').map((emoji) => emoji.char)).toContain('👍')
  })

  it('respects the limit and answers an empty query with the head of the list', () => {
    expect(searchEmoji('', 3)).toEqual(EMOJI.slice(0, 3))
    expect(searchEmoji('a', 4).length).toBeLessThanOrEqual(4)
  })

  it('returns nothing rather than everything for a query that matches nobody', () => {
    expect(searchEmoji('zzzzz')).toEqual([])
  })

  it('has unique shortcodes — a duplicate would be unreachable in the dropdown', () => {
    const names = EMOJI.map((emoji) => emoji.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
