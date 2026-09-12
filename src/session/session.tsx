import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { KINDS } from '../nostr/kinds'
import { client } from '../nostr/client'
import { DEFAULT_RELAY_URL, PROFILE_RELAYS } from '../nostr/relay-status'
import { createNip07Signer, getNip07Provider, waitForNip07 } from '../nostr/signer'
import type { Signer } from '../nostr/signer'
import { connectBunker, connectNostrConnect, restoreNip46Session } from '../nostr/nip46'
import type { NostrConnectOffer } from '../nostr/nip46'
import { clearNip46Session, readNip46Session, storeNip46Session } from './nip46-store'
import { parseProfile, toNpub } from '../nostr/profile'
import { cacheProfile } from '../nostr/profile-store'
import { clearAllSpaces } from '../nostr/space-store'
import type { Profile } from '../nostr/profile'

const STORAGE_KEY = 'nc-pubkey'

export type ExtensionState = 'checking' | 'available' | 'missing'

export type Session =
  | { status: 'anonymous' }
  | { status: 'signing-in' }
  | {
      status: 'signed-in'
      pubkey: string
      npub: string
      signer: Signer
      profile: Profile | null
      /** Relays of a NIP-46 signer, empty for a NIP-07 extension. */
      relays: string[]
    }

type SessionContextValue = {
  session: Session
  extension: ExtensionState
  error: string | null
  /** Sign in with a browser extension (`window.nostr`, NIP-07). */
  loginWithNip07: () => Promise<void>
  /** Connect a remote signer from a `bunker://` URI or NIP-05 address. */
  loginWithBunker: (input: string) => Promise<void>
  /** Wait for a signer to answer a client-initiated `nostrconnect://` offer. */
  loginWithNostrConnect: (offer: NostrConnectOffer, signal: AbortSignal) => Promise<void>
  logout: () => void
  /** dismiss the sign-in error shown by SessionNotice */
  clearError: () => void
  /**
   * Call before every write. If somebody switches accounts in the extension,
   * we must not keep signing in the name of the old identity.
   * docs/03-auth-nip07-nip42.md
   */
  ensureSamePubkey: () => Promise<{ ok: true } | { ok: false; reason: string }>
  /**
   * Take over a profile that was just published, without asking a relay again.
   * A read straight after the write races the relay's indexing, and the answer
   * we would get back is the one we already hold.
   */
  applyProfile: (profile: Profile) => void
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
    /* the session then only lasts until the next reload */
  }
}

/**
 * The single way to change identity: sign in, sign out, and the account switch
 * in the extension all go through here. Whatever a space still holds belongs to
 * the npub that fetched it — a private group's pages must not stay on screen or
 * in the search under the identity that follows.
 *
 * The order is not interchangeable. `setSigner` closes the connection first, so
 * the resubscribe inside `clearAllSpaces` can only ever run against a socket
 * that is no longer authenticated as the previous npub. Clearing first would
 * subscribe while the old AUTH still stands and let the events we just dropped
 * come straight back.
 */
function switchIdentity(signer: Signer | null): void {
  client.setSigner(signer)
  clearAllSpaces()
}

/** What another tab's change to the stored pubkey means for this one. */
export type TabSync =
  | { action: 'ignore' }
  | { action: 'sign-out' }
  | { action: 'adopt'; pubkey: string }

/**
 * Signing out is meant to end the session on this machine, not in the one tab
 * it was clicked in — a second tab that keeps a space on screen (and, through
 * `ensureSamePubkey`, keeps writing to it) defeats the point of the button.
 *
 * Pure so the table can be read in one go, because a wrong branch here fails
 * quietly: the tab simply stays signed in and nobody finds out.
 */
