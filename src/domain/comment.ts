import { KINDS, TAGS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

/**
 * Kommentar zu einer Seite (NIP-22, Kind 1111).
 *
 * Abweichung vom Buchstaben des NIP: dort verweist ein Kommentar per `A`/`E`
 * auf ein einzelnes Wurzel-Event. Unsere Seite *ist* kein einzelnes Event,
 * sondern das Paar (Gruppe, Slug) — ein Verweis auf eine Revision würde mit
 * der nächsten Bearbeitung veralten. Deshalb wird über `h` und `d` verankert,
 * genau wie die Revisionen selbst. docs/02-data-model-events.md
 */
export type Comment = {
  id: string
  author: string
  createdAt: number
  slug: string
  /** Kommentar-ID, auf die geantwortet wird; null bei einem Wurzelkommentar */
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
 * Kommentare in Threads bringen. Antworten auf gelöschte oder (noch) nicht
 * geladene Kommentare hängen oben — verstecken wäre schlimmer als falsch
 * einsortieren.
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
      // Einrückung deckeln, sonst wird ein tiefer Thread unlesbar schmal
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
