import { Link } from 'react-router-dom'
import { useSession } from '../session/session'
import { SignInButton } from './SignInButton'
import { displayName } from '../nostr/profile'

/**
 * One's own account in the top bar: the picture alone, at the very edge. The
 * whole chip is one link to the profile settings — signing out lives down there
 * too, so that the outermost corner of the layout is not a destructive action
 * sitting next to a navigation target.
 *
 * Neither name nor npub is spelled out here. This is the one identity nobody
 * has to be told apart from an impostor — it is the reader's own — and the top
 * bar is the narrowest strip in the layout. Both appear in the tooltip, and in
 * full under /settings/profile. Without a picture the initial stands in, so the
 * chip keeps its size and place.
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
      className="flex shrink-0 items-center rounded-md p-0.5 hover:bg-surface-2"
      title={`${name} · ${session.npub} — profile settings`}
      aria-label={`${name} — profile settings`}
    >
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
