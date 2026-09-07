import type { Event, EventTemplate } from 'nostr-tools'

/**
 * Signer abstraction. NIP-07 is the only implementation in phase 1; NIP-46
 * (bunker) will arrive later as a second implementation behind the same
 * interface, so that it is not a rewrite. docs/03-auth-nip07-nip42.md
 */
export type SignerKind = 'nip07' | 'nip46' | 'dev'

export interface Signer {
  readonly kind: SignerKind
  getPublicKey(): Promise<string>
  /** Returns a finished event with id and sig. The private key never leaves
   *  the extension. Verification happens in the data layer. */
  signEvent(template: EventTemplate): Promise<Event>
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
