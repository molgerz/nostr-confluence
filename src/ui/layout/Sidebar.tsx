import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import type { GroupAddress } from '../../nostr/group-address'
import { RelayStatusBadge } from '../RelayStatusBadge'
import type { RelaySnapshot } from '../../nostr/client'
import type { RelayInfo } from '../../nostr/relay-status'
import type { SpaceSnapshot } from '../../nostr/space-store'
import type { PageNode } from '../../domain/pages'

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

export function Sidebar({ group, space, snapshot, info, alwaysExpanded = false }: Props) {
  const base = group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null
  const nodes = space.tree
  const { slug } = useParams<{ slug?: string }>()
  const [collapsedPreference, setCollapsed] = useState(readCollapsed)
  const [collapsedBranches, setCollapsedBranches] = useState(readCollapsedBranches)
  const collapsed = alwaysExpanded ? false : collapsedPreference
  const forcedOpen = pathToActive(nodes, slug)

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
              collapsedBranches={collapsedBranches}
              forcedOpen={forcedOpen}
              onToggle={toggleBranch}
            />
          )}

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
  const shared = 'min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm'
  return isActive
    ? `${shared} bg-accent-bg font-medium text-accent-fg`
    : `${shared} text-fg-muted hover:bg-surface-2`
}

/**
 * One level of the page tree. Branches fold; leaves get a spacer of the same
 * width as a triangle so their titles stay on one vertical line instead of
 * stepping in and out depending on whether a sibling has children.
 */
function TreeBranch({
  nodes,
  base,
  collapsedBranches,
  forcedOpen,
  onToggle,
}: {
  nodes: PageNode[]
  base: string
  collapsedBranches: Set<string>
  forcedOpen: Set<string>
  onToggle: (slug: string) => void
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const open = hasChildren && (forcedOpen.has(node.slug) || !collapsedBranches.has(node.slug))

        return (
          <div key={node.slug}>
            <div
              className="flex items-center"
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
                <span className="w-4 shrink-0" aria-hidden="true" />
              )}
              <NavLink to={`${base}/${node.slug}`} className={treeItemClass}>
                {node.title}
                {node.leaves.length > 1 ? <span className="text-warning"> ●</span> : null}
              </NavLink>
            </div>

            {open ? (
              <TreeBranch
                nodes={node.children}
                base={base}
                collapsedBranches={collapsedBranches}
                forcedOpen={forcedOpen}
                onToggle={onToggle}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}
