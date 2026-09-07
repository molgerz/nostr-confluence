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
import { parseComment } from '../domain/comment'
import type { Comment } from '../domain/comment'
import type { Event } from 'nostr-tools'

export type SpaceSnapshot = {
  loading: boolean
  metadata: GroupMetadata | null
  admins: Admin[]
  members: string[]
  pages: Page[]
  tree: PageNode[]
  comments: Comment[]
}

const EMPTY: SpaceSnapshot = {
  loading: true,
  metadata: null,
  admins: [],
  members: [],
  pages: [],
  tree: [],
  comments: [],
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
  private comments = new Map<string, Comment>()
  private metadataEvent: Event | null = null
  private stop: (() => void)[] = []
  private generation = -1
  private epoch = -1
  private eoseSeen = 0
  private groupEventAt = new Map<number, number>()

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

  /**
   * Ein vom Relay gelöschtes Event lokal vergessen. Das Relay teilt Löschungen
   * nicht aktiv mit, deshalb muss die auslösende Stelle Bescheid geben.
   */
  forget(eventId: string): void {
    const hadRevision = this.revisions.delete(eventId)
    const hadComment = this.comments.delete(eventId)
    if (hadRevision) {
      const pages = buildPages([...this.revisions.values()])
      this.emit({ pages, tree: buildTree(pages) })
    }
    if (hadComment) this.emit({ comments: [...this.comments.values()] })
  }

  /**
   * Abos sterben mit ihrer Verbindung und mit jedem Signer-Wechsel (AUTH gilt
   * pro Verbindung). Beides hier erkennen und neu aufsetzen — sonst zeigt die
   * App nach einem Relay-Neustart stillschweigend veraltete Daten.
   */
  checkConnection(): void {
    if (this.listeners.size === 0) return
    const epoch = client.getSnapshot(this.relayUrl).epoch
    if (this.generation !== client.getGeneration() || this.epoch !== epoch) this.start()
  }

  private start(): void {
    this.close()
    // Ohne Gruppen-ID gibt es nichts zu abonnieren (z. B. auf /login).
    if (this.groupId.length === 0) {
      if (this.snapshot.loading) this.emit({ loading: false })
      return
    }
    this.generation = client.getGeneration()
    this.epoch = client.getSnapshot(this.relayUrl).epoch
    this.eoseSeen = 0
    if (!this.snapshot.loading) this.emit({ loading: true })

    const onEose = () => {
      this.eoseSeen += 1
      if (this.eoseSeen >= 3) this.emit({ loading: false })
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
      client.subscribe(
        this.relayUrl,
        { kinds: [KINDS.COMMENT], '#h': [this.groupId] },
        (event) => this.applyComment(event),
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
      if (this.isOutdated(event)) return
      this.emit({ admins: parseAdmins(event) })
    } else if (event.kind === KINDS.GROUP_MEMBERS) {
      if (this.isOutdated(event)) return
      this.emit({ members: parseMembers(event) })
    }
  }

  /**
   * Relays liefern nicht zwingend in zeitlicher Reihenfolge. Ohne diese
   * Prüfung könnte eine ältere Mitgliederliste eine neuere überschreiben.
   */
  private isOutdated(event: Event): boolean {
    const seen = this.groupEventAt.get(event.kind)
    if (seen !== undefined && seen > event.created_at) return true
    this.groupEventAt.set(event.kind, event.created_at)
    return false
  }

  private applyRevision(event: Event): void {
    if (this.revisions.has(event.id)) return
    const revision = parseRevision(event, this.groupId)
    if (!revision) return
    this.revisions.set(event.id, revision)
    const pages = buildPages([...this.revisions.values()])
    this.emit({ pages, tree: buildTree(pages) })
  }

  private applyComment(event: Event): void {
    if (this.comments.has(event.id)) return
    const comment = parseComment(event, this.groupId)
    if (!comment) return
    this.comments.set(event.id, comment)
    this.emit({ comments: [...this.comments.values()] })
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

/** Ein gelöschtes Event aus dem lokalen Zustand entfernen. */
export function forgetEvent(relayUrl: string, groupId: string, eventId: string): void {
  getSpaceStore(relayUrl, groupId).forget(eventId)
}

export function useSpace(relayUrl: string, groupId: string): SpaceSnapshot {
  const store = getSpaceStore(relayUrl, groupId)
  // Muss memoisiert sein: bei einer neuen Funktionsidentität abonniert
  // useSyncExternalStore neu, was den Store neu starten liesse — Endlosschleife.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getSnapshot(), [store])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  // Nach Login/Logout und nach jedem Reconnect müssen die Abos neu aufgebaut
  // werden.
  useEffect(() => client.subscribeState(() => store.checkConnection()), [store])
  return snapshot
}
