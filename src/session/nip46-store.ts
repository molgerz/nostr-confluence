import { isHex32 } from 'nostr-tools/utils'

/**
 * What a reload needs to rebuild the remote-signer channel: the throwaway
 * client key that talks to the bunker, where the bunker is, and which identity
 * this connection signs as.
 *
 * This is **not** the identity key. Lost or corrupted, it costs one new
 * connection; it can never be used to sign as the user on its own. It is
 * stored anyway, because the ticket requires the session to survive a reload
 * and because a phone is not always at hand to re-approve one.
 *
 * Separate from `nc-pubkey`: that stays the single statement of *which npub
 * is signed in* so tab-sync and the space stores keep working; this key only
 * carries how to reach the signer.
 */
export const NIP46_STORAGE_KEY = 'nc-nip46'

export type Nip46Session = {
  version: 1
  /** Hex secret key of the local client; generated once per connection. */
  clientSecret: string
  /** Hex pubkey of the remote signer (the `bunker://` authority). */
  bunkerPubkey: string
  relays: string[]
  /** Optional shared secret from the bunker pointer, echoed on `connect`. */
  secret: string | null
  /** The identity pubkey the remote signer answered with at login. */
  pubkey: string
}

function isRelayList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.length > 0)
  )
}

/**
 * Returns null for anything that is not a complete, plausible session —
 * malformed JSON, an older shape, a truncated key, an empty relay list. The
 * mount effect must never throw on a value the user or an older build left in
 * storage; the only honest answer to it is "no remote session".
 */
export function readNip46Session(): Nip46Session | null {
  try {
    const raw = localStorage.getItem(NIP46_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as Record<string, unknown>
    if (value.version !== 1) return null
    if (typeof value.clientSecret !== 'string' || !isHex32(value.clientSecret)) return null
    if (typeof value.bunkerPubkey !== 'string' || !isHex32(value.bunkerPubkey)) return null
    if (typeof value.pubkey !== 'string' || !isHex32(value.pubkey)) return null
    if (!isRelayList(value.relays)) return null
    if (value.secret !== null && typeof value.secret !== 'string') return null
    return {
      version: 1,
      clientSecret: value.clientSecret,
      bunkerPubkey: value.bunkerPubkey,
      relays: value.relays,
      secret: value.secret,
      pubkey: value.pubkey,
    }
  } catch {
    return null
  }
}

export function storeNip46Session(session: Nip46Session): void {
  try {
    localStorage.setItem(NIP46_STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* the session then only lasts until the next reload */
  }
}

export function clearNip46Session(): void {
  try {
    localStorage.removeItem(NIP46_STORAGE_KEY)
  } catch {
    /* nothing stored, nothing to clear */
  }
}
