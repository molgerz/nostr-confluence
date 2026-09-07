import { diffArrays } from 'diff'
import type { Revision } from './revision'

/**
 * Zeilenweise Zuordnung: welche Revision hat diese Zeile eingeführt?
 * Wird clientseitig aus der Kette berechnet — jede Zeile trägt damit einen
 * npub, und das ist der Punkt, an dem "an den npub geknüpft" überprüfbar wird.
 * docs/05-versioning-history.md
 */
export type BlameLine = {
  text: string
  revision: Revision
}

/**
 * Kette vom Head rückwärts entlang des ersten Vorgängers. Bei einer
 * Merge-Revision ist das der erste `parent-rev`-Eintrag; die Zeilen des
 * zweiten Zweiges erscheinen dann als vom Merge eingeführt. Das ist dieselbe
 * Vereinfachung, die auch `git blame` ohne Zusatzoptionen macht.
 */
export function firstParentChain(revisions: Revision[], head: Revision): Revision[] {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]))
  const chain: Revision[] = []
  const seen = new Set<string>()
  let current: Revision | undefined = head

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    chain.push(current)
    const parentId: string | undefined = current.parentRevs[0]
    current = parentId ? byId.get(parentId) : undefined
  }

  return chain.reverse()
}

export function blame(revisions: Revision[], head: Revision): BlameLine[] {
  const chain = firstParentChain(revisions, head)
  let lines: string[] = []
  let owners: Revision[] = []

  for (const revision of chain) {
    const next = revision.content.length === 0 ? [] : revision.content.split('\n')
    const parts = diffArrays(lines, next)
    const nextOwners: Revision[] = []
    let cursor = 0

    for (const part of parts) {
      if (part.added) {
        for (let i = 0; i < part.value.length; i += 1) nextOwners.push(revision)
      } else if (part.removed) {
        cursor += part.value.length
      } else {
        for (let i = 0; i < part.value.length; i += 1) {
          nextOwners.push(owners[cursor] ?? revision)
          cursor += 1
        }
      }
    }

    lines = next
    owners = nextOwners
  }

  return lines.map((text, index) => ({ text, revision: owners[index] ?? head }))
}
