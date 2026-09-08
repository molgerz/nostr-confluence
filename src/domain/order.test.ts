import { describe, expect, it } from 'vitest'
import { effectiveOrderKey, implicitOrderKey, keyBetween } from './order'

describe('implicit order key', () => {
  it('is the normalised title, so the default order is alphabetical', () => {
    expect(implicitOrderKey('Onboarding', 'onboarding')).toBe('onboarding')
    // NIP-54 keeps non-ASCII letters, so the key does too.
    expect(implicitOrderKey('Über uns', 'über-uns')).toBe('über-uns')
    expect(implicitOrderKey('Handbook', 'handbook') < implicitOrderKey('Onboarding', 'x')).toBe(
      true,
    )
  })

  it('falls back to the slug when a title normalises to nothing', () => {
    expect(implicitOrderKey('???', 'question-mark')).toBe('question-mark')
  })

  it('prefers an explicit key over the title', () => {
    expect(effectiveOrderKey('am', 'Zebra', 'zebra')).toBe('am')
    expect(effectiveOrderKey(null, 'Zebra', 'zebra')).toBe('zebra')
    expect(effectiveOrderKey('', 'Zebra', 'zebra')).toBe('zebra')
  })
})

describe('keyBetween', () => {
  it('lands between its two neighbours', () => {
    const key = keyBetween('handbook', 'onboarding')
    expect('handbook' < key).toBe(true)
    expect(key < 'onboarding').toBe(true)
  })

  it('works on neighbours that differ by a single character', () => {
    const key = keyBetween('abc', 'abd')
    expect('abc' < key && key < 'abd').toBe(true)
  })

  it('works when one neighbour is the start of the other', () => {
    const key = keyBetween('ab', 'abc')
    expect('ab' < key && key < 'abc').toBe(true)
  })

  it('holds between neighbours from any script', () => {
    // Implicit keys are normalised titles, and NIP-54 keeps non-ASCII letters,
    // so the arithmetic here runs on more than a-z. src/nostr/kinds.ts
    const keys = ['a', 'zebra', 'äpfel', 'öl', 'über', 'straße', 'ñoño', 'москва', '日本語']
    const sorted = [...keys].sort()
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const key = keyBetween(sorted[index], sorted[index + 1])
      expect(sorted[index] < key).toBe(true)
      expect(key < sorted[index + 1]).toBe(true)
    }
  })

  it('goes before the first and after the last', () => {
    expect(keyBetween(null, 'handbook') < 'handbook').toBe(true)
    expect(keyBetween('handbook', null) > 'handbook').toBe(true)
    expect(keyBetween(null, null)).toBe('m')
  })

  it('survives repeated inserts into the same gap', () => {
    // Fifty pages dropped one after another into the gap that the previous
    // drop just created — the position has to hold every time.
    let low = 'aaa'
    const high = 'aab'
    for (let round = 0; round < 50; round += 1) {
      const key = keyBetween(low, high)
      expect(low < key).toBe(true)
      expect(key < high).toBe(true)
      low = key
    }
  })

  it('survives repeated inserts at the front and at the end', () => {
    let first = 'mmm'
    let last = 'mmm'
    for (let round = 0; round < 50; round += 1) {
      const before = keyBetween(null, first)
      const after = keyBetween(last, null)
      expect(before < first).toBe(true)
      expect(after > last).toBe(true)
      first = before
      last = after
    }
  })

  it('keeps a whole level in the order it was dragged into', () => {
    // b, then a in front of it, then c between the two.
    const b = keyBetween(null, null)
    const a = keyBetween(null, b)
    const c = keyBetween(a, b)
    expect([b, a, c].sort()).toEqual([a, c, b])
  })

  it('is deterministic when both neighbours carry the same key', () => {
    const key = keyBetween('same', 'same')
    expect(key).toBe(keyBetween('same', 'same'))
    expect(key > 'same').toBe(true)
  })
})
