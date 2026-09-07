import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import type { EventTemplate } from 'nostr-tools'

const DEV_KEY_STORAGE = 'nc-dev-nsec'

/**
 * DEVELOPMENT ONLY. Installs a window.nostr that signs with a throwaway key so
 * that the whole sign-in and AUTH path can be tested without a browser
 * extension (including automated tests).
 *
 * Loaded exclusively when import.meta.env.DEV holds AND the URL contains
 * ?devsigner — this file does not exist in a production bundle.
 */
export function installFakeNip07(input?: string | null): string {
  let secret: Uint8Array

  const stored = readStoredKey()
  if (input && input !== 'true' && input.length > 0) {
    secret = parseKey(input)
  } else if (stored) {
    secret = stored
  } else {
    secret = generateSecretKey()
  }

  try {
    localStorage.setItem(DEV_KEY_STORAGE, nip19.nsecEncode(secret))
  } catch {
    /* then the key only lasts for this session */
  }

  const pubkey = getPublicKey(secret)
  window.nostr = {
    getPublicKey: async () => pubkey,
    signEvent: async (template: EventTemplate) => finalizeEvent(template, secret),
    getRelays: async () => ({}),
  }
  console.warn(`[dev] window.nostr replaced by throwaway signer ${nip19.npubEncode(pubkey)}`)
  return pubkey
}

function parseKey(input: string): Uint8Array {
  if (input.startsWith('nsec')) {
    const decoded = nip19.decode(input)
    if (decoded.type !== 'nsec') throw new Error('not an nsec')
    return decoded.data
  }
  if (/^[0-9a-f]{64}$/.test(input)) {
    return Uint8Array.from(input.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)))
  }
  throw new Error('devsigner expects an nsec or 64 hex characters')
}

function readStoredKey(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(DEV_KEY_STORAGE)
    if (!raw) return null
    return parseKey(raw)
  } catch {
    return null
  }
}
