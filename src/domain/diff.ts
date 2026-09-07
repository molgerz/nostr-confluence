import { diffArrays, diffWords } from 'diff'

/**
 * Zeilenweiser Vergleich zweier Revisionen. Weil jede Revision einen
 * Volltext-Snapshot enthält, lassen sich beliebige Revisionen vergleichen —
 * nicht nur benachbarte. docs/05-versioning-history.md
 */
export type DiffLineType = 'context' | 'added' | 'removed'

export type DiffLine = {
  type: DiffLineType
  text: string
  /** Zeilennummer in der älteren Fassung, null bei hinzugefügten Zeilen */
  oldNumber: number | null
  /** Zeilennummer in der neueren Fassung, null bei entfernten Zeilen */
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
 * Lange unveränderte Strecken zusammenfalten, damit die Ansicht lesbar bleibt.
 * Es wird nur gefaltet, wenn dadurch wirklich etwas gespart wird.
 */
export function collapseContext(
  lines: DiffLine[],
  context = 3,
): (DiffLine | DiffGap)[] {
  const keep = new Set<number>()
  lines.forEach((line, index) => {
    if (line.type === 'context') return
    for (let i = index - context; i <= index + context; i += 1) {
      if (i >= 0 && i < lines.length) keep.add(i)
    }
  })

  const out: (DiffLine | DiffGap)[] = []
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

/** Wortgenauer Vergleich für ein Zeilenpaar, das sich nur leicht unterscheidet. */
export function diffWordsInLine(before: string, after: string): WordPart[] {
  return diffWords(before, after).map((part) => ({
    text: part.value,
    kind: part.added ? 'added' : part.removed ? 'removed' : 'same',
  }))
}
