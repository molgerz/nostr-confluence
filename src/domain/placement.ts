import { KINDS, TAGS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

/**
 * Where a page hangs in the tree: under which parent, and at which position
 * among its siblings.
 *
 * This is deliberately **not** part of the revision chain. Dragging a page in
 * the sidebar would otherwise append a revision to it — the history would fill
 * up with moves, and the byline would claim somebody edited the page when all
 * they did was sort it. So the placement is an addressable event (`31818`,
 * keyed by the page's slug) that a move *overwrites*.
 *
 * The price: there is no history of moves. Only the current placement is
 * signed and visible; earlier ones are gone. And because addressable events
 * are replaced per author, two people moving the same page leave one event
 * each — the newer one wins, with the id breaking a tie so that every client
 * agrees. A position has nothing to merge, so last-writer-wins is the honest
 * semantics here. docs/02-data-model-events.md
 */
export type Placement = {
  /** slug of the page this places */
  slug: string
  parentSlug: string | null
  order: string | null
  author: string
  createdAt: number
  /** event id, only to break a tie between two equally old placements */
  id: string
}

function firstTag(event: Event, name: string): string | null {
  const tag = event.tags.find((entry) => entry[0] === name)
  return tag && typeof tag[1] === 'string' && tag[1].length > 0 ? tag[1] : null
}

/**
 * Turns an event into a placement. Returns null for a foreign group or a
 * missing slug — a relay can deliver anything, so the `h` tag is checked here
 * rather than trusted. docs/09-security-privacy.md
 */
export function parsePlacement(event: Event, expectedGroup: string): Placement | null {
  if (event.kind !== KINDS.PAGE_PLACEMENT) return null
  const group = firstTag(event, TAGS.GROUP)
  const slug = firstTag(event, TAGS.SLUG)
  if (!group || group !== expectedGroup || !slug) return null

  return {
    slug,
    parentSlug: firstTag(event, TAGS.PAGE_PARENT),
    order: firstTag(event, TAGS.PAGE_ORDER),
    author: event.pubkey,
    createdAt: event.created_at,
    id: event.id,
  }
}

/**
 * Which of two placements for the same page counts. Newest wins; on the same
 * timestamp the smaller id, so that two clients never disagree.
 */
export function newerPlacement(a: Placement, b: Placement): Placement {
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? a : b
  return a.id < b.id ? a : b
}
