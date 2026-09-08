import { describe, expect, it } from 'vitest'
import {
  buildPages,
  buildTree,
  canMoveUnder,
  descendantSlugs,
  findCommonAncestor,
  flattenTree,
} from './pages'
import { keyBetween } from './order'
import type { Revision } from './revision'

function rev(partial: Partial<Revision> & { id: string }): Revision {
  return {
    author: 'alice',
    createdAt: 1000,
    group: 'engineering',
    slug: 'page',
    title: 'Page',
    parentSlug: null,
    order: null,
    parentRevs: [],
    summary: null,
    content: '',
    ...partial,
  }
}

describe('buildPages — head resolution', () => {
  it('takes the tip of a linear chain as the head', () => {
    const pages = buildPages([
      rev({ id: 'r1', createdAt: 100 }),
      rev({ id: 'r2', createdAt: 200, parentRevs: ['r1'] }),
      rev({ id: 'r3', createdAt: 300, parentRevs: ['r2'] }),
    ])
    expect(pages).toHaveLength(1)
    expect(pages[0].head.id).toBe('r3')
    expect(pages[0].leaves.map((leaf) => leaf.id)).toEqual(['r3'])
    expect(pages[0].revisions).toHaveLength(3)
  })

  it('detects a fork and keeps both leaves', () => {
    const pages = buildPages([
      rev({ id: 'r1', createdAt: 100 }),
      rev({ id: 'mine', createdAt: 200, parentRevs: ['r1'] }),
      rev({ id: 'theirs', createdAt: 250, parentRevs: ['r1'] }),
    ])
    expect(pages[0].leaves.map((leaf) => leaf.id).sort()).toEqual(['mine', 'theirs'])
    // the newest leaf is displayed, but the fork is not hidden
    expect(pages[0].head.id).toBe('theirs')
  })

  it('breaks timestamp ties deterministically by id', () => {
    const a = buildPages([
      rev({ id: 'bbb', createdAt: 100 }),
      rev({ id: 'aaa', createdAt: 100 }),
    ])
    const b = buildPages([
      rev({ id: 'aaa', createdAt: 100 }),
      rev({ id: 'bbb', createdAt: 100 }),
    ])
    expect(a[0].head.id).toBe(b[0].head.id)
    expect(a[0].head.id).toBe('aaa')
  })

  it('brings a merge revision with two parents back to a single leaf', () => {
    const pages = buildPages([
      rev({ id: 'r1', createdAt: 100 }),
      rev({ id: 'mine', createdAt: 200, parentRevs: ['r1'] }),
      rev({ id: 'theirs', createdAt: 250, parentRevs: ['r1'] }),
      rev({ id: 'merge', createdAt: 300, parentRevs: ['mine', 'theirs'] }),
    ])
    expect(pages[0].leaves.map((leaf) => leaf.id)).toEqual(['merge'])
    expect(pages[0].head.id).toBe('merge')
  })

  it('separates pages by slug and takes title and parent from the head', () => {
    const pages = buildPages([
      rev({ id: 'h1', slug: 'handbook', title: 'Handbook' }),
      rev({ id: 'o1', slug: 'onboarding', title: 'Old', parentSlug: null, createdAt: 100 }),
      rev({
        id: 'o2',
        slug: 'onboarding',
        title: 'Onboarding',
        parentSlug: 'handbook',
        createdAt: 200,
        parentRevs: ['o1'],
      }),
    ])
    const onboarding = pages.find((page) => page.slug === 'onboarding')
    expect(onboarding?.title).toBe('Onboarding')
    expect(onboarding?.parentSlug).toBe('handbook')
    expect(pages).toHaveLength(2)
  })
})

describe('buildTree', () => {
  it('nests children under their parent page and counts the depth', () => {
    const pages = buildPages([
      rev({ id: 'h', slug: 'handbook', title: 'Handbook' }),
      rev({ id: 'o', slug: 'onboarding', title: 'Onboarding', parentSlug: 'handbook' }),
      rev({ id: 'z', slug: 'access', title: 'Access', parentSlug: 'onboarding' }),
    ])
    const tree = buildTree(pages)
    expect(tree.map((node) => node.slug)).toEqual(['handbook'])
    const flat = flattenTree(tree)
    expect(flat.map((node) => [node.slug, node.depth])).toEqual([
      ['handbook', 0],
      ['onboarding', 1],
      ['access', 2],
    ])
  })

  it('puts pages with an unknown parent at the top instead of hiding them', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'orphan', parentSlug: 'nonexistent' })])
    expect(buildTree(pages).map((node) => node.slug)).toEqual(['orphan'])
  })

  it('survives a page that names itself as its parent', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'itself', parentSlug: 'itself' })])
    const tree = buildTree(pages)
    expect(tree.map((node) => node.slug)).toEqual(['itself'])
    expect(flattenTree(tree)).toHaveLength(1)
  })
})

