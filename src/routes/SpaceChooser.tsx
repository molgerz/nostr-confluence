import { Link } from 'react-router-dom'
import { DEFAULT_RELAY_URL } from '../nostr/relay-status'
import { PhaseNote } from '../ui/Phase'

const LOCAL_HOST = DEFAULT_RELAY_URL.replace(/^wss?:\/\//, '')
const SEEDED = `${LOCAL_HOST}'engineering`

export function SpaceChooser() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-fg">Spaces</h1>
      <p className="text-sm text-fg-muted">
        A space is a NIP-29 group on a relay. The one below is the space that{' '}
        <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-xs">
          scripts/dev-group-seed.sh
        </code>{' '}
        creates on the local NIP-29 relay via{' '}
        <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-xs">nak group</code>.
      </p>
      <Link
        to={`/s/${encodeURIComponent(SEEDED)}`}
        className="block rounded-xl border border-line bg-surface-1 p-4 hover:border-line-strong"
      >
        <div className="text-sm font-medium text-fg">engineering</div>
        <div className="mt-0.5 font-mono text-xs text-fg-subtle">{SEEDED}</div>
      </Link>
      <PhaseNote phase="Phase 2">
        Later this will list the spaces your npub is a member of according to event 39002.
      </PhaseNote>
    </div>
  )
}