export function tabSync(
  /** the changed key, `null` when the whole storage was cleared at once */
  key: string | null,
  /** what the storage says now */
  stored: string | null,
  /** the pubkey this tab is signed in with, `null` when it is not */
  current: string | null,
  /**
   * Whether this tab can sign as `stored` at all — a NIP-07 extension is
   * present, or the stored NIP-46 client can reach its bunker. Without either,
   * adopting a new identity would mean writing as somebody we cannot sign for.
   */
  canSignAsStored: boolean,
): TabSync {
  if (key !== null && key !== STORAGE_KEY) return { action: 'ignore' }
  if (stored === null) return current === null ? { action: 'ignore' } : { action: 'sign-out' }
  if (stored === current) return { action: 'ignore' }
  // Somebody else's session now owns this machine. Without a way to sign for
  // them this tab cannot act as them, and staying with the previous identity
  // is the one thing it must not do.
  return canSignAsStored ? { action: 'adopt', pubkey: stored } : { action: 'sign-out' }
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

  /** The one place a signer becomes the session — every entry point uses it. */
  const activate = useCallback(
    (signer: Signer, pubkey: string, relays: string[]) => {
      switchIdentity(signer)
      setSession({ status: 'signed-in', pubkey, npub: toNpub(pubkey), signer, profile: null, relays })
      void loadProfile(pubkey)
    },
    [loadProfile],
  )

  // Detect the extension and resume an earlier session. getPublicKey is
  // deliberately NOT called here: it opens an extension dialog and therefore
  // belongs on a click, not on page load. A stored NIP-46 session is rebuilt
  // the same way — from the client key on disk, without a remote call.
  useEffect(() => {
    let cancelled = false
    void waitForNip07().then(async (provider) => {
      if (cancelled) return
      setExtension(provider ? 'available' : 'missing')
      const stored = readStoredPubkey()
      if (!stored) {
        // A bunker pointer without the identity it belongs to is unusable.
        if (readNip46Session()) clearNip46Session()
        return
      }
      const remote = readNip46Session()
      if (remote && remote.pubkey === stored) {
        try {
          const signer = await restoreNip46Session(remote)
          if (cancelled) {
            void signer.close?.()
            return
          }
          activate(signer, stored, remote.relays)
          return
        } catch {
          // The channel could not be rebuilt (corrupt client key, no pool).
          // Fall through: an extension can still take over, otherwise the
          // session stays anonymous and the user connects again.
          clearNip46Session()
        }
      } else if (remote) {
        // `nc-pubkey` and `nc-nip46` disagree; neither can be trusted.
        clearNip46Session()
      }
      if (provider) activate(createNip07Signer(provider), stored, [])
    })
    return () => {
      cancelled = true
    }
  }, [activate])

  // Follow the other tabs. The storage event fires only in the tabs that did
  // not make the change, which is exactly the reach this needs. Best effort,
  // not a guarantee: it needs localStorage to work (a private window may
  // refuse it) and a tab whose scripts are actually running, so nothing may be
  // built on top of it as if it were a lock.
  const currentPubkey = session.status === 'signed-in' ? session.pubkey : null

  /** Adopt the identity another tab signed in with, without a remote call. */
  const adopt = useCallback(
    async (pubkey: string) => {
      const remote = readNip46Session()
      if (remote && remote.pubkey === pubkey) {
        try {
          const signer = await restoreNip46Session(remote)
          activate(signer, pubkey, remote.relays)
          return
        } catch {
          clearNip46Session()
        }
      }
      const provider = getNip07Provider()
      if (!provider) return
      activate(createNip07Signer(provider), pubkey, [])
    },
    [activate],
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      const stored = readStoredPubkey()
      const remote = readNip46Session()
      // `nc-nip46` alone is not a session change (it carries no npub), so the
      // pure table only watches `nc-pubkey`; that write is what this test sees.
      const canSign = getNip07Provider() !== null || (remote !== null && remote.pubkey === stored)
      const sync = tabSync(event.key, stored, currentPubkey, canSign)
      if (sync.action === 'ignore') return
      if (sync.action === 'sign-out') {
        switchIdentity(null)
        setSession({ status: 'anonymous' })
        setError(null)
        return
      }
      void adopt(sync.pubkey)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [currentPubkey, adopt])

  const loginWithNip07 = useCallback(async () => {
    setError(null)
    setSession({ status: 'signing-in' })
    try {
      const provider = getNip07Provider() ?? (await waitForNip07(3000))
      if (!provider) {
        setExtension('missing')
        setSession({ status: 'anonymous' })
        setError('No NIP-07 extension found.')
        return
      }
      setExtension('available')
      const signer = createNip07Signer(provider)
      const pubkey = await signer.getPublicKey()
      if (!/^[0-9a-f]{64}$/.test(pubkey)) throw new Error('the extension returned no valid pubkey')
      // A NIP-07 sign-in replaces any remote session: `nc-nip46` must never
      // outlive the identity it was made for.
      clearNip46Session()
      storePubkey(pubkey)
      activate(signer, pubkey, [])
    } catch (err) {
      setSession({ status: 'anonymous' })
      setError(err instanceof Error ? err.message : 'sign-in was cancelled')
    }
  }, [activate])

  const loginWithBunker = useCallback(
    async (input: string) => {
      setError(null)
      setSession({ status: 'signing-in' })
      try {
        const connection = await connectBunker(input)
        storeNip46Session(connection.session)
        storePubkey(connection.pubkey)
        activate(connection.signer, connection.pubkey, connection.session.relays)
      } catch (err) {
        setSession({ status: 'anonymous' })
        setError(err instanceof Error ? err.message : 'the remote signer could not be reached')
      }
    },
    [activate],
  )

  const loginWithNostrConnect = useCallback(
    async (offer: NostrConnectOffer, signal: AbortSignal) => {
      setError(null)
      setSession({ status: 'signing-in' })
      try {
        const connection = await connectNostrConnect(offer, signal)
        storeNip46Session(connection.session)
        storePubkey(connection.pubkey)
        activate(connection.signer, connection.pubkey, connection.session.relays)
      } catch (err) {
        setSession({ status: 'anonymous' })
        // A cancel is not a failure; the user chose to stop waiting.
        if (signal.aborted) return
        setError(err instanceof Error ? err.message : 'the remote signer did not connect')
      }
    },
    [activate],
  )

  const logout = useCallback(() => {
    const signer = session.status === 'signed-in' ? session.signer : null
    storePubkey(null)
    // The local client key is the one secret this app holds; sign-out drops it.
    clearNip46Session()
    switchIdentity(null)
    setSession({ status: 'anonymous' })
    setError(null)
    // Best effort good-bye to the bunker. It must never delay sign-out, and a
    // bunker that does not implement `logout` is not an error either.
    if (signer?.close) void signer.close().catch(() => undefined)
  }, [session])

  const ensureSamePubkey = useCallback(async (): Promise<
    { ok: true } | { ok: false; reason: string }
  > => {
    if (session.status !== 'signed-in') return { ok: false, reason: 'not signed in' }
    try {
      const current = await session.signer.getPublicKey()
      if (current !== session.pubkey) {
        // No silent continuation: switch the session to the new identity. The
        // signer object is the same one — it is the extension behind it that
        // now answers as somebody else, which is a full identity change.
        storePubkey(current)
        switchIdentity(session.signer)
        setSession({
          status: 'signed-in',
          pubkey: current,
          npub: toNpub(current),
          signer: session.signer,
          profile: null,
          relays: session.relays,
        })
        void loadProfile(current)
        const reason = 'A different account is now active in the extension.'
        // Also on the session banner, not only back to the caller. Switching
        // identity empties the spaces, so the view that asked — an open editor,
        // say — may be gone by the time it could show anything: its page is no
        // longer in the store. The one explanation for a write that did not
        // happen must not be unmounted along with it.
        setError(reason)
        return { ok: false, reason }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'signer unreachable' }
    }
  }, [session, loadProfile])

  const clearError = useCallback(() => setError(null), [])

  const applyProfile = useCallback(
    (profile: Profile) => {
      if (session.status !== 'signed-in') return
      // The byline cache lives outside React and never expires by itself.
      cacheProfile(session.pubkey, profile)
      setSession((current) =>
        current.status === 'signed-in' ? { ...current, profile } : current,
      )
    },
    [session],
  )

  const value = useMemo(
    () => ({
      session,
      extension,
      error,
      loginWithNip07,
      loginWithBunker,
      loginWithNostrConnect,
      logout,
      clearError,
      ensureSamePubkey,
      applyProfile,
    }),
    [
      session,
      extension,
      error,
      loginWithNip07,
      loginWithBunker,
      loginWithNostrConnect,
      logout,
      clearError,
      ensureSamePubkey,
      applyProfile,
    ],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession needs a SessionProvider')
  return ctx
}