describe('findCommonAncestor', () => {
  it('finds the root of two branches', () => {
    const r1 = rev({ id: 'r1' })
    const mine = rev({ id: 'mine', parentRevs: ['r1'] })
    const theirs = rev({ id: 'theirs', parentRevs: ['r1'] })
    expect(findCommonAncestor([r1, mine, theirs], mine, theirs)?.id).toBe('r1')
  })

  it('finds the most recent common ancestor, not the root', () => {
    const r1 = rev({ id: 'r1' })
    const r2 = rev({ id: 'r2', parentRevs: ['r1'] })
    const mine = rev({ id: 'mine', parentRevs: ['r2'] })
    const theirs = rev({ id: 'theirs', parentRevs: ['r2'] })
    expect(findCommonAncestor([r1, r2, mine, theirs], mine, theirs)?.id).toBe('r2')
  })

  it('returns null when there are two independent roots', () => {
    const a = rev({ id: 'a' })
    const b = rev({ id: 'b' })
    expect(findCommonAncestor([a, b], a, b)).toBeNull()
  })

  it('recognises a revision that is itself an ancestor of the other', () => {
    const r1 = rev({ id: 'r1' })
    const r2 = rev({ id: 'r2', parentRevs: ['r1'] })
    expect(findCommonAncestor([r1, r2], r2, r1)?.id).toBe('r1')
  })
})

describe('moving a page', () => {
  const pages = buildPages([
    rev({ id: 'h', slug: 'handbook', title: 'Handbook' }),
    rev({ id: 'o', slug: 'onboarding', title: 'Onboarding', parentSlug: 'handbook' }),
    rev({ id: 'z', slug: 'access', title: 'Access', parentSlug: 'onboarding' }),
    rev({ id: 'p', slug: 'minutes', title: 'Minutes' }),
  ])

  it('counts a page and its whole subtree as its own descendants', () => {
    expect([...descendantSlugs(pages, 'handbook')].sort()).toEqual([
      'access',
      'handbook',
      'onboarding',
    ])
    expect([...descendantSlugs(pages, 'access')]).toEqual(['access'])
  })

  it('refuses a move into its own subtree, and onto itself', () => {
    expect(canMoveUnder(pages, 'handbook', 'access')).toBe(false)
    expect(canMoveUnder(pages, 'handbook', 'handbook')).toBe(false)
    expect(canMoveUnder(pages, 'handbook', 'minutes')).toBe(true)
    // the top level is always allowed
    expect(canMoveUnder(pages, 'handbook', null)).toBe(true)
  })

  it('terminates on a cycle that is already in the data', () => {
    const cyclic = buildPages([
      rev({ id: 'a', slug: 'a', parentSlug: 'b' }),
      rev({ id: 'b', slug: 'b', parentSlug: 'a' }),
    ])
    expect([...descendantSlugs(cyclic, 'a')].sort()).toEqual(['a', 'b'])
  })
})

describe('sibling order', () => {
  it('sorts a level by its order key instead of by title', () => {
    const pages = buildPages([
      rev({ id: 'z', slug: 'zebra', title: 'Zebra', order: 'a' }),
      rev({ id: 'a', slug: 'apple', title: 'Apple', order: 'b' }),
    ])
    expect(pages.map((page) => page.slug)).toEqual(['zebra', 'apple'])
  })

  it('orders pages without a key by their title', () => {
    const pages = buildPages([
      rev({ id: 'z', slug: 'zebra', title: 'Zebra' }),
      rev({ id: 'a', slug: 'apple', title: 'Apple' }),
    ])
    expect(pages.map((page) => page.slug)).toEqual(['apple', 'zebra'])
  })

  it('drops a keyed page between two pages that have no key', () => {
    // What the sidebar does on a drop into the gap between the two: the key
    // is measured against their implicit keys, which are their titles.
    const order = keyBetween('handbook', 'onboarding')
    const pages = buildPages([
      rev({ id: 'h', slug: 'handbook', title: 'Handbook' }),
      rev({ id: 'o', slug: 'onboarding', title: 'Onboarding' }),
      rev({ id: 'n', slug: 'notes', title: 'Notes', order }),
    ])
    expect(pages.map((page) => page.slug)).toEqual(['handbook', 'notes', 'onboarding'])
  })

  it('applies the order inside the tree, not just to the flat list', () => {
    const pages = buildPages([
      rev({ id: 'h', slug: 'handbook', title: 'Handbook' }),
      rev({ id: 'a', slug: 'appendix', title: 'Appendix', parentSlug: 'handbook', order: 'z' }),
      rev({ id: 'b', slug: 'basics', title: 'Basics', parentSlug: 'handbook', order: 'a' }),
    ])
    const tree = buildTree(pages)
    expect(tree[0].children.map((node) => node.slug)).toEqual(['basics', 'appendix'])
  })

  it('breaks a tie between two identical keys by slug, on every client', () => {
    const first = buildPages([
      rev({ id: '1', slug: 'bravo', title: 'Same', order: 'm' }),
      rev({ id: '2', slug: 'alpha', title: 'Same', order: 'm' }),
    ])
    const second = buildPages([
      rev({ id: '2', slug: 'alpha', title: 'Same', order: 'm' }),
      rev({ id: '1', slug: 'bravo', title: 'Same', order: 'm' }),
    ])
    expect(first.map((page) => page.slug)).toEqual(['alpha', 'bravo'])
    expect(second.map((page) => page.slug)).toEqual(first.map((page) => page.slug))
  })
})
