import { describe, expect, it } from 'vitest'
import { buildCommentTree, countComments, parseComment } from './comment'
import { KINDS } from '../nostr/kinds'
import type { Comment } from './comment'
import type { Event } from 'nostr-tools'

function event(partial: Partial<Event>): Event {
  return {
    id: 'c1',
    pubkey: 'alice',
    created_at: 1000,
    kind: KINDS.COMMENT,
    tags: [
      ['h', 'engineering'],
      ['d', 'onboarding'],
    ],
    content: 'Guter Punkt.',
    sig: 'sig',
    ...partial,
  } as Event
}

function comment(id: string, parentId: string | null, createdAt = 1000): Comment {
  return { id, author: 'alice', createdAt, slug: 'onboarding', parentId, content: id }
}

describe('parseComment', () => {
  it('liest Gruppe, Slug und Antwortbezug', () => {
    const parsed = parseComment(
      event({ tags: [['h', 'engineering'], ['d', 'onboarding'], ['e', 'c0']] }),
      'engineering',
    )
    expect(parsed).toMatchObject({ slug: 'onboarding', parentId: 'c0', content: 'Guter Punkt.' })
  })

  it('verwirft fremde Gruppen und falsche Kinds', () => {
    expect(parseComment(event({}), 'andere')).toBeNull()
    expect(parseComment(event({ kind: 1 }), 'engineering')).toBeNull()
  })

  it('verwirft leere Kommentare', () => {
    expect(parseComment(event({ content: '   ' }), 'engineering')).toBeNull()
  })
})

describe('buildCommentTree', () => {
  it('hängt Antworten unter ihren Kommentar und sortiert nach Zeit', () => {
    const tree = buildCommentTree([
      comment('b', null, 2000),
      comment('a', null, 1000),
      comment('a1', 'a', 1500),
    ])
    expect(tree.map((node) => node.id)).toEqual(['a', 'b'])
    expect(tree[0].replies.map((node) => node.id)).toEqual(['a1'])
    expect(tree[0].replies[0].depth).toBe(1)
  })

  it('hängt Antworten auf Unbekanntes oben an', () => {
    const tree = buildCommentTree([comment('x', 'fehlt')])
    expect(tree.map((node) => node.id)).toEqual(['x'])
  })

  it('deckelt die Einrückung bei tiefen Threads', () => {
    const chain = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index, all) =>
      comment(id, index === 0 ? null : all[index - 1], 1000 + index),
    )
    const tree = buildCommentTree(chain)
    let node = tree[0]
    const depths = [node.depth]
    while (node.replies.length > 0) {
      node = node.replies[0]
      depths.push(node.depth)
    }
    expect(depths).toEqual([0, 1, 2, 3, 4, 4])
    expect(countComments(tree)).toBe(6)
  })

  it('überlebt einen Kommentar, der sich selbst als Antwortziel nennt', () => {
    const tree = buildCommentTree([comment('a', 'a')])
    expect(tree).toHaveLength(1)
    expect(countComments(tree)).toBe(1)
  })
})
