import { Link } from 'react-router-dom'
import { useMySpaces } from '../nostr/my-spaces'
import { useSession } from '../session/session'
import { CreateSpaceForm } from '../ui/CreateSpaceForm'
import { SignInButton } from '../ui/SignInButton'
import { PageFrame, PageTitle } from '../ui/layout/PageFrame'
import { InitialsDisc, SectionLabel } from '../ui/controls'
import { ChevronRightIcon, PlusIcon, SpaceIcon } from '../ui/icons'

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
  const { session } = useSession()
  const { spaces, loading, error } = useMySpaces(
    session.status === 'signed-in' ? session.pubkey : null,
  )

  return (
    <PageFrame width="wide" crumbs={[{ label: 'Spaces' }]}>
      <PageTitle
        below={
          <p className="max-w-[60ch] text-base text-fg-muted">
            A space is a NIP-29 group on a relay — invite-only, so this list only shows
            what your npub is already a member of.
          </p>
        }
      >
        Spaces
      </PageTitle>

      <div className="mt-8 mb-3 flex items-center gap-2">
        <SpaceIcon className="size-4 text-fg-subtle" />
        <SectionLabel>Your spaces</SectionLabel>
      </div>
      {session.status === 'signed-in' ? (
        error ? (
          <p className="text-sm text-fg-muted">
            Could not reach the relay to look up your spaces. Is it running?
          </p>
        ) : spaces.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {spaces.map((space) => (
              <SpaceCard key={space.address} name={space.name} address={space.address} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            {loading ? 'looking for spaces you are a member of…' : 'No spaces found for your npub yet.'}
          </p>
        )
      ) : (
        <p className="text-sm text-fg-muted">
          <SignInButton variant="inline">Sign in</SignInButton> to see the spaces you are a
          member of.
        </p>
      )}

      <div className="mt-8 mb-3 flex items-center gap-2">
        <PlusIcon className="size-4 text-fg-subtle" />
        <SectionLabel>New space</SectionLabel>
      </div>
      <CreateSpaceForm />
    </PageFrame>
  )
}
