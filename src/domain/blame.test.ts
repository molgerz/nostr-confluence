import { describe, expect, it } from 'vitest'
import { blame, firstParentChain } from './blame'
import type { Revision } from './revision'

function rev(id: string, content: string, parents: string[] = [], author = 'alice'): Revision {
  return {
    id,
    author,
    createdAt: 1000,
    group: 'engineering',
    slug: 'seite',
    title: 'Seite',
    parentSlug: null,
    parentRevs: parents,
    summary: null,
    content,
  }
}

describe('firstParentChain', () => {
  it('läuft vom Head rückwärts und gibt die Kette in Reihenfolge zurück', () => {
    const r1 = rev('r1', 'a')
    const r2 = rev('r2', 'a\nb', ['r1'])
    const r3 = rev('r3', 'a\nb\nc', ['r2'])
    expect(firstParentChain([r1, r2, r3], r3).map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('bricht bei einem Zyklus nicht aus', () => {
    const a = rev('a', 'x', ['b'])
    const b = rev('b', 'y', ['a'])
    expect(firstParentChain([a, b], a).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('endet, wenn ein Vorgänger fehlt', () => {
    const r2 = rev('r2', 'a', ['fehlt'])
    expect(firstParentChain([r2], r2).map((r) => r.id)).toEqual(['r2'])
  })
})

describe('blame', () => {
  it('ordnet jede Zeile der Revision zu, die sie eingeführt hat', () => {
    const r1 = rev('r1', 'eins\nzwei', [], 'alice')
    const r2 = rev('r2', 'eins\nzwei\ndrei', ['r1'], 'bob')
    const result = blame([r1, r2], r2)
    expect(result.map((line) => [line.text, line.revision.author])).toEqual([
      ['eins', 'alice'],
      ['zwei', 'alice'],
      ['drei', 'bob'],
    ])
  })

  it('schreibt eine geänderte Zeile der ändernden Revision zu', () => {
    const r1 = rev('r1', 'eins\nzwei', [], 'alice')
    const r2 = rev('r2', 'eins\nZWEI', ['r1'], 'bob')
    const result = blame([r1, r2], r2)
    expect(result[0].revision.author).toBe('alice')
    expect(result[1].revision.author).toBe('bob')
  })

  it('behält die Zuordnung über mehrere Revisionen hinweg', () => {
    const r1 = rev('r1', 'a\nb\nc', [], 'alice')
    const r2 = rev('r2', 'a\nb\nc\nd', ['r1'], 'bob')
    const r3 = rev('r3', 'a\nB\nc\nd', ['r2'], 'carol')
    const result = blame([r1, r2, r3], r3)
    expect(result.map((line) => line.revision.author)).toEqual(['alice', 'carol', 'alice', 'bob'])
  })
})
