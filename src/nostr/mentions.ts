import { nip19 } from 'nostr-tools'

/**
 * Mentions inside page and comment content.
 *
 * A mention is stored as a NIP-27 `nostr:` URI, never as the display name: a
 * name is freely chosen, not unique and can change, so `@alice` would point at
 * whoever calls themselves alice today. The key is the reference; the name is
 * only how it is drawn — in the editor as well as in the rendered page.
 * docs/13-editing.md
 */

/** bech32 data charset — everything after the `1` separator */
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

/**
 * A fresh regex per call: a global one carries `lastIndex` between calls, so a
 * shared instance would skip matches depending on who scanned last.
 */
export function mentionPattern(): RegExp {
  return new RegExp(`nostr:((?:npub|nprofile)1[${BECH32}]{6,})`, 'gi')
}

/**
 * hex pubkey behind a mention — accepts the bare bech32 or the full URI.
 * Returns null for anything else, so a typo cannot end up in a `p` tag.
 */
export function mentionPubkey(input: string): string | null {
  const value = input.trim().replace(/^nostr:/i, '')
  try {
    const decoded = nip19.decode(value)
    if (decoded.type === 'npub' && typeof decoded.data === 'string') return decoded.data
    if (decoded.type === 'nprofile') return decoded.data.pubkey
  } catch {
    return null
  }
  return null
}

/** What gets written into the text when a mention is picked. */
export function mentionUri(pubkeyHex: string): string {
  return `nostr:${nip19.npubEncode(pubkeyHex)}`
}

export type MentionSpan = {
  /** offset of the `n` in `nostr:` */
  from: number
  to: number
  pubkey: string
}

/**
 * Every mention in a text with its position. Undecodable candidates are
 * dropped rather than reported, so a half-typed npub is not highlighted as a
 * person.
 */
export function findMentions(text: string): MentionSpan[] {
  const found: MentionSpan[] = []
  const pattern = mentionPattern()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const pubkey = mentionPubkey(match[1])
    if (pubkey) found.push({ from: match.index, to: match.index + match[0].length, pubkey })
  }
  return found
}

/**
 * The pubkeys a text mentions, each once, in the order they appear. NIP-27
 * asks clients to tag them so the mentioned person can find the event.
 */
export function collectMentions(text: string): string[] {
  return [...new Set(findMentions(text).map((span) => span.pubkey))]
}
