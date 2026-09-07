import { KINDS, TAGS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

/**
 * Eine Seiten-Revision: unveränderliches, signiertes Event. Entspricht einem
 * Git-Commit — Autorschaft steckt in `author` (npub), die Reihenfolge in
 * `parentRevs`. docs/05-versioning-history.md
 */
export type Revision = {
  id: string
  author: string
  createdAt: number
  /** Gruppen-ID aus dem h-Tag */
  group: string
  /** normalisierter Slug aus dem d-Tag */
  slug: string
  title: string
  /** Slug der Elternseite für den Sidebar-Baum */
  parentSlug: string | null
  /** Vorgänger-Revisionen. Leer = erste Revision, zwei = Merge */
  parentRevs: string[]
  summary: string | null
  content: string
}

function firstTag(event: Event, name: string): string | null {
  const tag = event.tags.find((entry) => entry[0] === name)
  return tag && typeof tag[1] === 'string' && tag[1].length > 0 ? tag[1] : null
}

/**
 * Event zu einer Revision machen. Gibt null zurück, wenn das Event nicht in
 * diese Gruppe gehört oder Pflichtangaben fehlen — ein Relay könnte Fremdes
 * mitliefern, deshalb wird der h-Tag hier geprüft und nicht geglaubt.
 * docs/09-security-privacy.md
 */
export function parseRevision(event: Event, expectedGroup: string): Revision | null {
  if (event.kind !== KINDS.PAGE_REVISION) return null
  const group = firstTag(event, TAGS.GROUP)
  const slug = firstTag(event, TAGS.SLUG)
  if (!group || group !== expectedGroup || !slug) return null

  return {
    id: event.id,
    author: event.pubkey,
    createdAt: event.created_at,
    group,
    slug,
    title: firstTag(event, TAGS.TITLE) ?? slug,
    parentSlug: firstTag(event, TAGS.PAGE_PARENT),
    parentRevs: event.tags
      .filter((tag) => tag[0] === TAGS.PARENT_REV && typeof tag[1] === 'string')
      .map((tag) => tag[1]),
    summary: firstTag(event, TAGS.SUMMARY),
    content: event.content,
  }
}
