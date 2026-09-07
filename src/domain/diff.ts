import { diffArrays, diffWords } from 'diff'

/**
 * Line-by-line comparison of two revisions. Because every revision carries a
 * full-text snapshot, any two revisions can be compared — not just neighbours.
 * docs/05-versioning-history.md
 */
export type DiffLineType = 'context' | 'added' | 'removed'

export type DiffLine = {
  type: DiffLineType
  text: string
  /** line number in the older version, null for added lines */
  oldNumber: number | null
  /** line number in the newer version, null for removed lines */
  newNumber: number | null
}

export type DiffGap = { type: 'gap'; hidden: number }

export function diffTexts(before: string, after: string): DiffLine[] {
  const beforeLines = before.length === 0 ? [] : before.split('\n')
  const afterLines = after.length === 0 ? [] : after.split('\n')
  const parts = diffArrays(beforeLines, afterLines)

  const lines: DiffLine[] = []
  let oldNumber = 1
  let newNumber = 1

  for (const part of parts) {
    for (const text of part.value) {
      if (part.added) {
        lines.push({ type: 'added', text, oldNumber: null, newNumber })
        newNumber += 1
      } else if (part.removed) {
        lines.push({ type: 'removed', text, oldNumber, newNumber: null })
        oldNumber += 1
      } else {
        lines.push({ type: 'context', text, oldNumber, newNumber })
        oldNumber += 1
        newNumber += 1
      }
    }
  }
  return lines
}

export function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length,
  }
}

/**
 * Folds long unchanged runs so the view stays readable. Folding only happens
 * when it actually saves something.
 */
export function collapseContext<T extends DiffLine>(
  lines: T[],
  context = 3,
): (T | DiffGap)[] {
  const keep = new Set<number>()
  lines.forEach((line, index) => {
    if (line.type === 'context') return
    for (let i = index - context; i <= index + context; i += 1) {
      if (i >= 0 && i < lines.length) keep.add(i)
    }
  })

  const out: (T | DiffGap)[] = []
  let hidden = 0
  lines.forEach((line, index) => {
    if (keep.has(index)) {
      if (hidden > 0) {
        out.push({ type: 'gap', hidden })
        hidden = 0
      }
      out.push(line)
    } else {
      hidden += 1
    }
  })
  if (hidden > 0) out.push({ type: 'gap', hidden })
  return out
}

export type WordPart = { text: string; kind: 'same' | 'added' | 'removed' }

/**
 * Finds line pairs where a removed line was directly replaced by an added one
 * and computes the word-level difference for them. Only then can you see *what*
 * changed in a modified line instead of reading the whole line twice.
 */
export function wordDiffsForPairs(lines: DiffLine[]): Map<number, WordPart[]> {
  const result = new Map<number, WordPart[]>()

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].type !== 'removed') continue

    // A run of removed lines, then a run of added lines
    let end = i
    while (end < lines.length && lines[end].type === 'removed') end += 1
    let addedEnd = end
    while (addedEnd < lines.length && lines[addedEnd].type === 'added') addedEnd += 1

    const removed = end - i
    const added = addedEnd - end
    if (added > 0) {
      for (let k = 0; k < Math.min(removed, added); k += 1) {
        const before = lines[i + k].text
        const after = lines[end + k].text
        if (before === after) continue
        const parts = diffWordsInLine(before, after)
        result.set(i + k, parts.filter((part) => part.kind !== 'added'))
        result.set(end + k, parts.filter((part) => part.kind !== 'removed'))
      }
    }
    i = addedEnd - 1
  }

  return result
}

/** Word-level comparison for a line pair that differs only slightly. */
export function diffWordsInLine(before: string, after: string): WordPart[] {
  return diffWords(before, after).map((part) => ({
    text: part.value,
    kind: part.added ? 'added' : part.removed ? 'removed' : 'same',
  }))
}
