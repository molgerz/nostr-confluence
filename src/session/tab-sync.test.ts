import { describe, expect, it } from 'vitest'
import { tabSync } from './session'

const ALICE = 'a'.repeat(64)
const BOB = 'b'.repeat(64)
const KEY = 'nc-pubkey'

describe('tabSync', () => {
  it('ignores a key this app does not own', () => {
    expect(tabSync('theme', null, ALICE, true)).toEqual({ action: 'ignore' })
  })

  // The point of the whole thing: signing out in one tab has to reach the
  // others, or the button only ends the session where it was clicked.
  it('signs out when another tab cleared the stored pubkey', () => {
    expect(tabSync(KEY, null, ALICE, true)).toEqual({ action: 'sign-out' })
  })

  it('reads a wholesale storage clear as a sign-out too', () => {
    // localStorage.clear() reports key === null rather than naming each key.
    expect(tabSync(null, null, ALICE, true)).toEqual({ action: 'sign-out' })
  })

  it('stays put when the storage says what this tab already knows', () => {
    expect(tabSync(KEY, ALICE, ALICE, true)).toEqual({ action: 'ignore' })
  })

  it('has nothing to do when it was signed out already', () => {
    expect(tabSync(KEY, null, null, true)).toEqual({ action: 'ignore' })
  })

  it('adopts the identity another tab signed in with', () => {
    expect(tabSync(KEY, BOB, ALICE, true)).toEqual({ action: 'adopt', pubkey: BOB })
  })

  it('adopts an identity even when this tab was anonymous', () => {
    expect(tabSync(KEY, BOB, null, true)).toEqual({ action: 'adopt', pubkey: BOB })
  })

  // Without a way to sign for the new identity the tab cannot adopt it.
  // Keeping the previous one is the one outcome that must not happen: that
  // npub no longer owns this machine. A NIP-46 client counts as a way to sign,
  // exactly like an extension, which is why the call site passes
  // `getNip07Provider() !== null || stored NIP-46 session present`.
  it('signs out instead of keeping the old identity when it cannot sign', () => {
    expect(tabSync(KEY, BOB, ALICE, false)).toEqual({ action: 'sign-out' })
  })

  it('adopts a stored NIP-46 session another tab signed in with', () => {
    expect(tabSync(KEY, BOB, ALICE, true)).toEqual({ action: 'adopt', pubkey: BOB })
  })

  // `nc-nip46` carries no identity, only how to reach a signer. On its own a
  // change to it must never end the session.
  it('ignores a change to the NIP-46 pointer by itself', () => {
    expect(tabSync('nc-nip46', null, ALICE, true)).toEqual({ action: 'ignore' })
  })
})
