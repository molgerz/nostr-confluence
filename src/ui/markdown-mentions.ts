import { findMentions, mentionUri } from '../nostr/mentions'
import { toNpub } from '../nostr/profile'

/**
 * remark plugin: turns a bare `nostr:npub1…` in the text into a link node, so
 * the renderer can draw it as a mention chip instead of leaving a 63-character
 * key in the middle of a sentence.
 *
 * Only the mdast fields that matter here are typed — the tree comes from
 * remark and carries plenty more.
 */
type MdNode = {
  type: string
  value?: string
  url?: string
  children?: MdNode[]
}

/** A mention inside one of these is left alone. */
const OPAQUE = new Set(['link', 'linkReference', 'definition', 'inlineCode', 'code'])

function transform(node: MdNode): void {
  if (!node.children || OPAQUE.has(node.type)) return

  const out: MdNode[] = []
  for (const child of node.children) {
    if (child.type !== 'text' || typeof child.value !== 'string') {
      transform(child)
      out.push(child)
      continue
    }

    const spans = findMentions(child.value)
    if (spans.length === 0) {
      out.push(child)
      continue
    }

    let cursor = 0
    for (const span of spans) {
      if (span.from > cursor) out.push({ type: 'text', value: child.value.slice(cursor, span.from) })
      // The link text is the npub, not a name: at parse time no profile has
      // been fetched yet, and the component resolves the name anyway.
      out.push({
        type: 'link',
        url: mentionUri(span.pubkey),
        children: [{ type: 'text', value: toNpub(span.pubkey) }],
      })
      cursor = span.to
    }
    if (cursor < child.value.length) {
      out.push({ type: 'text', value: child.value.slice(cursor) })
    }
  }

  node.children = out
}

export function remarkMentions() {
  return (tree: MdNode) => {
    transform(tree)
  }
}
