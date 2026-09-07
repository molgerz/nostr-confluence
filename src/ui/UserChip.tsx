import { Link } from 'react-router-dom'
import { useSession } from '../session/session'
import { displayName, shortNpub } from '../nostr/profile'

/**
 * Anzeigename plus npub — nie nur der Name. Anzeigenamen sind frei wählbar
 * und nicht eindeutig, der npub ist die Identität.
 */
export function UserChip() {
  const { session, logout } = useSession()

  if (session.status !== 'signed-in') {
    return (
      <Link
        to="/login"
        className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
      >
        {session.status === 'signing-in' ? 'melde an…' : 'Anmelden'}
      </Link>
    )
  }

  const name = displayName(session.profile, session.npub)
  return (
    <div className="flex items-center gap-2">
      <Link to="/login" className="flex items-center gap-2" title={session.npub}>
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
        <span className="hidden text-xs text-fg-muted sm:block">{name}</span>
        <span className="hidden font-mono text-xs text-fg-subtle md:block">
          {shortNpub(session.npub)}
        </span>
      </Link>
      <button
        type="button"
        onClick={logout}
        className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted hover:border-line-strong"
      >
        Abmelden
      </button>
    </div>
  )
}
