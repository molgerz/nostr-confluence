import { diffArrays } from 'diff'

/**
 * Zeilenweiser 3-Wege-Merge, wie ihn Confluence bei gleichzeitigem Speichern
 * bräuchte: gemeinsame Basis, meine Fassung, ihre Fassung.
 *
 * Grundsatz aus docs/05-versioning-history.md: kein stilles Überschreiben.
 * Berühren beide Seiten dieselben Zeilen, entsteht ein Konflikt mit Markern,
 * den ein Mensch auflösen muss — nicht ein Automat.
 */

export type MergeStatus = 'identical' | 'clean' | 'conflict'

export type MergeResult = {
  status: MergeStatus
  /** zusammengeführter Text, bei Konflikten mit Markern */
  content: string
  /** Anzahl der Konfliktstellen */
  conflicts: number
}

export type MergeLabels = {
  mine: string
  theirs: string
  base: string
}

const DEFAULT_LABELS: MergeLabels = {
  mine: 'deine Fassung',
  theirs: 'ihre Fassung',
  base: 'gemeinsame Basis',
}

/** Ein Änderungsblock: Basiszeilen [start, end) werden durch `lines` ersetzt. */
type Change = { start: number; end: number; lines: string[] }

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n')
}

/**
 * Änderungen als Bereiche über den Basiszeilen. Bewusst über `diffArrays` auf
 * Zeilen-Arrays statt über Patch-Hunks: die Zeilennummern in einem Unified
 * Diff sind für reine Einfügungen mehrdeutig, und eine um eins verschobene
 * Einfügung landet im Merge an der falschen Stelle.
 */
function toChanges(baseLines: string[], otherLines: string[]): Change[] {
  const parts = diffArrays(baseLines, otherLines)
  const changes: Change[] = []
  let cursor = 0
  let current: Change | null = null

  for (const part of parts) {
    if (part.added) {
      current ??= { start: cursor, end: cursor, lines: [] }
      current.lines.push(...part.value)
    } else if (part.removed) {
      current ??= { start: cursor, end: cursor, lines: [] }
      current.end = cursor + part.value.length
      cursor += part.value.length
    } else {
      if (current) {
        changes.push(current)
        current = null
      }
      cursor += part.value.length
    }
  }
  if (current) changes.push(current)
  return changes
}

function overlaps(a: Change, b: Change): boolean {
  // Zwei Einfügungen an derselben Stelle gelten als Überlappung: beide wollen
  // dieselbe Lücke füllen.
  if (a.start === a.end && b.start === b.end) return a.start === b.start
  return a.start < b.end && b.start < a.end
}

/** Basiszeilen eines Bereichs mit den Änderungen einer Seite anwenden. */
function applyToRegion(
  baseLines: string[],
  start: number,
  end: number,
  changes: Change[],
): string[] {
  const out: string[] = []
  let cursor = start
  for (const change of changes) {
    const from = Math.max(change.start, start)
    if (from > cursor) out.push(...baseLines.slice(cursor, from))
    out.push(...change.lines)
    cursor = Math.max(cursor, Math.min(change.end, end))
  }
  if (cursor < end) out.push(...baseLines.slice(cursor, end))
  return out
}

export function mergeThreeWay(
  base: string,
  mine: string,
  theirs: string,
  labels: Partial<MergeLabels> = {},
): MergeResult {
  const text = { ...DEFAULT_LABELS, ...labels }

  if (mine === theirs) return { status: 'identical', content: mine, conflicts: 0 }
  if (base === mine) return { status: 'clean', content: theirs, conflicts: 0 }
  if (base === theirs) return { status: 'clean', content: mine, conflicts: 0 }

  const baseLines = splitLines(base)
  const mineChanges = toChanges(baseLines, splitLines(mine))
  const theirChanges = toChanges(baseLines, splitLines(theirs))

  const out: string[] = []
  let conflicts = 0
  let cursor = 0
  let mi = 0
  let ti = 0

  while (mi < mineChanges.length || ti < theirChanges.length) {
    const m = mineChanges[mi]
    const t = theirChanges[ti]

    if (m && t && overlaps(m, t)) {
      // Konfliktbereich so weit ausdehnen, wie sich Änderungen berühren
      let start = Math.min(m.start, t.start)
      let end = Math.max(m.end, t.end)
      const mineHere: Change[] = []
      const theirsHere: Change[] = []
      for (;;) {
        let grew = false
        while (mi < mineChanges.length && mineChanges[mi].start <= end) {
          mineHere.push(mineChanges[mi])
          start = Math.min(start, mineChanges[mi].start)
          end = Math.max(end, mineChanges[mi].end)
          mi += 1
          grew = true
        }
        while (ti < theirChanges.length && theirChanges[ti].start <= end) {
          theirsHere.push(theirChanges[ti])
          start = Math.min(start, theirChanges[ti].start)
          end = Math.max(end, theirChanges[ti].end)
          ti += 1
          grew = true
        }
        if (!grew) break
      }

      if (cursor < start) out.push(...baseLines.slice(cursor, start))

      const mineRegion = applyToRegion(baseLines, start, end, mineHere)
      const theirsRegion = applyToRegion(baseLines, start, end, theirsHere)

      if (mineRegion.join('\n') === theirsRegion.join('\n')) {
        // Beide haben dasselbe getan — kein Konflikt, einmal übernehmen
        out.push(...mineRegion)
      } else {
        conflicts += 1
        out.push(`<<<<<<< ${text.mine}`)
        out.push(...mineRegion)
        out.push(`||||||| ${text.base}`)
        out.push(...baseLines.slice(start, end))
        out.push('=======')
        out.push(...theirsRegion)
        out.push(`>>>>>>> ${text.theirs}`)
      }
      cursor = end
      continue
    }

    // Kein Konflikt: die vordere Änderung anwenden
    const next = !t || (m && m.start <= t.start) ? m : t
    if (!next) break
    if (next === m) mi += 1
    else ti += 1
    if (cursor < next.start) out.push(...baseLines.slice(cursor, next.start))
    out.push(...next.lines)
    cursor = Math.max(cursor, next.end)
  }

  if (cursor < baseLines.length) out.push(...baseLines.slice(cursor))

  return {
    status: conflicts > 0 ? 'conflict' : 'clean',
    content: out.join('\n'),
    conflicts,
  }
}

/**
 * Nur die eindeutigen Marker prüfen. Eine Zeile aus Gleichheitszeichen ist in
 * Markdown eine H1-Unterstreichung — die darf keinen Fehlalarm auslösen.
 */
export function hasConflictMarkers(text: string): boolean {
  return text
    .split('\n')
    .some((line) => line.startsWith('<<<<<<<') || line.startsWith('>>>>>>>'))
}
