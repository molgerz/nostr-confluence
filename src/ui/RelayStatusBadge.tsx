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

/** The whole state as one line of text, for a tooltip. */
function summary(snapshot: RelaySnapshot, info: RelayInfo | null): string {
  const parts = [
    snapshot.url,
    `relay ${CONNECTION_LABEL[snapshot.connection]}${
      snapshot.connection === 'offline' && snapshot.attempts > 0
        ? ` (attempt ${snapshot.attempts})`
        : ''
    }`,
    `AUTH ${AUTH_LABEL[snapshot.auth]}${
      snapshot.auth === 'failed' && snapshot.authMessage ? ` — ${snapshot.authMessage}` : ''
    }`,
  ]
  if (info) {
    parts.push(info.supportsNip29 ? 'NIP-29 supported' : 'NIP-29 missing — groups are not enforced')
  }
  return parts.join('\n')
}

/**
 * The relay in the top bar: a dot, and the name only where there is room for
 * it. It belongs in the global bar rather than in the left one because the
 * left one folds away — and "nothing can be published right now" is not a
 * thing to hide behind a fold.
 *
 * Quiet while everything is fine, and loud the moment it is not: a failed AUTH
 * or a relay that has dropped gets the colour and the word, because that is
 * the state somebody has to act on.
 * docs/06-ui-information-architecture.md
 */
export function RelayIndicator({
  snapshot,
  info,
}: {
  snapshot: RelaySnapshot
  info: RelayInfo | null
}) {
  const broken = snapshot.connection === 'offline' || snapshot.auth === 'failed'
  const name = info?.name ?? snapshot.url.replace(/^wss?:\/\//, '')

  return (
    <span
      title={summary(snapshot, info)}
      className={`flex h-8 items-center gap-2 rounded-md px-2 text-xs ${
        broken ? 'bg-danger-bg text-danger' : 'text-fg-subtle hover:bg-surface-hover'
      }`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${CONNECTION_DOT[snapshot.connection]}`}
        aria-hidden="true"
      />
      <span className="hidden max-w-40 truncate lg:inline">
        {broken
          ? snapshot.connection === 'offline'
            ? CONNECTION_LABEL.offline
            : 'AUTH failed'
          : name}
      </span>
      {/* Said out loud once, for the reader who cannot see the dot. */}
      <span className="sr-only">
        Relay {CONNECTION_LABEL[snapshot.connection]}, AUTH {AUTH_LABEL[snapshot.auth]}
      </span>
    </span>
  )
}

/**
 * The same state spelled out at the foot of the left bar. Without a relay
 * nothing can be published, and without AUTH a publish fails on a NIP-42
 * relay — so the detail stays somewhere it can be read rather than hovered.
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
    <div className="space-y-1 border-t border-line px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${CONNECTION_DOT[connection]}`}
          aria-hidden="true"
        />
        <span className="truncate text-fg-muted" title={snapshot.url}>
          {info?.name ?? snapshot.url.replace(/^wss?:\/\//, '')}
        </span>
      </div>

      <div className="pl-4 text-fg-subtle">
        {CONNECTION_LABEL[connection]}
        {connection === 'offline' && attempts > 0 ? ` (attempt ${attempts})` : ''}
      </div>

      <div className={`pl-4 ${auth === 'failed' ? 'text-danger' : 'text-fg-subtle'}`}>
        AUTH: {AUTH_LABEL[auth]}
        {auth === 'failed' && authMessage ? ` — ${authMessage}` : ''}
      </div>

      {/* Only worth a line when it is a problem: a relay that speaks NIP-29 is
          the expected case, and the footer has four other things to say. */}
      {info && !info.supportsNip29 ? (
        <div className="pl-4 text-warning">NIP-29: no — groups are not enforced</div>
      ) : null}
    </div>
  )
}
