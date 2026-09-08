import { useEffect, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import type { GroupAddress } from '../../nostr/group-address'
import { RelayStatusBadge } from '../RelayStatusBadge'
import type { RelaySnapshot } from '../../nostr/client'
import type { RelayInfo } from '../../nostr/relay-status'
import type { SpaceSnapshot } from '../../nostr/space-store'
import { descendantSlugs, orderKeyOf } from '../../domain/pages'
import type { Page, PageNode } from '../../domain/pages'
import { keyBetween } from '../../domain/order'
import { useMovePage } from '../move-page'

type Props = {
  group: GroupAddress | null
  space: SpaceSnapshot
  snapshot: RelaySnapshot
  info: RelayInfo | null
  /** collapsing makes no sense in the mobile overlay — always expanded there */
  alwaysExpanded?: boolean
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'block rounded-md bg-accent-bg px-2 py-1.5 text-sm font-medium text-accent-fg'
    : 'block rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2'
}

/**
 * The left bar, like in Confluence: space header, fixed entries, page tree and
 * a footer with relay and AUTH status. The tree is a projection of the revision
 * events, not an index event of its own.
 * docs/06-ui-information-architecture.md
 */
const COLLAPSE_KEY = 'nc-sidebar-collapsed'
const BRANCH_KEY = 'nc-sidebar-collapsed-branches'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Which branches are folded away. Storing the *collapsed* ones rather than the
 * open ones means a page created later shows up instead of hiding until
 * somebody expands its parent.
 */
function readCollapsedBranches(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(BRANCH_KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/**
 * The chain of parents above `slug`. The branch leading to the page you are
 * reading is always drawn open — otherwise a fold could hide the very page you
 * are on, and the highlighted row would be nowhere to be seen.
 */
function pathToActive(nodes: PageNode[], slug: string | undefined): Set<string> {
  const path = new Set<string>()
  if (!slug) return path
  const parents = new Map<string, string | null>()
  const walk = (list: PageNode[]) => {
    for (const node of list) {
      for (const child of node.children) parents.set(child.slug, node.slug)
      walk(node.children)
    }
  }
  walk(nodes)
  let cursor = parents.get(slug) ?? null
  while (cursor && !path.has(cursor)) {
    path.add(cursor)
    cursor = parents.get(cursor) ?? null
  }
  return path
}

/**
 * Where a drag currently points. Two kinds, as in Confluence: **on** a row
 * files the page under it, **into the gap** between two rows puts it at that
 * position of *their* level, staying a sibling instead of becoming a subpage.
 */
type DropTarget = { kind: 'page' | 'gap'; id: string }

function sameTarget(a: DropTarget | null, b: DropTarget): boolean {
  return a !== null && a.kind === b.kind && a.id === b.id
}

/** Everything a tree row needs to be dragged, and to be dropped on. */
type TreeDnd = {
  enabled: boolean
  dragging: string | null
  over: DropTarget | null
  busySlug: string | null
  /** filing it under this page */
  canDropOnPage: (slug: string) => boolean
  /** putting it at some position of the level below this page (null = root) */
  canDropInLevel: (parentSlug: string | null) => boolean
  onDragStart: (slug: string) => void
  onDragEnd: () => void
  onOver: (target: DropTarget) => void
  onLeave: (target: DropTarget) => void
  onDropOnPage: (slug: string) => void
  onDropInGap: (parentSlug: string | null, before: PageNode | null, after: PageNode | null) => void
}

export function Sidebar({ group, space, snapshot, info, alwaysExpanded = false }: Props) {
  const base = group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null
  const nodes = space.tree
  const { slug } = useParams<{ slug?: string }>()
  const [collapsedPreference, setCollapsed] = useState(readCollapsed)
  const [collapsedBranches, setCollapsedBranches] = useState(readCollapsedBranches)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<DropTarget | null>(null)
  const { move, busySlug, error, setError, signedIn } = useMovePage(
    group?.relayUrl ?? '',
    group?.id ?? '',
    space.pages,
  )
  const collapsed = alwaysExpanded ? false : collapsedPreference
  const forcedOpen = pathToActive(nodes, slug)

  // Dragging a page onto another one files it there, dragging it into the gap
  // between two rows puts it at that position of their level — the same two
  // gestures Confluence has. In both cases the page's own subtree is barred:
  // the branch would point into itself and drop out of the tree.
  const draggedPage = dragging ? (space.pages.find((page) => page.slug === dragging) ?? null) : null
  const blocked = dragging ? descendantSlugs(space.pages, dragging) : null
  const pageBySlug = (slug: string | null): Page | null =>
    slug ? (space.pages.find((entry) => entry.slug === slug) ?? null) : null

  const canDropInLevel = (parentSlug: string | null): boolean => {
    if (!draggedPage) return false
    return parentSlug === null || !blocked!.has(parentSlug)
  }

  const canDropOnPage = (slug: string): boolean =>
    // Its current parent is no target: it is already filed there, and a drop
    // that publishes nothing should not light up as if it would.
    canDropInLevel(slug) && draggedPage!.parentSlug !== slug

  const dnd: TreeDnd = {
    enabled: signedIn,
    dragging,
    over,
    busySlug,
    canDropOnPage,
    canDropInLevel,
    onDragStart: (dragged) => {
      setError(null)
      setDragging(dragged)
    },
    onDragEnd: () => {
      setDragging(null)
      setOver(null)
    },
    onOver: (target) => setOver((current) => (sameTarget(current, target) ? current : target)),
    onLeave: (target) => setOver((current) => (sameTarget(current, target) ? null : current)),
    onDropOnPage: (slug) => {
      const page = draggedPage
      const allowed = canDropOnPage(slug)
      setDragging(null)
      setOver(null)
      // No position of its own: in its new level the page sorts by its title
      // until somebody drags it into place. src/domain/order.ts
      if (page && allowed) void move(page, { parent: pageBySlug(slug), order: null })
    },
    onDropInGap: (parentSlug, before, after) => {
      const page = draggedPage
      const allowed = canDropInLevel(parentSlug)
      setDragging(null)
      setOver(null)
      if (!page || !allowed) return
      void move(page, {
        parent: pageBySlug(parentSlug),
        order: keyBetween(before ? orderKeyOf(before) : null, after ? orderKeyOf(after) : null),
      })
    },
  }

  // A drag can end without the source seeing `dragend`: it is cancelled with
  // Escape, dropped outside the window, or the row unmounts mid-drag because a
  // relay event rebuilt the tree. The drag state would then stay set, and the
  // gap zones would keep lying over the row edges swallowing clicks. Listening
  // on the window closes that off for good.
  useEffect(() => {
    if (dragging === null) return
    const clear = () => {
      setDragging(null)
      setOver(null)
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [dragging])

  const toggleBranch = (branchSlug: string) => {
    setCollapsedBranches((current) => {
      const next = new Set(current)
      if (next.has(branchSlug)) next.delete(branchSlug)
      else next.add(branchSlug)
      try {
        localStorage.setItem(BRANCH_KEY, JSON.stringify([...next]))
      } catch {
        /* then it only applies to this session */
      }
      return next
    })
  }

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1')
      } catch {
        /* then it only applies to this session */
      }
      return !value
    })
  }

  if (collapsed) {
    return (
      <nav className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-line bg-surface-1 py-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-surface-2"
        >
          »
        </button>
        <div className="flex-1" />
        <span
          className={`size-2 rounded-full ${snapshot.connection === 'online' ? 'bg-success' : snapshot.connection === 'connecting' ? 'bg-warning' : 'bg-danger'}`}
          title={`Relay ${snapshot.connection}`}
        />
      </nav>
    )
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface-1 p-2">
      <div className="flex items-start gap-1 px-2 pt-1 pb-3">
        <div className="min-w-0 flex-1">
          {group ? (
            <>
              <div className="truncate text-sm font-medium text-fg">
                {space.metadata?.name ?? group.id}
              </div>
              <div className="truncate font-mono text-xs text-fg-subtle" title={group.host}>
                {group.host}
              </div>
            </>
          ) : (
            <div className="text-sm text-fg-subtle">no space selected</div>
          )}
        </div>
        {alwaysExpanded ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="rounded-md px-1.5 py-0.5 text-sm text-fg-subtle hover:bg-surface-2"
          >
            «
          </button>
        )}
      </div>

      {base ? (
        <>
          <NavLink to={base} end className={itemClass}>
            Overview
          </NavLink>
          <NavLink to={`${base}/search`} className={itemClass}>
            Search
          </NavLink>

          <div className="my-2 border-t border-line" />

          {nodes.length === 0 ? (
            <div className="px-2 text-xs text-fg-subtle">
              {space.loading ? 'loading pages…' : 'no pages yet'}
            </div>
          ) : (
            <TreeBranch
              nodes={nodes}
              base={base}
              parentSlug={null}
              collapsedBranches={collapsedBranches}
              forcedOpen={forcedOpen}
              onToggle={toggleBranch}
              dnd={dnd}
            />
          )}

          {busySlug ? <div className="px-2 py-1 text-xs text-fg-subtle">moving…</div> : null}
          {error ? <div className="px-2 py-1 text-xs text-danger">{error}</div> : null}

          <div className="flex-1" />
          <Link
            to={`${base}/new`}
            className="block rounded-md px-2 py-1.5 text-xs font-medium text-accent-fg hover:bg-surface-2"
          >
            + New page
          </Link>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <RelayStatusBadge snapshot={snapshot} info={info} />
    </nav>
  )
}

function treeItemClass({ isActive }: { isActive: boolean }): string {
  const shared = 'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm'
  return isActive
    ? `${shared} bg-accent-bg font-medium text-accent-fg`
    : `${shared} text-fg-muted hover:bg-surface-2`
}

/**
 * Marks every row as a page. Decorative — the title already says which one, so
 * it is hidden from assistive technology. It inherits the row's colour instead
 * of fixing its own, so on the active row it follows into the accent colour
 * rather than sitting there grey.
 */
function PageIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2.5" />
      <path d="M5.75 6.5h4.5M5.75 9.5h3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * One level of the page tree. A branch gets a triangle to fold it, a leaf a dot
 * in the same slot — so titles stay on one vertical line instead of stepping in
 * and out depending on whether a sibling has children.
 */
function TreeBranch({
  nodes,
  base,
  parentSlug,
  collapsedBranches,
  forcedOpen,
  onToggle,
  dnd,
}: {
  nodes: PageNode[]
  base: string
  /** the page this level hangs under. null = the top level */
  parentSlug: string | null
  collapsedBranches: Set<string>
  forcedOpen: Set<string>
  onToggle: (slug: string) => void
  dnd: TreeDnd
}) {
  /**
   * The two rows a gap sits between, with the dragged page skipped: it is
   * about to leave its old place, so it must not be its own neighbour and set
   * the position it is measured against.
   */
  const neighbours = (index: number): [PageNode | null, PageNode | null] => [
    [...nodes.slice(0, index)].reverse().find((node) => node.slug !== dnd.dragging) ?? null,
    nodes.slice(index).find((node) => node.slug !== dnd.dragging) ?? null,
  ]

  /** A gap directly above or below the dragged row changes nothing. */
  const dropsInPlace = (index: number): boolean =>
    nodes[index - 1]?.slug === dnd.dragging || nodes[index]?.slug === dnd.dragging

  return (
    <>
      {nodes.map((node, index) => {
        const hasChildren = node.children.length > 0
        const open = hasChildren && (forcedOpen.has(node.slug) || !collapsedBranches.has(node.slug))

        return (
          // relative: the gap zones lie *over* the row edges instead of taking
          // space of their own, so the tree does not shift under the cursor
          // the moment a drag starts.
          <div key={node.slug} className="relative">
            <GapZone
              dnd={dnd}
              id={`${parentSlug ?? ''}#${index}`}
              parentSlug={parentSlug}
              neighbours={neighbours}
              index={index}
              depth={node.depth}
              edge="top"
              inPlace={dropsInPlace(index)}
            />
            <div
              draggable={dnd.enabled}
              onDragStart={(event) => {
                // Firefox starts no drag at all without a payload.
                event.dataTransfer.setData('text/plain', node.slug)
                event.dataTransfer.effectAllowed = 'move'
                dnd.onDragStart(node.slug)
              }}
              onDragEnd={dnd.onDragEnd}
              // Both dragenter and dragover have to be prevented: a target
              // that lets a single one of them through is not a drop target at
              // that moment, and the drop is silently discarded.
              onDragEnter={(event) => {
                if (!dnd.canDropOnPage(node.slug)) return
                event.preventDefault()
                dnd.onOver({ kind: 'page', id: node.slug })
              }}
              onDragOver={(event) => {
                if (!dnd.canDropOnPage(node.slug)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                dnd.onOver({ kind: 'page', id: node.slug })
              }}
              onDragLeave={(event) => {
                // dragleave also fires when the cursor crosses from one child
                // of the row to the next, and it bubbles. Without this the
                // highlight flickers off and on while the pointer stands still.
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                dnd.onLeave({ kind: 'page', id: node.slug })
              }}
              onDrop={(event) => {
                event.preventDefault()
                dnd.onDropOnPage(node.slug)
              }}
              title={
                dnd.enabled
                  ? 'Drag onto a page to file it under it, or between two rows to sort it there'
                  : undefined
              }
              className={`flex items-center rounded-md ${
                dnd.enabled ? 'cursor-grab select-none active:cursor-grabbing' : ''
              } ${
                sameTarget(dnd.over, { kind: 'page', id: node.slug })
                  ? 'ring-1 ring-accent-fg'
                  : ''
              } ${dnd.dragging === node.slug || dnd.busySlug === node.slug ? 'opacity-50' : ''}`}
              style={{ paddingLeft: `${node.depth * 12}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggle(node.slug)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${node.title}`}
                  title={`${open ? 'Collapse' : 'Expand'} ${node.title}`}
                  className="w-4 shrink-0 rounded text-xs text-fg-subtle hover:text-fg"
                >
                  {open ? '▾' : '▸'}
                </button>
              ) : (
                <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                  <span className="size-1 rounded-full bg-fg-subtle" />
                </span>
              )}
              {/* A link is draggable by default and would become the drag
                  source itself — as a *link* drag, whose effect is copy/link,
                  so a drop asking for `move` is thrown away. The row is
                  supposed to be the source, so the link declines. */}
              <NavLink
                to={`${base}/${node.slug}`}
                draggable={false}
                className={treeItemClass}
              >
                <PageIcon />
                <span className="truncate">{node.title}</span>
                {/* A forked page has more than one current version. Amber and
                    after the title, so it cannot be read as the leaf dot. */}
                {node.leaves.length > 1 ? (
                  <span className="text-warning" title="several open versions">
                    ●
                  </span>
                ) : null}
              </NavLink>
            </div>

            {open ? (
              <TreeBranch
                nodes={node.children}
                base={base}
                parentSlug={node.slug}
                collapsedBranches={collapsedBranches}
                forcedOpen={forcedOpen}
                onToggle={onToggle}
                dnd={dnd}
              />
            ) : null}

            {/* The last row of a level closes it off. Pinned to the bottom of
                this wrapper, which spans the row *and* its subtree, so the
                line appears below the branch — where that position is. */}
            {index === nodes.length - 1 ? (
              <GapZone
                dnd={dnd}
                id={`${parentSlug ?? ''}#${nodes.length}`}
                parentSlug={parentSlug}
                neighbours={neighbours}
                index={nodes.length}
                depth={node.depth}
                edge="bottom"
                inPlace={dropsInPlace(nodes.length)}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/**
 * The gap between two rows: dropping here makes the page a **sibling** at this
 * position, not a subpage. Only 7px tall and drawn as a line, like every tree
 * that offers this — the row itself stays the target for "file it under".
 */
function GapZone({
  dnd,
  id,
  parentSlug,
  neighbours,
  index,
  depth,
  edge,
  inPlace,
}: {
  dnd: TreeDnd
  id: string
  parentSlug: string | null
  neighbours: (index: number) => [PageNode | null, PageNode | null]
  index: number
  depth: number
  edge: 'top' | 'bottom'
  inPlace: boolean
}) {
  // Without a drag running the zone must not exist: it would swallow clicks
  // on the row edges underneath it.
  if (dnd.dragging === null || inPlace || !dnd.canDropInLevel(parentSlug)) return null

  const active = sameTarget(dnd.over, { kind: 'gap', id })
  const accept = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    dnd.onOver({ kind: 'gap', id })
  }

  return (
    <div
      onDragEnter={accept}
      onDragOver={(event) => {
        accept(event)
        event.dataTransfer.dropEffect = 'move'
      }}
      onDragLeave={() => dnd.onLeave({ kind: 'gap', id })}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const [before, after] = neighbours(index)
        dnd.onDropInGap(parentSlug, before, after)
      }}
      // 9px straddling the row edge: enough to hit with a mouse, little
      // enough that the row itself stays the target for "file it under".
      className={`absolute inset-x-0 z-10 h-[9px] ${
        edge === 'top' ? '-top-[4px]' : '-bottom-[4px]'
      }`}
    >
      {/* Indented to the level it would file the page into, so "sibling here"
          is distinguishable from "subpage of the row above" — but only by that
          level's own indent: the line spans the whole row it belongs to,
          including the slot the triangle and the leaf dot sit in. */}
      <div
        className={`h-full ${active ? 'flex items-center' : ''}`}
        style={{ marginLeft: `${depth * 12}px` }}
      >
        {active ? <span className="h-0.5 w-full rounded-full bg-accent-fg" /> : null}
      </div>
    </div>
  )
}
