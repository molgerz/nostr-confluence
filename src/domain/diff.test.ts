import { describe, expect, it } from 'vitest'
import { collapseContext, countChanges, diffTexts, diffWordsInLine } from './diff'

describe('diffTexts', () => {
  it('zählt Zeilennummern für beide Seiten getrennt', () => {
    const lines = diffTexts('a\nb\nc', 'a\nB\nc')
    expect(lines.map((line) => [line.type, line.text, line.oldNumber, line.newNumber])).toEqual([
      ['context', 'a', 1, 1],
      ['removed', 'b', 2, null],
      ['added', 'B', null, 2],
      ['context', 'c', 3, 3],
    ])
  })

  it('zählt Hinzufügungen und Entfernungen', () => {
    const lines = diffTexts('a\nb', 'a\nb\nc\nd')
    expect(countChanges(lines)).toEqual({ added: 2, removed: 0 })
  })

  it('kommt mit leeren Texten zurecht', () => {
    expect(countChanges(diffTexts('', 'neu'))).toEqual({ added: 1, removed: 0 })
    expect(countChanges(diffTexts('weg', ''))).toEqual({ added: 0, removed: 1 })
    expect(diffTexts('', '')).toEqual([])
  })
})

describe('collapseContext', () => {
  it('faltet lange unveränderte Strecken zusammen', () => {
    const before = Array.from({ length: 30 }, (_, i) => `Zeile ${i}`).join('\n')
    const after = before.replace('Zeile 15', 'Zeile fünfzehn')
    const collapsed = collapseContext(diffTexts(before, after), 2)
    const gaps = collapsed.filter((entry) => entry.type === 'gap')
    expect(gaps).toHaveLength(2)
    // sichtbar bleiben die geänderten Zeilen plus je zwei Zeilen Kontext
    expect(collapsed.filter((entry) => entry.type !== 'gap')).toHaveLength(6)
  })

  it('faltet nichts, wenn alles nah beieinander liegt', () => {
    const collapsed = collapseContext(diffTexts('a\nb', 'a\nc'), 3)
    expect(collapsed.some((entry) => entry.type === 'gap')).toBe(false)
  })
})

describe('diffWordsInLine', () => {
  it('markiert nur das geänderte Wort', () => {
    const parts = diffWordsInLine('Bitte bei Bob fragen.', 'Bitte bei Alice fragen.')
    expect(parts.find((part) => part.kind === 'removed')?.text).toContain('Bob')
    expect(parts.find((part) => part.kind === 'added')?.text).toContain('Alice')
    expect(parts.filter((part) => part.kind === 'same').length).toBeGreaterThan(0)
  })
})
