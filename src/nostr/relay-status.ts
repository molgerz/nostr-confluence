import { useEffect, useRef, useState } from 'react'

/**
 * Verbindungszustand eines Relays plus dessen NIP-11-Dokument.
 *
 * Phase 0 nutzt absichtlich keine Nostr-Bibliothek: die Entscheidung zwischen
 * NDK und nostr-tools ist laut docs/07-tech-stack.md ein Spike in Phase 1.
 * Für "verbunden ja/nein" reicht ein WebSocket, und die Wahl bleibt offen.
 */
export type RelayState = 'connecting' | 'online' | 'offline'

export type RelayInfo = {
  name: string
  software: string | null
  supportedNips: number[]
  /** Kann das Relay Gruppen selbst durchsetzen, oder simulieren wir nur? */
  supportsNip29: boolean
}

export type RelayStatus = {
  state: RelayState
  info: RelayInfo | null
  attempts: number
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
    const d = doc as Record<string, unknown>
    const nips = Array.isArray(d.supported_nips)
      ? d.supported_nips.filter((n): n is number => typeof n === 'number')
      : []
    return {
      name: typeof d.name === 'string' ? d.name : new URL(httpUrl(relayUrl)).host,
      software: typeof d.software === 'string' ? d.software : null,
      supportedNips: nips,
      supportsNip29: nips.includes(29),
    }
  } catch {
    return null
  }
}

export function useRelayStatus(relayUrl: string): RelayStatus {
  const [state, setState] = useState<RelayState>('connecting')
  const [info, setInfo] = useState<RelayInfo | null>(null)
  const [attempts, setAttempts] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let tries = 0
    const abort = new AbortController()

    setState('connecting')
    setInfo(null)
    setAttempts(0)

    void fetchRelayInfo(relayUrl, abort.signal).then((result) => {
      if (!cancelled && result) setInfo(result)
    })

    const connect = () => {
      if (cancelled) return
      try {
        socket = new WebSocket(relayUrl)
      } catch {
        scheduleRetry()
        return
      }
      socket.onopen = () => {
        if (cancelled) return
        tries = 0
        setAttempts(0)
        setState('online')
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (cancelled) return
        setState('offline')
        scheduleRetry()
      }
    }

    const scheduleRetry = () => {
      tries += 1
      setAttempts(tries)
      const delay = Math.min(1000 * 2 ** (tries - 1), 15000)
      timer.current = window.setTimeout(connect, delay)
    }

    connect()

    return () => {
      cancelled = true
      abort.abort()
      window.clearTimeout(timer.current)
      if (socket) {
        socket.onclose = null
        socket.onerror = null
        socket.close()
      }
    }
  }, [relayUrl])

  return { state, info, attempts }
}

/** Relay aus der Umgebung, Default ist das lokale nak-Testrelay. */
export const DEFAULT_RELAY_URL: string =
  import.meta.env.VITE_RELAY_URL ?? 'ws://localhost:10577'
