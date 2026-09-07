import type { Revision } from './revision'

/**
 * Eine Seite ist `(Gruppe, Slug)` — kein einzelnes Event. Ihr aktueller Inhalt
 * ist der Kopf ihrer Revisionskette. docs/02-data-model-events.md
 */
export type Page = {
  slug: string
  title: string
  parentSlug: string | null
  /** angezeigte Revision */
  head: Revision
  /** alle Revisionen, jüngste zuerst */
  revisions: Revision[]
  /** Blätter der Kette. Mehr als eins = Verzweigung */
  leaves: Revision[]
}

function sortNewestFirst(a: Revision, b: Revision): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt
  // Bei gleichem Zeitstempel deterministisch nach id, damit alle Clients
  // dieselbe Seite anzeigen.
  return a.id < b.id ? -1 : 1
}

/**
 * Aus allen Revisionen einer Gruppe die Seiten bilden.
 *
 * Head-Auflösung: Blätter sind Revisionen, auf die keine andere per
 * `parent-rev` zeigt. Bei mehreren Blättern (gleichzeitige Bearbeitung) wird
 * das jüngste angezeigt, die Verzweigung aber nicht verschwiegen — `leaves`
 * behält alle. docs/05-versioning-history.md
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
 * Seitenbaum für die Sidebar. Seiten, deren Elternseite es nicht (mehr) gibt,
 * hängen auf oberster Ebene — verstecken wäre schlimmer als falsch einsortieren.
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
 * Gemeinsamen Vorfahren zweier Revisionen suchen — die Basis für einen
 * 3-Wege-Merge. Gibt es keinen (zwei unabhängige Wurzeln), ist das Ergebnis
 * null; der Merge läuft dann gegen eine leere Basis und meldet ehrlich einen
 * Konflikt, statt eine Seite stillschweigend zu bevorzugen.
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
