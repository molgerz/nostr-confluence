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

  // Without an extension the tab cannot sign as the new identity. Keeping the
  // previous one is the one outcome that must not happen: that npub no longer
  // owns this machine.
  it('signs out instead of keeping the old identity when no extension is there', () => {
    expect(tabSync(KEY, BOB, ALICE, false)).toEqual({ action: 'sign-out' })
  })
})
