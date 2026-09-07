import { nip19 } from 'nostr-tools'
import type { Event } from 'nostr-tools'

/** Kind-0-Inhalt, so weit wir ihn anzeigen. Alles optional — fremde Daten. */
export type Profile = {
  name?: string
  displayName?: string
  picture?: string
  about?: string
}

export function parseProfile(event: Event): Profile {
  try {
    const raw: unknown = JSON.parse(event.content)
    if (typeof raw !== 'object' || raw === null) return {}
    const data = raw as Record<string, unknown>
    const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)
    return {
      name: str(data.name),
      displayName: str(data.display_name) ?? str(data.displayName),
      picture: str(data.picture),
      about: str(data.about),
    }
  } catch {
    return {}
  }
}

export function toNpub(pubkeyHex: string): string {
  try {
    return nip19.npubEncode(pubkeyHex)
  } catch {
    return pubkeyHex
  }
}

/** npub1abcd…wxyz — kurz genug für die Byline, lang genug zum Vergleichen. */
export function shortNpub(npub: string): string {
  return npub.length > 20 ? `${npub.slice(0, 10)}…${npub.slice(-6)}` : npub
}

/**
 * Anzeigenamen sind frei wählbar und nicht eindeutig. Die UI zeigt sie nur
 * zusammen mit dem npub — nie allein. docs/06-ui-information-architecture.md
 */
export function displayName(profile: Profile | null, npub: string): string {
  return profile?.displayName ?? profile?.name ?? shortNpub(npub)
}
