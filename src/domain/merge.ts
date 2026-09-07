import { diffArrays } from 'diff'

/**
 * Line-based three-way merge, the kind Confluence would need for concurrent
 * saves: common base, my version, their version.
 *
 * The principle from docs/05-versioning-history.md: no silent overwriting. If
 * both sides touch the same lines, a conflict with markers is produced that a
 * human has to resolve — not a machine.
 */

export type MergeStatus = 'identical' | 'clean' | 'conflict'

export type MergeResult = {
  status: MergeStatus
  /** the merged text, with markers when there are conflicts */
  content: string
  /** number of conflicting spots */
  conflicts: number
}

export type MergeLabels = {
  mine: string
  theirs: string
  base: string
}

const DEFAULT_LABELS: MergeLabels = {
  mine: 'your version',
  theirs: 'their version',
  base: 'common base',
}

/** One change block: base lines [start, end) are replaced by `lines`. */
type Change = { start: number; end: number; lines: string[] }

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n')
}

/**
 * Changes as ranges over the base lines. Deliberately built with `diffArrays`
 * over line arrays rather than patch hunks: line numbers in a unified diff are
 * ambiguous for pure insertions, and an insertion off by one lands in the wrong
 * place in the merge.
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
  // Two insertions at the same position count as an overlap: both want to fill
  // the same gap.
  if (a.start === a.end && b.start === b.end) return a.start === b.start
  return a.start < b.end && b.start < a.end
}

/** Applies one side's changes to the base lines of a range. */
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
      // Extend the conflict region as far as changes keep touching
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
        // Both did the same thing — not a conflict, take it once
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

    // No conflict: apply whichever change comes first
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
 * Only check the unambiguous markers. A line of equals signs is a setext H1
 * underline in Markdown — it must not raise a false alarm.
 */
export function hasConflictMarkers(text: string): boolean {
  return text
    .split('\n')
    .some((line) => line.startsWith('<<<<<<<') || line.startsWith('>>>>>>>'))
}
