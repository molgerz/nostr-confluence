import { Link, useParams } from 'react-router-dom'
import { PhaseNote } from '../ui/Phase'
import { useSession } from '../session/session'

export function PageView() {
  const { group, slug } = useParams<{ group: string; slug: string }>()
  const { session } = useSession()
  const base = `/s/${encodeURIComponent(group ?? '')}/${slug ?? ''}`
  const signedIn = session.status === 'signed-in'

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">Slug: {slug}</div>
      <h1 className="text-2xl font-medium text-fg">{slug}</h1>
      <div className="flex gap-2">
        {signedIn ? (
          <Link
            to={`${base}/edit`}
            className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
          >
            Bearbeiten
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
            title="Lesen geht ohne Anmeldung, Bearbeiten nicht"
          >
            Anmelden zum Bearbeiten
          </Link>
        )}
        <Link
          to={`${base}/history`}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          Historie
        </Link>
      </div>
      <PhaseNote phase="Phase 3">
        Head der Revisionskette laden, Markdown mit Sanitizing rendern, Byline mit npub.
      </PhaseNote>
    </div>
  )
}
