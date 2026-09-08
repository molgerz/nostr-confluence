import { Link } from 'react-router-dom'
import { DEFAULT_RELAY_URL } from '../nostr/relay-status'
import { PhaseNote } from '../ui/Phase'
import { PageFrame, PageTitle } from '../ui/layout/PageFrame'
import { InitialsDisc, SectionLabel } from '../ui/controls'
import { ChevronRightIcon, SpaceIcon } from '../ui/icons'

const LOCAL_HOST = DEFAULT_RELAY_URL.replace(/^wss?:\/\//, '')
const SEEDED = `${LOCAL_HOST}'engineering`

/**
 * A space as a card: the disc, the name, and the address underneath in
 * monospace. The address is the whole identity of a space here — relay host
 * plus group id — so it is shown rather than tucked into a tooltip, and it is
 * the one thing on the card set in mono, because it is meant to be compared
 * character by character.
 */
function SpaceCard({ name, address }: { name: string; address: string }) {
  return (
    <Link
      to={`/s/${encodeURIComponent(address)}`}
      className="group flex items-center gap-3.5 rounded-lg border border-line bg-surface-2 p-4 hover:border-line-strong hover:bg-surface-hover"
    >
      <InitialsDisc name={name} className="size-10 text-sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{name}</span>
        <span className="block truncate font-mono text-xs text-fg-subtle">{address}</span>
      </span>
      <ChevronRightIcon className="size-4 text-fg-subtle group-hover:text-fg-muted" />
    </Link>
  )
}

export function SpaceChooser() {
  return (
    <PageFrame width="wide" crumbs={[{ label: 'Spaces' }]}>
      <PageTitle
        below={
          <p className="max-w-[60ch] text-base text-fg-muted">
            A space is a NIP-29 group on a relay. The one below is the space that{' '}
            <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-sm">
              scripts/dev-group-seed.sh
            </code>{' '}
            creates on the local NIP-29 relay via{' '}
            <code className="rounded bg-code-bg px-1 py-0.5 font-mono text-sm">nak group</code>.
          </p>
        }
      >
        Spaces
      </PageTitle>

      <div className="mt-8 mb-3 flex items-center gap-2">
        <SpaceIcon className="size-4 text-fg-subtle" />
        <SectionLabel>Spaces you can open</SectionLabel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SpaceCard name="engineering" address={SEEDED} />
      </div>

      <div className="mt-8">
        <PhaseNote phase="Phase 2">
          Later this will list the spaces your npub is a member of according to event 39002.
        </PhaseNote>
      </div>
    </PageFrame>
  )
}
