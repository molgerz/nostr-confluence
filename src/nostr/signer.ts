import type { Event, EventTemplate } from 'nostr-tools'

/**
 * Signer-Abstraktion. NIP-07 ist die einzige Implementierung in Phase 1;
 * NIP-46 (Bunker) kommt später als zweite Implementierung hinter demselben
 * Interface, damit daraus kein Umbau wird. docs/03-auth-nip07-nip42.md
 */
export type SignerKind = 'nip07' | 'nip46' | 'dev'

export interface Signer {
  readonly kind: SignerKind
  getPublicKey(): Promise<string>
  /** Gibt ein fertiges Event mit id und sig zurück. Der private Schlüssel
   *  verlässt die Extension nie. Verifiziert wird in der Datenschicht. */
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
 * Extensions injizieren window.nostr asynchron — direkt beim Mount ist es
 * häufig noch nicht da. Deshalb kurz pollen statt einmal prüfen.
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
