import { Link } from 'react-router-dom'
import { useMySpaces } from '../nostr/my-spaces'
import { useSession } from '../session/session'
import { SignInButton } from '../ui/SignInButton'
import { CreateSpaceForm } from '../ui/CreateSpaceForm'
import { PageFrame, PageTitle } from '../ui/layout/PageFrame'
import { ButtonLink, Card, InitialsDisc, SectionLabel } from '../ui/controls'
import { ChevronRightIcon, PlusIcon, SettingsIcon } from '../ui/icons'

/**
 * The one place to get into a space: every space the signed-in npub is a
 * member of, opening it on click. An admin row additionally carries an
 * "Admin" button into /settings/spaces/:group — labelled, not just an icon,
 * so it reads as "you can administer this one" rather than an unexplained
 * gear. Everyone else has nothing to configure there, so nothing points them
 * at a dead end.
 */
export function SpacesSettingsList() {
  const { session } = useSession()
  const { spaces, loading, error } = useMySpaces(
    session.status === 'signed-in' ? session.pubkey : null,
  )

  if (session.status !== 'signed-in') {
    return (
      <PageFrame crumbs={[{ label: 'Settings' }, { label: 'Spaces' }]}>
        <PageTitle>Spaces</PageTitle>
        <SignInButton>Sign in with Nostr</SignInButton>
      </PageFrame>
    )
  }

  return (
    <PageFrame crumbs={[{ label: 'Settings' }, { label: 'Spaces' }]}>
      <PageTitle
        below={
          <p className="max-w-[60ch] text-base text-fg-muted">
            A space is a NIP-29 group on a relay — invite-only, so this only shows what your
            npub is already a member of.
          </p>
        }
      >
        Spaces
      </PageTitle>

      {error ? (
        <p className="text-sm text-fg-muted">
          Could not reach the relay to look up your spaces. Is it running?
        </p>
      ) : spaces.length === 0 ? (
        <p className="text-sm text-fg-muted">
          {loading ? 'looking for spaces you are a member of…' : 'No spaces found for your npub yet.'}
        </p>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {spaces.map((space) => (
              <li key={space.address} className="flex items-center gap-1 pr-2">
                <Link
                  to={`/s/${encodeURIComponent(space.address)}`}
                  className="flex min-w-0 flex-1 items-center gap-3.5 px-3.5 py-2.5 hover:bg-surface-hover"
                >
                  <InitialsDisc name={space.name} className="size-8 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{space.name}</span>
                    <span className="block truncate font-mono text-xs text-fg-subtle">
                      {space.address}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-fg-subtle" />
                </Link>
                {space.isAdmin ? (
                  <ButtonLink
                    to={`/settings/spaces/${encodeURIComponent(space.address)}`}
                    variant="subtle"
                    size="sm"
                    title={`Admin settings for ${space.name}`}
                  >
                    <SettingsIcon className="size-3.5" />
                    Admin
                  </ButtonLink>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-8 mb-3 flex items-center gap-2">
        <PlusIcon className="size-4 text-fg-subtle" />
        <SectionLabel>New space</SectionLabel>
      </div>
      <CreateSpaceForm />
    </PageFrame>
  )
}
