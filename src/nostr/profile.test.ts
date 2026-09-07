import { describe, expect, it } from 'vitest'
import { displayName, parsePubkeyInput, shortNpub, toNpub } from './profile'

const hex = '91ec7a9b73ebf7130db2652de48b34def8fca0b77777377e346fa2e103f9767e'

describe('parsePubkeyInput', () => {
  it('accepts hex', () => {
    expect(parsePubkeyInput(`  ${hex.toUpperCase()} `)).toBe(hex)
  })

  it('converts an npub to hex', () => {
    expect(parsePubkeyInput(toNpub(hex))).toBe(hex)
  })

  it('rejects nonsense instead of letting it through', () => {
    expect(parsePubkeyInput('npub1tippfehler')).toBeNull()
    expect(parsePubkeyInput('not a key')).toBeNull()
    expect(parsePubkeyInput('')).toBeNull()
    expect(parsePubkeyInput(hex.slice(0, 63))).toBeNull()
  })
})

describe('display', () => {
  it('shortens the npub in the middle', () => {
    const npub = toNpub(hex)
    expect(shortNpub(npub)).toBe(`${npub.slice(0, 10)}…${npub.slice(-6)}`)
  })

  it('falls back to the npub when there is no profile', () => {
    const npub = toNpub(hex)
    expect(displayName(null, npub)).toBe(shortNpub(npub))
    expect(displayName({ displayName: 'Alice' }, npub)).toBe('Alice')
    expect(displayName({ name: 'alice' }, npub)).toBe('alice')
  })
})
