import { describe, expect, it } from 'vitest'
import { buildPages, buildTree, findCommonAncestor, flattenTree } from './pages'
import type { Revision } from './revision'

function rev(partial: Partial<Revision> & { id: string }): Revision {
  return {
    author: 'alice',
    createdAt: 1000,
    group: 'engineering',
    slug: 'page',
    title: 'Page',
    parentSlug: null,
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
      rev({ id: 'h1', slug: 'handbuch', title: 'Handbuch' }),
      rev({ id: 'o1', slug: 'onboarding', title: 'Alt', parentSlug: null, createdAt: 100 }),
      rev({
        id: 'o2',
        slug: 'onboarding',
        title: 'Onboarding',
        parentSlug: 'handbuch',
        createdAt: 200,
        parentRevs: ['o1'],
      }),
    ])
    const onboarding = pages.find((page) => page.slug === 'onboarding')
    expect(onboarding?.title).toBe('Onboarding')
    expect(onboarding?.parentSlug).toBe('handbuch')
    expect(pages).toHaveLength(2)
  })
})

describe('buildTree', () => {
  it('nests children under their parent page and counts the depth', () => {
    const pages = buildPages([
      rev({ id: 'h', slug: 'handbuch', title: 'Handbuch' }),
      rev({ id: 'o', slug: 'onboarding', title: 'Onboarding', parentSlug: 'handbuch' }),
      rev({ id: 'z', slug: 'zugang', title: 'Zugang', parentSlug: 'onboarding' }),
    ])
    const tree = buildTree(pages)
    expect(tree.map((node) => node.slug)).toEqual(['handbuch'])
    const flat = flattenTree(tree)
    expect(flat.map((node) => [node.slug, node.depth])).toEqual([
      ['handbuch', 0],
      ['onboarding', 1],
      ['zugang', 2],
    ])
  })

  it('puts pages with an unknown parent at the top instead of hiding them', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'waise', parentSlug: 'gibtsnicht' })])
    expect(buildTree(pages).map((node) => node.slug)).toEqual(['waise'])
  })

  it('survives a page that names itself as its parent', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'selbst', parentSlug: 'selbst' })])
    const tree = buildTree(pages)
    expect(tree.map((node) => node.slug)).toEqual(['selbst'])
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
