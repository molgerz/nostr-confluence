import type { Event, EventTemplate } from 'nostr-tools'

/**
 * Signer abstraction: a browser extension (NIP-07) and a remote signer
 * (NIP-46, src/nostr/nip46.ts) implement the same three members, so the rest
 * of the app never learns which one is behind them.
 * docs/03-auth-nip07-nip42.md
 */
export type SignerKind = 'nip07' | 'nip46' | 'dev'

export interface Signer {
  readonly kind: SignerKind
  getPublicKey(): Promise<string>
  /** Returns a finished event with id and sig. The private key never leaves
   *  the extension or the remote signer. Verification happens in the data
   *  layer. */
  signEvent(template: EventTemplate): Promise<Event>
  /**
   * Ends the underlying channel. A NIP-46 signer owns a relay subscription;
   * sign-out best-effort closes it. NIP-07 has nothing to close.
   */
  close?(): Promise<void>
}

export type Nip07Provider = {
  getPublicKey(): Promise<string>
  signEvent(event: EventTemplate): Promise<Event>
  getRelays?: () => Promise<Record<string, { read: boolean; write: boolean }>>
}

declare global {
  interface Window {
    nostr?: Nip07Provider
  }
}

export function getNip07Provider(): Nip07Provider | null {
  return typeof window !== 'undefined' && window.nostr ? window.nostr : null
}

/**
 * Extensions inject window.nostr asynchronously — right after mounting it is
 * often not there yet. So poll briefly instead of checking once.
 */
export async function waitForNip07(timeoutMs = 1500, intervalMs = 100): Promise<Nip07Provider | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const provider = getNip07Provider()
    if (provider) return provider
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

export function createNip07Signer(provider: Nip07Provider): Signer {
  return {
    kind: 'nip07',
    getPublicKey: () => provider.getPublicKey(),
    signEvent: (template) => provider.signEvent(template),
  }
}
