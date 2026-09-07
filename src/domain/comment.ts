import { KINDS, TAGS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

/**
 * A comment on a page (NIP-22, kind 1111).
 *
 * Deviation from the letter of the NIP: there a comment points at a single root
 * event via `A`/`E`. Our page *is* not a single event but the pair (group,
 * slug) — a reference to one revision would go stale with the next edit. So it
 * is anchored through `h` and `d`, exactly like the revisions themselves.
 * docs/02-data-model-events.md
 */
export type Comment = {
  id: string
  author: string
  createdAt: number
  slug: string
  /** id of the comment being replied to; null for a root comment */
  parentId: string | null
  content: string
}

export type CommentNode = Comment & { replies: CommentNode[]; depth: number }

function firstTag(event: Event, name: string): string | null {
  const tag = event.tags.find((entry) => entry[0] === name)
  return tag && typeof tag[1] === 'string' && tag[1].length > 0 ? tag[1] : null
}

export function parseComment(event: Event, expectedGroup: string): Comment | null {
  if (event.kind !== KINDS.COMMENT) return null
  const group = firstTag(event, TAGS.GROUP)
  const slug = firstTag(event, TAGS.SLUG)
  if (!group || group !== expectedGroup || !slug) return null
  if (event.content.trim().length === 0) return null

  return {
    id: event.id,
    author: event.pubkey,
    createdAt: event.created_at,
    slug,
    parentId: firstTag(event, 'e'),
    content: event.content,
  }
}

/**
 * Arranges comments into threads. Replies to deleted or not-yet-loaded comments
 * hang at the top — hiding them would be worse than filing them in the wrong
 * place.
 */
export function buildCommentTree(comments: Comment[]): CommentNode[] {
  const sorted = [...comments].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const nodes = new Map<string, CommentNode>()
  for (const comment of sorted) nodes.set(comment.id, { ...comment, replies: [], depth: 0 })

  const roots: CommentNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent && parent.id !== node.id) parent.replies.push(node)
    else roots.push(node)
  }

  const setDepth = (list: CommentNode[], depth: number) => {
    for (const node of list) {
      // Cap the indentation, otherwise a deep thread becomes unreadably narrow
      node.depth = Math.min(depth, 4)
      setDepth(node.replies, depth + 1)
    }
  }
  setDepth(roots, 0)
  return roots
}

export function countComments(nodes: CommentNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countComments(node.replies), 0)
}
