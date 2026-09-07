import { describe, expect, it } from 'vitest'
import { displayName, parsePubkeyInput, shortNpub, toNpub } from './profile'

const hex = '91ec7a9b73ebf7130db2652de48b34def8fca0b77777377e346fa2e103f9767e'

describe('parsePubkeyInput', () => {
  it('nimmt Hex an', () => {
    expect(parsePubkeyInput(`  ${hex.toUpperCase()} `)).toBe(hex)
  })

  it('wandelt npub in Hex um', () => {
    expect(parsePubkeyInput(toNpub(hex))).toBe(hex)
  })

  it('lehnt Unsinn ab, statt ihn durchzulassen', () => {
    expect(parsePubkeyInput('npub1tippfehler')).toBeNull()
    expect(parsePubkeyInput('kein schlüssel')).toBeNull()
    expect(parsePubkeyInput('')).toBeNull()
    expect(parsePubkeyInput(hex.slice(0, 63))).toBeNull()
  })
})

describe('Anzeige', () => {
  it('kürzt den npub in der Mitte', () => {
    const npub = toNpub(hex)
    expect(shortNpub(npub)).toBe(`${npub.slice(0, 10)}…${npub.slice(-6)}`)
  })

  it('nimmt den npub, wenn kein Profil da ist', () => {
    const npub = toNpub(hex)
    expect(displayName(null, npub)).toBe(shortNpub(npub))
    expect(displayName({ displayName: 'Alice' }, npub)).toBe('Alice')
    expect(displayName({ name: 'alice' }, npub)).toBe('alice')
  })
})
