import { NavLink } from 'react-router-dom'
import type { GroupAddress } from '../../nostr/group-address'
import { RelayStatusBadge } from '../RelayStatusBadge'
import type { RelayStatus } from '../../nostr/relay-status'

type Props = {
  group: GroupAddress | null
  status: RelayStatus
  relayUrl: string
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'block rounded-md bg-accent-bg px-2 py-1.5 text-sm font-medium text-accent-fg'
    : 'block rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-2'
}

/**
 * Linke Leiste wie in Confluence, vier Zonen von oben: Space-Kopf, feste
 * Einträge, Seitenbaum, Fußzeile mit Relay-Status.
 * docs/06-ui-information-architecture.md
 */
export function Sidebar({ group, status, relayUrl }: Props) {
  const base = group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface-1 p-2">
      {group ? (
        <div className="px-2 pt-1 pb-3">
          <div className="text-sm font-medium text-fg">{group.id}</div>
          <div className="truncate font-mono text-xs text-fg-subtle" title={group.host}>
            {group.host}
          </div>
        </div>
      ) : (
        <div className="px-2 pt-1 pb-3 text-sm text-fg-subtle">kein Space gewählt</div>
      )}

      {base ? (
        <>
          <NavLink to={base} end className={itemClass}>
            Übersicht
          </NavLink>
          <NavLink to={`${base}/handbuch`} className={itemClass}>
            Alle Seiten
          </NavLink>
          <span className="block px-2 py-1.5 text-sm text-fg-subtle" title="Phase 2">
            Mitglieder
          </span>

          <div className="my-2 border-t border-line" />

          <div className="px-2 text-xs text-fg-subtle">
            Seitenbaum entsteht in Phase 3 aus den Revisions-Events
          </div>
        </>
      ) : null}

      <div className="flex-1" />
      <RelayStatusBadge status={status} relayUrl={relayUrl} />
    </nav>
  )
}
