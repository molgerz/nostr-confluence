import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import type { EventTemplate } from 'nostr-tools'

const DEV_KEY_STORAGE = 'nc-dev-nsec'

/**
 * NUR FÜR DIE ENTWICKLUNG. Installiert ein window.nostr, das mit einem
 * Wegwerf-Schlüssel signiert, damit der komplette Login- und AUTH-Pfad ohne
 * Browser-Extension testbar ist (auch automatisiert).
 *
 * Wird ausschliesslich geladen, wenn import.meta.env.DEV gilt UND die URL
 * ?devsigner enthält — im Produktionsbundle existiert diese Datei nicht.
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
    /* dann gilt der Schlüssel nur für diese Sitzung */
  }

  const pubkey = getPublicKey(secret)
  window.nostr = {
    getPublicKey: async () => pubkey,
    signEvent: async (template: EventTemplate) => finalizeEvent(template, secret),
    getRelays: async () => ({}),
  }
  console.warn(`[dev] window.nostr ersetzt durch Wegwerf-Signer ${nip19.npubEncode(pubkey)}`)
  return pubkey
}

function parseKey(input: string): Uint8Array {
  if (input.startsWith('nsec')) {
    const decoded = nip19.decode(input)
    if (decoded.type !== 'nsec') throw new Error('kein nsec')
    return decoded.data
  }
  if (/^[0-9a-f]{64}$/.test(input)) {
    return Uint8Array.from(input.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)))
  }
  throw new Error('devsigner erwartet ein nsec oder 64 Hex-Zeichen')
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
