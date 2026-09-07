import type { RelayStatus } from '../nostr/relay-status'

const LABELS: Record<RelayStatus['state'], string> = {
  connecting: 'verbinde…',
  online: 'verbunden',
  offline: 'offline',
}

const DOT: Record<RelayStatus['state'], string> = {
  connecting: 'bg-warning',
  online: 'bg-success',
  offline: 'bg-danger',
}

/**
 * Ohne Relay ist nichts publizierbar — der Zustand gehört deshalb dauerhaft
 * sichtbar in die Sidebar, nicht in eine Toast-Meldung.
 * docs/06-ui-information-architecture.md
 */
export function RelayStatusBadge({ status, relayUrl }: { status: RelayStatus; relayUrl: string }) {
  const { state, info, attempts } = status
  return (
    <div className="border-t border-line px-2 pt-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${DOT[state]}`} aria-hidden="true" />
        <span className="text-fg-muted">
          Relay {LABELS[state]}
          {state === 'offline' && attempts > 0 ? ` (Versuch ${attempts})` : ''}
        </span>
      </div>
      <div className="mt-1 truncate font-mono text-fg-subtle" title={relayUrl}>
        {info?.name ?? relayUrl.replace(/^wss?:\/\//, '')}
      </div>
      {info ? (
        <div className="mt-1 text-fg-subtle">
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
