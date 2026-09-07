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
  /** im Handy-Overlay ist Einklappen sinnlos — dort immer ausgeklappt */
  alwaysExpanded?: boolean
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'block rounded-md bg-accent-bg px-2 py-1.5 text-sm font-medium text-accent-fg'
    : 'block rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2'
}

/**
 * Linke Leiste wie in Confluence: Space-Kopf, feste Einträge, Seitenbaum,
 * Fußzeile mit Relay- und AUTH-Status. Der Baum ist eine Projektion der
 * Revisions-Events, kein eigenes Index-Event.
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
        /* dann gilt es nur für diese Sitzung */
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
          aria-label="Seitenleiste ausklappen"
          title="Seitenleiste ausklappen"
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
            <div className="text-sm text-fg-subtle">kein Space gewählt</div>
          )}
        </div>
        {alwaysExpanded ? null : (
          <button
            type="button"
            onClick={toggle}
            aria-label="Seitenleiste einklappen"
            title="Seitenleiste einklappen"
            className="rounded-md px-1.5 py-0.5 text-sm text-fg-subtle hover:bg-surface-2"
          >
            «
          </button>
        )}
      </div>

      {base ? (
        <>
          <NavLink to={base} end className={itemClass}>
            Übersicht
          </NavLink>
          <NavLink to={`${base}/search`} className={itemClass}>
            Suche
          </NavLink>

          <div className="my-2 border-t border-line" />

          {nodes.length === 0 ? (
            <div className="px-2 text-xs text-fg-subtle">
              {space.loading ? 'lade Seiten…' : 'noch keine Seiten'}
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
            + Seite erstellen
          </Link>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <RelayStatusBadge snapshot={snapshot} info={info} />
    </nav>
  )
}
