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
        Ein Space ist eine NIP-29-Gruppe auf einem Relay. Der Space unten ist der, den{' '}
        <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-xs">
          scripts/dev-relay-seed.sh
        </code>{' '}
        auf dem lokalen Testrelay anlegt.
      </p>
      <Link
        to={`/s/${encodeURIComponent(SEEDED)}`}
        className="block rounded-xl border border-line bg-surface-1 p-4 hover:border-line-strong"
      >
        <div className="text-sm font-medium text-fg">engineering</div>
        <div className="mt-0.5 font-mono text-xs text-fg-subtle">{SEEDED}</div>
      </Link>
      <PhaseNote phase="Phase 2">
        Hier stehen später die Spaces, in denen dein npub laut Event 39002 Mitglied ist.
      </PhaseNote>
    </div>
  )
}
