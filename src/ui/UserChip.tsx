import { Link } from 'react-router-dom'
import { useSession } from '../session/session'
import { SignInButton } from './SignInButton'
import { displayName } from '../nostr/profile'

/**
 * One's own account in the top bar: name, then the picture at the very edge.
 * The whole chip is one link to the profile settings — signing out lives down
 * there too, so that the outermost corner of the layout is not a destructive
 * action sitting next to a navigation target.
 *
 * The npub is deliberately not spelled out here. Unlike a byline this is not a
 * foreign identity that could be impersonating somebody; it stays in the
 * tooltip and in full under /settings/profile.
 * docs/06-ui-information-architecture.md
 */
export function UserChip() {
  const { session } = useSession()

  if (session.status !== 'signed-in') {
    return <SignInButton variant="quiet">Sign in</SignInButton>
  }

  const name = displayName(session.profile, session.npub)
  return (
    <Link
      to="/settings/profile"
      className="flex shrink-0 items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface-2"
      title={`${session.npub} — profile settings`}
    >
      <span className="hidden text-xs text-fg-muted sm:block">{name}</span>
      {session.profile?.picture ? (
        <img
          src={session.profile.picture}
          alt=""
          className="size-6 rounded-full border border-line object-cover"
        />
      ) : (
        <span className="flex size-6 items-center justify-center rounded-full bg-accent-bg text-xs font-medium text-accent-fg">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </Link>
  )
}
