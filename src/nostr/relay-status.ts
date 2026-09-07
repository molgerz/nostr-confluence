import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { client } from './client'
import type { RelaySnapshot } from './client'

export type RelayInfo = {
  name: string
  software: string | null
  supportedNips: number[]
  /** Setzt das Relay Gruppen selbst durch, oder simulieren wir sie nur? */
  supportsNip29: boolean
}

function httpUrl(relayUrl: string): string {
  return relayUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
}

async function fetchRelayInfo(relayUrl: string, signal: AbortSignal): Promise<RelayInfo | null> {
  try {
    const res = await fetch(httpUrl(relayUrl), {
      headers: { Accept: 'application/nostr+json' },
      signal,
    })
    if (!res.ok) return null
    const doc: unknown = await res.json()
    if (typeof doc !== 'object' || doc === null) return null
    const data = doc as Record<string, unknown>
    const nips = Array.isArray(data.supported_nips)
      ? data.supported_nips.filter((nip): nip is number => typeof nip === 'number')
      : []
    return {
      name: typeof data.name === 'string' ? data.name : new URL(httpUrl(relayUrl)).host,
      software: typeof data.software === 'string' ? data.software : null,
      supportedNips: nips,
      supportsNip29: nips.includes(29),
    }
  } catch {
    return null
  }
}

/** Verbindung offenhalten und Zustand plus NIP-11-Dokument liefern. */
export function useRelay(relayUrl: string): { snapshot: RelaySnapshot; info: RelayInfo | null } {
  const subscribe = useCallback((listener: () => void) => client.subscribeState(listener), [])
  const getSnapshot = useCallback(() => client.getSnapshot(relayUrl), [relayUrl])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  const [info, setInfo] = useState<RelayInfo | null>(null)

  useEffect(() => client.want(relayUrl), [relayUrl])

  useEffect(() => {
    const abort = new AbortController()
    setInfo(null)
    void fetchRelayInfo(relayUrl, abort.signal).then((result) => {
      if (result) setInfo(result)
    })
    return () => abort.abort()
  }, [relayUrl])

  return { snapshot, info }
}

/**
 * Relay aus der Umgebung. Default ist das lokale NIP-29-Relay aus
 * scripts/dev-relay-up.sh — nicht ein dummes Testrelay, damit lokal dieselbe
 * Rechtelogik gilt wie produktiv. docs/08-relay-setup.md
 */
export const DEFAULT_RELAY_URL: string = import.meta.env.VITE_RELAY_URL ?? 'ws://localhost:8080'

/**
 * Relays für Kind-0-Profile. Leer per Default: im lokalen Betrieb liegen die
 * Profile der Testschlüssel auf dem Testrelay, und ungefragte Verbindungen zu
 * öffentlichen Relays soll die App nicht aufbauen.
 * Beispiel: VITE_PROFILE_RELAYS="wss://purplepag.es,wss://relay.damus.io"
 */
export const PROFILE_RELAYS: string[] = (import.meta.env.VITE_PROFILE_RELAYS ?? '')
  .split(',')
  .map((url: string) => url.trim())
  .filter((url: string) => url.length > 0)
