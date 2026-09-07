import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { client } from './client'
import { KINDS } from './kinds'
import {
  GROUP_STATE_KINDS,
  parseAdmins,
  parseGroupMetadata,
  parseMembers,
} from '../domain/group-state'
import type { Admin, GroupMetadata } from '../domain/group-state'
import { parseRevision } from '../domain/revision'
import type { Revision } from '../domain/revision'
import { buildPages, buildTree } from '../domain/pages'
import type { Page, PageNode } from '../domain/pages'
import type { Event } from 'nostr-tools'

export type SpaceSnapshot = {
  loading: boolean
  metadata: GroupMetadata | null
  admins: Admin[]
  members: string[]
  pages: Page[]
  tree: PageNode[]
}

const EMPTY: SpaceSnapshot = {
  loading: true,
  metadata: null,
  admins: [],
  members: [],
  pages: [],
  tree: [],
}

/**
 * Hält den Zustand eines Spaces: den vom Relay erzeugten Gruppenzustand und
 * alle Revisions-Events. Seiten und Seitenbaum sind daraus abgeleitet — es
 * gibt kein separates Index-Event, das veralten könnte.
 * docs/02-data-model-events.md
 */
class SpaceStore {
  private snapshot: SpaceSnapshot = EMPTY
  private listeners = new Set<() => void>()
  private revisions = new Map<string, Revision>()
  private metadataEvent: Event | null = null
  private stop: (() => void)[] = []
  private generation = -1
  private eoseSeen = 0

  constructor(
    private relayUrl: string,
    private groupId: string,
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        // kurz warten: React montiert im StrictMode zweimal
        window.setTimeout(() => {
          if (this.listeners.size === 0) this.close()
        }, 500)
      }
    }
  }

  getSnapshot(): SpaceSnapshot {
    return this.snapshot
  }

  /** Nach einem Signer-Wechsel sind die Abos tot — neu aufbauen. */
  checkGeneration(): void {
    if (this.listeners.size > 0 && this.generation !== client.getGeneration()) this.start()
  }

  private start(): void {
    this.close()
    this.generation = client.getGeneration()
    this.eoseSeen = 0
    if (!this.snapshot.loading) this.emit({ loading: true })

    const onEose = () => {
      this.eoseSeen += 1
      if (this.eoseSeen >= 2) this.emit({ loading: false })
    }

    this.stop.push(
      client.subscribe(
        this.relayUrl,
        { kinds: [...GROUP_STATE_KINDS], '#d': [this.groupId] },
        (event) => this.applyGroupEvent(event),
        onEose,
      ),
      client.subscribe(
        this.relayUrl,
        { kinds: [KINDS.PAGE_REVISION], '#h': [this.groupId] },
        (event) => this.applyRevision(event),
        onEose,
      ),
    )
  }

  private close(): void {
    for (const stop of this.stop) stop()
    this.stop = []
  }

  private applyGroupEvent(event: Event): void {
    if (event.kind === KINDS.GROUP_METADATA) {
      if (this.metadataEvent && this.metadataEvent.created_at > event.created_at) return
      this.metadataEvent = event
      this.emit({ metadata: parseGroupMetadata(event, this.groupId) })
    } else if (event.kind === KINDS.GROUP_ADMINS) {
      this.emit({ admins: parseAdmins(event) })
    } else if (event.kind === KINDS.GROUP_MEMBERS) {
      this.emit({ members: parseMembers(event) })
    }
  }

  private applyRevision(event: Event): void {
    if (this.revisions.has(event.id)) return
    const revision = parseRevision(event, this.groupId)
    if (!revision) return
    this.revisions.set(event.id, revision)
    const pages = buildPages([...this.revisions.values()])
    this.emit({ pages, tree: buildTree(pages) })
  }

  private emit(change: Partial<SpaceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...change }
    for (const listener of this.listeners) listener()
  }
}

const stores = new Map<string, SpaceStore>()

export function getSpaceStore(relayUrl: string, groupId: string): SpaceStore {
  const key = `${relayUrl}'${groupId}`
  let store = stores.get(key)
  if (!store) {
    store = new SpaceStore(relayUrl, groupId)
    stores.set(key, store)
  }
  return store
}

export function useSpace(relayUrl: string, groupId: string): SpaceSnapshot {
  const store = getSpaceStore(relayUrl, groupId)
  // Muss memoisiert sein: bei einer neuen Funktionsidentität abonniert
  // useSyncExternalStore neu, was den Store neu starten liesse — Endlosschleife.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getSnapshot(), [store])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  // Nach Login/Logout müssen die Abos neu aufgebaut werden, weil AUTH pro
  // Verbindung gilt.
  useEffect(() => client.subscribeState(() => store.checkGeneration()), [store])
  return snapshot
}
