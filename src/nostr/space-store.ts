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
import { newerPlacement, parsePlacement } from '../domain/placement'
import type { Placement } from '../domain/placement'
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
 * Holds the state of one space: the group state produced by the relay and all
 * revision events. Pages and the page tree are derived from those — there is no
 * separate index event that could go stale.
 * docs/02-data-model-events.md
 */
class SpaceStore {
  private snapshot: SpaceSnapshot = EMPTY
  private listeners = new Set<() => void>()
  private revisions = new Map<string, Revision>()
  /** the winning placement per slug — src/domain/placement.ts */
  private placements = new Map<string, Placement>()
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
        // wait briefly: React mounts twice in StrictMode
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
   * Forget an event the relay deleted. The relay does not announce deletions,
   * so whoever triggered it has to tell us.
   */
  forget(eventId: string): void {
    const hadRevision = this.revisions.delete(eventId)
    const hadComment = this.comments.delete(eventId)
    if (hadRevision) this.rebuildPages()
    if (hadComment) this.emit({ comments: [...this.comments.values()] })
  }

  private rebuildPages(): void {
    const pages = buildPages([...this.revisions.values()], this.placements)
    this.emit({ pages, tree: buildTree(pages) })
  }

  /**
   * Subscriptions die with their connection and with every signer change (AUTH
   * is per connection). Detect both here and set them up again — otherwise the
   * app silently shows stale data after a relay restart.
   */
  checkConnection(): void {
    if (this.listeners.size === 0) return
    const epoch = client.getSnapshot(this.relayUrl).epoch
    if (this.generation !== client.getGeneration() || this.epoch !== epoch) this.start()
  }

  private start(): void {
    this.close()
    // Without a group id there is nothing to subscribe to (e.g. on /login).
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
      if (this.eoseSeen >= 4) this.emit({ loading: false })
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
      client.subscribe(
        this.relayUrl,
        { kinds: [KINDS.PAGE_PLACEMENT], '#h': [this.groupId] },
        (event) => this.applyPlacement(event),
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
   * Relays do not necessarily deliver in chronological order. Without this
   * check an older member list could overwrite a newer one.
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
    this.rebuildPages()
  }

  /**
   * Addressable events are replaced per author, so a page can have one
   * placement per pubkey. Keep the one that counts instead of whichever
   * arrived last — relays deliver in no particular order.
   */
  private applyPlacement(event: Event): void {
    const placement = parsePlacement(event, this.groupId)
    if (!placement) return
    const current = this.placements.get(placement.slug)
    const winner = current ? newerPlacement(current, placement) : placement
    if (current && winner.id === current.id) return
    this.placements.set(placement.slug, winner)
    this.rebuildPages()
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

/** Removes a deleted event from the local state. */
export function forgetEvent(relayUrl: string, groupId: string, eventId: string): void {
  getSpaceStore(relayUrl, groupId).forget(eventId)
}

export function useSpace(relayUrl: string, groupId: string): SpaceSnapshot {
  const store = getSpaceStore(relayUrl, groupId)
  // Has to be memoised: with a new function identity useSyncExternalStore
  // resubscribes, which would restart the store — an endless loop.
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getSnapshot = useCallback(() => store.getSnapshot(), [store])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot)
  // After sign-in/sign-out and after every reconnect the subscriptions have to
  // be rebuilt.
  useEffect(() => client.subscribeState(() => store.checkConnection()), [store])
  return snapshot
}
