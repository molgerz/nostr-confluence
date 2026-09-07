import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { KINDS } from '../nostr/kinds'
import { client } from '../nostr/client'
import { DEFAULT_RELAY_URL, PROFILE_RELAYS } from '../nostr/relay-status'
import { createNip07Signer, getNip07Provider, waitForNip07 } from '../nostr/signer'
import type { Signer } from '../nostr/signer'
import { parseProfile, toNpub } from '../nostr/profile'
import type { Profile } from '../nostr/profile'

const STORAGE_KEY = 'nc-pubkey'

export type ExtensionState = 'checking' | 'available' | 'missing'

export type Session =
  | { status: 'anonymous' }
  | { status: 'signing-in' }
  | { status: 'signed-in'; pubkey: string; npub: string; signer: Signer; profile: Profile | null }

type SessionContextValue = {
  session: Session
  extension: ExtensionState
  error: string | null
  login: () => Promise<void>
  logout: () => void
  /**
   * Vor jedem Schreibvorgang aufrufen. Wechselt jemand in der Extension den
   * Account, darf nicht im Namen der alten Identität signiert werden.
   * docs/03-auth-nip07-nip42.md
   */
  ensureSamePubkey: () => Promise<{ ok: true } | { ok: false; reason: string }>
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readStoredPubkey(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw && /^[0-9a-f]{64}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

function storePubkey(pubkey: string | null): void {
  try {
    if (pubkey) localStorage.setItem(STORAGE_KEY, pubkey)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* Sitzung gilt dann nur bis zum Reload */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'anonymous' })
  const [extension, setExtension] = useState<ExtensionState>('checking')
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (pubkey: string) => {
    const relays = [DEFAULT_RELAY_URL, ...PROFILE_RELAYS]
    const event = await client.getOne(relays, { kinds: [KINDS.PROFILE], authors: [pubkey] })
    if (!event) return
    const profile = parseProfile(event)
    setSession((current) =>
      current.status === 'signed-in' && current.pubkey === pubkey
        ? { ...current, profile }
        : current,
    )
  }, [])

  // Extension erkennen und eine frühere Sitzung fortsetzen. getPublicKey wird
  // hier absichtlich NICHT aufgerufen: das öffnet einen Extension-Dialog und
  // gehört deshalb an einen Klick, nicht an den Seitenaufbau.
  useEffect(() => {
    let cancelled = false
    void waitForNip07().then((provider) => {
      if (cancelled) return
      setExtension(provider ? 'available' : 'missing')
      const stored = readStoredPubkey()
      if (provider && stored) {
        const signer = createNip07Signer(provider)
        client.setSigner(signer)
        setSession({
          status: 'signed-in',
          pubkey: stored,
          npub: toNpub(stored),
          signer,
          profile: null,
        })
        void loadProfile(stored)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loadProfile])

  const login = useCallback(async () => {
    setError(null)
    setSession({ status: 'signing-in' })
    try {
      const provider = getNip07Provider() ?? (await waitForNip07(3000))
      if (!provider) {
        setExtension('missing')
        setSession({ status: 'anonymous' })
        setError('Keine NIP-07-Extension gefunden.')
        return
      }
      setExtension('available')
      const signer = createNip07Signer(provider)
      const pubkey = await signer.getPublicKey()
      if (!/^[0-9a-f]{64}$/.test(pubkey)) throw new Error('Extension lieferte keinen gültigen Pubkey')
      storePubkey(pubkey)
      client.setSigner(signer)
      setSession({ status: 'signed-in', pubkey, npub: toNpub(pubkey), signer, profile: null })
      void loadProfile(pubkey)
    } catch (err) {
      setSession({ status: 'anonymous' })
      setError(err instanceof Error ? err.message : 'Anmeldung abgebrochen')
    }
  }, [loadProfile])

  const logout = useCallback(() => {
    storePubkey(null)
    client.setSigner(null)
    setSession({ status: 'anonymous' })
    setError(null)
  }, [])

  const ensureSamePubkey = useCallback(async (): Promise<
    { ok: true } | { ok: false; reason: string }
  > => {
    if (session.status !== 'signed-in') return { ok: false, reason: 'nicht angemeldet' }
    try {
      const current = await session.signer.getPublicKey()
      if (current !== session.pubkey) {
        // Kein stilles Weiterarbeiten: Sitzung auf die neue Identität umstellen.
        storePubkey(current)
        client.setSigner(session.signer)
        setSession({
          status: 'signed-in',
          pubkey: current,
          npub: toNpub(current),
          signer: session.signer,
          profile: null,
        })
        void loadProfile(current)
        return { ok: false, reason: 'In der Extension ist jetzt ein anderer Account aktiv.' }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Signer nicht erreichbar' }
    }
  }, [session, loadProfile])

  const value = useMemo(
    () => ({ session, extension, error, login, logout, ensureSamePubkey }),
    [session, extension, error, login, logout, ensureSamePubkey],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession braucht einen SessionProvider')
  return ctx
}
