import type { AuthState, RelaySnapshot } from '../nostr/client'
import type { RelayInfo } from '../nostr/relay-status'

const CONNECTION_LABEL = {
  connecting: 'connecting…',
  online: 'connected',
  offline: 'offline',
} as const

const CONNECTION_DOT = {
  connecting: 'bg-warning',
  online: 'bg-success',
  offline: 'bg-danger',
} as const

const AUTH_LABEL: Record<AuthState, string> = {
  none: 'not requested',
  pending: 'in progress…',
  ok: 'confirmed',
  failed: 'failed',
}

/**
 * Without a relay nothing can be published, and without AUTH a publish fails on
 * a NIP-42 relay. Both states belong permanently visible in the sidebar.
 * docs/06-ui-information-architecture.md
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
          {connection === 'offline' && attempts > 0 ? ` (attempt ${attempts})` : ''}
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
            <span className="text-success">supported</span>
          ) : (
            <span className="text-warning">no — groups are not enforced</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
