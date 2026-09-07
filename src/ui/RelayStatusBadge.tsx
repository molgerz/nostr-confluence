import type { AuthState, RelaySnapshot } from '../nostr/client'
import type { RelayInfo } from '../nostr/relay-status'

const CONNECTION_LABEL = {
  connecting: 'verbinde…',
  online: 'verbunden',
  offline: 'offline',
} as const

const CONNECTION_DOT = {
  connecting: 'bg-warning',
  online: 'bg-success',
  offline: 'bg-danger',
} as const

const AUTH_LABEL: Record<AuthState, string> = {
  none: 'nicht verlangt',
  pending: 'läuft…',
  ok: 'bestätigt',
  failed: 'fehlgeschlagen',
}

/**
 * Ohne Relay ist nichts publizierbar, und ohne AUTH schlägt ein Publish auf
 * einem NIP-42-Relay fehl. Beide Zustände gehören dauerhaft sichtbar in die
 * Sidebar. docs/06-ui-information-architecture.md
 */
export function RelayStatusBadge({
  snapshot,
  info,
}: {
  snapshot: RelaySnapshot
  info: RelayInfo | null
}) {
  const { connection, attempts, auth, authMessage } = snapshot
  return (
    <div className="space-y-1 border-t border-line px-2 pt-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${CONNECTION_DOT[connection]}`}
          aria-hidden="true"
        />
        <span className="text-fg-muted">
          Relay {CONNECTION_LABEL[connection]}
          {connection === 'offline' && attempts > 0 ? ` (Versuch ${attempts})` : ''}
        </span>
      </div>

      <div className="truncate font-mono text-fg-subtle" title={snapshot.url}>
        {info?.name ?? snapshot.url.replace(/^wss?:\/\//, '')}
      </div>

      <div className={auth === 'failed' ? 'text-danger' : 'text-fg-subtle'}>
        AUTH: {AUTH_LABEL[auth]}
        {auth === 'failed' && authMessage ? ` — ${authMessage}` : ''}
      </div>

      {info ? (
        <div className="text-fg-subtle">
          NIP-29:{' '}
          {info.supportsNip29 ? (
            <span className="text-success">unterstützt</span>
          ) : (
            <span className="text-warning">nein, Gruppen simuliert</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
