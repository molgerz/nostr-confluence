import { describe, expect, it } from 'vitest'
import { nip19 } from 'nostr-tools'
import { collectMentions, findMentions, mentionPubkey, mentionUri } from './mentions'

const ALICE = '1'.repeat(64)
const BOB = 'ab'.repeat(32)
const ALICE_NPUB = nip19.npubEncode(ALICE)
const BOB_NPUB = nip19.npubEncode(BOB)

describe('mentionPubkey', () => {
  it('reads the key out of a nostr URI and a bare npub alike', () => {
    expect(mentionPubkey(`nostr:${ALICE_NPUB}`)).toBe(ALICE)
    expect(mentionPubkey(ALICE_NPUB)).toBe(ALICE)
  })

  it('accepts an nprofile, which carries relay hints alongside the key', () => {
    const nprofile = nip19.nprofileEncode({ pubkey: BOB, relays: ['wss://relay.example'] })
    expect(mentionPubkey(`nostr:${nprofile}`)).toBe(BOB)
  })

  it('returns null for anything that is not a key', () => {
    expect(mentionPubkey('nostr:npub1nonsense')).toBeNull()
    expect(mentionPubkey('https://example.com')).toBeNull()
    expect(mentionPubkey('')).toBeNull()
    // a note id is a valid bech32 entity, but not a person
    expect(mentionPubkey(nip19.noteEncode(ALICE))).toBeNull()
  })
})

describe('findMentions', () => {
  it('reports position and key for every mention', () => {
    const text = `Ask nostr:${ALICE_NPUB} about it.`
    const [mention, ...rest] = findMentions(text)
    expect(rest).toHaveLength(0)
    expect(mention.pubkey).toBe(ALICE)
    expect(text.slice(mention.from, mention.to)).toBe(`nostr:${ALICE_NPUB}`)
  })

  it('finds several in one line without dropping the second', () => {
    const text = `nostr:${ALICE_NPUB} and nostr:${BOB_NPUB}`
    expect(findMentions(text).map((span) => span.pubkey)).toEqual([ALICE, BOB])
  })

  it('scans from the start on every call — a shared regex would skip matches', () => {
    const text = `nostr:${ALICE_NPUB}`
    expect(findMentions(text)).toHaveLength(1)
    expect(findMentions(text)).toHaveLength(1)
  })

  it('ignores a half-typed npub instead of highlighting it as a person', () => {
    expect(findMentions('nostr:npub1qqqqq')).toEqual([])
  })

  it('leaves text that only looks like a URI alone', () => {
    expect(findMentions('write nostr: and stop')).toEqual([])
  })
})

describe('collectMentions', () => {
  it('keeps the order of first appearance and mentions each key once', () => {
    const text = `nostr:${BOB_NPUB} then nostr:${ALICE_NPUB} then nostr:${BOB_NPUB}`
    expect(collectMentions(text)).toEqual([BOB, ALICE])
  })

  it('is empty for a text without mentions', () => {
    expect(collectMentions('# A page\n\nJust words.')).toEqual([])
  })
})

describe('mentionUri', () => {
  it('round-trips through mentionPubkey', () => {
    expect(mentionPubkey(mentionUri(ALICE))).toBe(ALICE)
  })
})
