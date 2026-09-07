import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { client } from './client'
import { KINDS } from './kinds'
import { parseProfile } from './profile'
import type { Profile } from './profile'
import { DEFAULT_RELAY_URL, PROFILE_RELAYS } from './relay-status'

/**
 * Profiles (kind 0) for display names and avatars.
 *
 * Requests are collected and sent in batches, otherwise a page with thirty
 * bylines fires thirty REQs. A real NIP-29 relay does not accept kind 0 (every
 * event needs an h tag there), so profiles usually come from the user's own
 * relays — configurable through VITE_PROFILE_RELAYS. Without configuration it
 * stays at the npub, which is more honest than an invented name.
 */
type Entry = Profile | null

class ProfileStore {
  private cache = new Map<string, Entry>()
  private wanted = new Set<string>()
  private inFlight = new Set<string>()
  private listeners = new Set<() => void>()
  private timer: number | undefined

  private relays(): string[] {
    return [...new Set([DEFAULT_RELAY_URL, ...PROFILE_RELAYS])]
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** undefined = not answered yet, null = asked but nothing there */
  get(pubkey: string | null): Entry | undefined {
    if (!pubkey) return null
    return this.cache.get(pubkey)
  }

  request(pubkey: string): void {
    if (this.cache.has(pubkey) || this.inFlight.has(pubkey) || this.wanted.has(pubkey)) return
    this.wanted.add(pubkey)
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.flush(), 120)
  }

  private flush(): void {
    const batch = [...this.wanted].slice(0, 100)
    if (batch.length === 0) return
    for (const pubkey of batch) {
      this.wanted.delete(pubkey)
      this.inFlight.add(pubkey)
    }

    const found = new Map<string, { profile: Profile; createdAt: number }>()
    const finish = () => {
      for (const pubkey of batch) {
        this.inFlight.delete(pubkey)
        this.cache.set(pubkey, found.get(pubkey)?.profile ?? null)
      }
      close()
      for (const listener of this.listeners) listener()
      if (this.wanted.size > 0) this.flush()
    }

    const timeout = window.setTimeout(finish, 5000)
    const close = client.subscribeAcross(
      this.relays(),
      { kinds: [KINDS.PROFILE], authors: batch },
      (event) => {
        const seen = found.get(event.pubkey)
        // Different relays may return profiles of different ages
        if (seen && seen.createdAt >= event.created_at) return
        found.set(event.pubkey, { profile: parseProfile(event), createdAt: event.created_at })
      },
      () => {
        window.clearTimeout(timeout)
        finish()
      },
    )
  }
}

const store = new ProfileStore()

export function useProfile(pubkey: string | null): Profile | null {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [])
  const getSnapshot = useCallback(() => store.get(pubkey), [pubkey])
  const entry = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (pubkey) store.request(pubkey)
  }, [pubkey])

  return entry ?? null
}
