import type { Revision } from './revision'

/**
 * A page is `(group, slug)` — not a single event. Its current content is the
 * head of its revision chain. docs/02-data-model-events.md
 */
export type Page = {
  slug: string
  title: string
  parentSlug: string | null
  /** the revision being displayed */
  head: Revision
  /** all revisions, newest first */
  revisions: Revision[]
  /** leaves of the chain. More than one = a fork */
  leaves: Revision[]
}

function sortNewestFirst(a: Revision, b: Revision): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
  // On equal timestamps, order by id so that every client shows the same
  // page.
  return a.id < b.id ? -1 : 1
}

/**
 * Builds the pages from all revisions of a group.
 *
 * Head resolution: leaves are revisions no other revision points at via
 * `parent-rev`. With several leaves (concurrent editing) the newest is
 * displayed, but the fork is not hidden — `leaves` keeps all of them.
 * docs/05-versioning-history.md
 */
export function buildPages(revisions: Revision[]): Page[] {
  const bySlug = new Map<string, Revision[]>()
  for (const revision of revisions) {
    const list = bySlug.get(revision.slug)
    if (list) list.push(revision)
    else bySlug.set(revision.slug, [revision])
  }

  const pages: Page[] = []
  for (const [slug, list] of bySlug) {
    const sorted = [...list].sort(sortNewestFirst)
    const referenced = new Set<string>()
    for (const revision of sorted) {
      for (const parent of revision.parentRevs) referenced.add(parent)
    }
    const leaves = sorted.filter((revision) => !referenced.has(revision.id))
    const head = leaves[0] ?? sorted[0]
    pages.push({
      slug,
      title: head.title,
      parentSlug: head.parentSlug,
      head,
      revisions: sorted,
      leaves,
    })
  }

  return pages.sort((a, b) => a.title.localeCompare(b.title, 'de'))
}

export type PageNode = Page & { children: PageNode[]; depth: number }

/**
 * The page tree for the sidebar. Pages whose parent does not (or no longer)
 * exist hang at the top level — hiding them would be worse than filing them in
 * the wrong place.
 */
export function buildTree(pages: Page[]): PageNode[] {
  const nodes = new Map<string, PageNode>()
  for (const page of pages) nodes.set(page.slug, { ...page, children: [], depth: 0 })

  const roots: PageNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentSlug ? nodes.get(node.parentSlug) : undefined
    if (parent && parent.slug !== node.slug) parent.children.push(node)
    else roots.push(node)
  }

  const setDepth = (list: PageNode[], depth: number) => {
    for (const node of list) {
      node.depth = depth
      setDepth(node.children, depth + 1)
    }
  }
  setDepth(roots, 0)
  return roots
}

export function flattenTree(nodes: PageNode[]): PageNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/**
 * Finds the common ancestor of two revisions — the base for a three-way merge.
 * When there is none (two independent roots) the result is null; the merge then
 * runs against an empty base and honestly reports a conflict instead of
 * silently favouring one side.
 */
export function findCommonAncestor(
  revisions: Revision[],
  a: Revision,
  b: Revision,
): Revision | null {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]))

  const ancestorsOfA = new Set<string>()
  const queue = [a.id]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (ancestorsOfA.has(id)) continue
    ancestorsOfA.add(id)
    const revision = byId.get(id)
    if (revision) queue.push(...revision.parentRevs)
  }

  const seen = new Set<string>()
  const search = [b.id]
  while (search.length > 0) {
    const id = search.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    if (ancestorsOfA.has(id) && id !== b.id) return byId.get(id) ?? null
    if (ancestorsOfA.has(id) && id === b.id && id !== a.id) return byId.get(id) ?? null
    const revision = byId.get(id)
    if (revision) search.push(...revision.parentRevs)
  }
  return null
}
