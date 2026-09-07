import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { GroupAddress } from '../../nostr/group-address'
import { RelayStatusBadge } from '../RelayStatusBadge'
import type { RelaySnapshot } from '../../nostr/client'
import type { RelayInfo } from '../../nostr/relay-status'
import type { SpaceSnapshot } from '../../nostr/space-store'
import { flattenTree } from '../../domain/pages'

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

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar({ group, space, snapshot, info, alwaysExpanded = false }: Props) {
  const base = group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null
  const nodes = flattenTree(space.tree)
  const [collapsedPreference, setCollapsed] = useState(readCollapsed)
  const collapsed = alwaysExpanded ? false : collapsedPreference

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
            nodes.map((node) => (
              <NavLink
                key={node.slug}
                to={`${base}/${node.slug}`}
                className={itemClass}
                style={{ paddingLeft: `${8 + node.depth * 12}px` }}
              >
                <span className="truncate">{node.title}</span>
                {node.leaves.length > 1 ? <span className="text-warning"> ●</span> : null}
              </NavLink>
            ))
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
