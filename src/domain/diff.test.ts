import { describe, expect, it } from 'vitest'
import {
  collapseContext,
  countChanges,
  diffTexts,
  diffWordsInLine,
  wordDiffsForPairs,
} from './diff'

describe('diffTexts', () => {
  it('counts line numbers separately for both sides', () => {
    const lines = diffTexts('a\nb\nc', 'a\nB\nc')
    expect(lines.map((line) => [line.type, line.text, line.oldNumber, line.newNumber])).toEqual([
      ['context', 'a', 1, 1],
      ['removed', 'b', 2, null],
      ['added', 'B', null, 2],
      ['context', 'c', 3, 3],
    ])
  })

  it('counts additions and removals', () => {
    const lines = diffTexts('a\nb', 'a\nb\nc\nd')
    expect(countChanges(lines)).toEqual({ added: 2, removed: 0 })
  })

  it('copes with empty texts', () => {
    expect(countChanges(diffTexts('', 'new'))).toEqual({ added: 1, removed: 0 })
    expect(countChanges(diffTexts('gone', ''))).toEqual({ added: 0, removed: 1 })
    expect(diffTexts('', '')).toEqual([])
  })
})

describe('collapseContext', () => {
  it('folds long unchanged runs', () => {
    const before = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
    const after = before.replace('line 15', 'line fifteen')
    const collapsed = collapseContext(diffTexts(before, after), 2)
    const gaps = collapsed.filter((entry) => entry.type === 'gap')
    expect(gaps).toHaveLength(2)
    // the changed lines stay visible plus two lines of context each
    expect(collapsed.filter((entry) => entry.type !== 'gap')).toHaveLength(6)
  })

  it('folds nothing when everything is close together', () => {
    const collapsed = collapseContext(diffTexts('a\nb', 'a\nc'), 3)
    expect(collapsed.some((entry) => entry.type === 'gap')).toBe(false)
  })
})

describe('diffWordsInLine', () => {
  it('marks only the changed word', () => {
    const parts = diffWordsInLine('Please ask Bob.', 'Please ask Alice.')
    expect(parts.find((part) => part.kind === 'removed')?.text).toContain('Bob')
    expect(parts.find((part) => part.kind === 'added')?.text).toContain('Alice')
    expect(parts.filter((part) => part.kind === 'same').length).toBeGreaterThan(0)
  })
})

describe('wordDiffsForPairs', () => {
  it('marks only the changed word in a replaced line', () => {
    const lines = diffTexts('Please ask Bob.', 'Please ask Alice.')
    const pairs = wordDiffsForPairs(lines)
    const entfernt = pairs.get(0)?.filter((part) => part.kind === 'removed')
    const hinzu = pairs.get(1)?.filter((part) => part.kind === 'added')
    expect(entfernt?.map((part) => part.text)).toEqual(['Bob'])
    expect(hinzu?.map((part) => part.text)).toEqual(['Alice'])
    // the removed line shows no added parts and vice versa
    expect(pairs.get(0)?.some((part) => part.kind === 'added')).toBe(false)
    expect(pairs.get(1)?.some((part) => part.kind === 'removed')).toBe(false)
  })

  it('leaves pure additions untouched', () => {
    const lines = diffTexts('a', 'a\nb')
    expect(wordDiffsForPairs(lines).size).toBe(0)
  })

  it('pairs several replaced lines in order', () => {
    const lines = diffTexts('one\ntwo', 'ONE\nTWO')
    const pairs = wordDiffsForPairs(lines)
    expect(pairs.size).toBe(4)
  })
})
