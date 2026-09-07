import { describe, expect, it } from 'vitest'
import { buildPages, buildTree, findCommonAncestor, flattenTree } from './pages'
import type { Revision } from './revision'

function rev(partial: Partial<Revision> & { id: string }): Revision {
  return {
    author: 'alice',
    createdAt: 1000,
    group: 'engineering',
    slug: 'seite',
    title: 'Seite',
    parentSlug: null,
    parentRevs: [],
    summary: null,
    content: '',
    ...partial,
  }
}

describe('buildPages — Head-Auflösung', () => {
  it('nimmt bei einer linearen Kette die Spitze als Head', () => {
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

  it('erkennt eine Verzweigung und behält beide Blätter', () => {
    const pages = buildPages([
      rev({ id: 'r1', createdAt: 100 }),
      rev({ id: 'mine', createdAt: 200, parentRevs: ['r1'] }),
      rev({ id: 'theirs', createdAt: 250, parentRevs: ['r1'] }),
    ])
    expect(pages[0].leaves.map((leaf) => leaf.id).sort()).toEqual(['mine', 'theirs'])
    // angezeigt wird das jüngste Blatt, verschwiegen wird die Gabelung nicht
    expect(pages[0].head.id).toBe('theirs')
  })

  it('löst gleiche Zeitstempel deterministisch über die id auf', () => {
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

  it('führt eine Merge-Revision mit zwei Eltern wieder zu einem Blatt zusammen', () => {
    const pages = buildPages([
      rev({ id: 'r1', createdAt: 100 }),
      rev({ id: 'mine', createdAt: 200, parentRevs: ['r1'] }),
      rev({ id: 'theirs', createdAt: 250, parentRevs: ['r1'] }),
      rev({ id: 'merge', createdAt: 300, parentRevs: ['mine', 'theirs'] }),
    ])
    expect(pages[0].leaves.map((leaf) => leaf.id)).toEqual(['merge'])
    expect(pages[0].head.id).toBe('merge')
  })

  it('trennt Seiten nach Slug und nimmt Titel und Elternseite vom Head', () => {
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
  it('hängt Kinder unter ihre Elternseite und zählt die Tiefe', () => {
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

  it('hängt Seiten mit unbekannter Elternseite oben an statt sie zu verstecken', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'waise', parentSlug: 'gibtsnicht' })])
    expect(buildTree(pages).map((node) => node.slug)).toEqual(['waise'])
  })

  it('überlebt eine Seite, die sich selbst als Elternseite nennt', () => {
    const pages = buildPages([rev({ id: 'x', slug: 'selbst', parentSlug: 'selbst' })])
    const tree = buildTree(pages)
    expect(tree.map((node) => node.slug)).toEqual(['selbst'])
    expect(flattenTree(tree)).toHaveLength(1)
  })
})

describe('findCommonAncestor', () => {
  it('findet die Wurzel zweier Zweige', () => {
    const r1 = rev({ id: 'r1' })
    const mine = rev({ id: 'mine', parentRevs: ['r1'] })
    const theirs = rev({ id: 'theirs', parentRevs: ['r1'] })
    expect(findCommonAncestor([r1, mine, theirs], mine, theirs)?.id).toBe('r1')
  })

  it('findet den jüngsten gemeinsamen Vorfahren, nicht die Wurzel', () => {
    const r1 = rev({ id: 'r1' })
    const r2 = rev({ id: 'r2', parentRevs: ['r1'] })
    const mine = rev({ id: 'mine', parentRevs: ['r2'] })
    const theirs = rev({ id: 'theirs', parentRevs: ['r2'] })
    expect(findCommonAncestor([r1, r2, mine, theirs], mine, theirs)?.id).toBe('r2')
  })

  it('gibt null zurück, wenn es zwei unabhängige Wurzeln gibt', () => {
    const a = rev({ id: 'a' })
    const b = rev({ id: 'b' })
    expect(findCommonAncestor([a, b], a, b)).toBeNull()
  })

  it('erkennt eine Revision, die selbst Vorfahre der anderen ist', () => {
    const r1 = rev({ id: 'r1' })
    const r2 = rev({ id: 'r2', parentRevs: ['r1'] })
    expect(findCommonAncestor([r1, r2], r2, r1)?.id).toBe('r1')
  })
})
