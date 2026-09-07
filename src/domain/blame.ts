import { diffArrays } from 'diff'
import type { Revision } from './revision'

/**
 * Line-by-line attribution: which revision introduced this line? Computed
 * client-side from the chain — every line therefore carries an npub, and that
 * is where "bound to an npub" becomes checkable.
 * docs/05-versioning-history.md
 */
export type BlameLine = {
  text: string
  revision: Revision
}

/**
 * The chain from the head backwards along the first parent. For a merge
 * revision that is the first `parent-rev` entry; the lines of the second branch
 * then appear as introduced by the merge. That is the same simplification
 * `git blame` makes without extra options.
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
