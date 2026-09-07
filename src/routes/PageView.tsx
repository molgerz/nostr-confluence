import { Link, useNavigate } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { Markdown } from '../ui/Markdown'
import { Byline } from '../ui/Byline'
import { useSession } from '../session/session'
import { shortNpub, toNpub } from '../nostr/profile'

export function PageView() {
  const { group, space, base, slug } = useSpaceRoute()
  const { session } = useSession()
  const navigate = useNavigate()

  if (!group || !base || !slug) {
    return <p className="text-sm text-danger">Ungültige Adresse.</p>
  }

  const page = space.pages.find((entry) => entry.slug === slug)

  if (!page) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-fg-subtle">{space.loading ? 'lade…' : 'nicht gefunden'}</div>
        <h1 className="text-2xl font-medium text-fg">{slug}</h1>
        {space.loading ? null : (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              Für diesen Slug gibt es in diesem Space noch keine Revision.
            </p>
            <Link
              to={`${base}/new?slug=${encodeURIComponent(slug)}`}
              className="inline-block rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
            >
              Seite anlegen
            </Link>
          </div>
        )}
      </div>
    )
  }

  const parent = page.parentSlug
    ? space.pages.find((entry) => entry.slug === page.parentSlug)
    : undefined
  const forked = page.leaves.length > 1

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">
        {parent ? (
          <>
            <Link to={`${base}/${parent.slug}`} className="hover:underline">
              {parent.title}
            </Link>
            {' / '}
          </>
        ) : null}
        {page.title}
      </div>

      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      <Byline revision={page.head} />

      {forked ? (
        <div className="rounded-xl border border-warning bg-warning-bg p-3 text-xs">
          <div className="font-medium text-fg">Diese Seite hat {page.leaves.length} offene Fassungen</div>
          <p className="mt-1 text-fg-muted">
            Mehrere Personen haben gleichzeitig gespeichert. Angezeigt wird die jüngste (
            {shortNpub(toNpub(page.head.author))}), alle Fassungen stehen in der Historie.
          </p>
          {session.status === 'signed-in' ? (
            <Link
              to={`${base}/${page.slug}/edit?merge=1`}
              className="mt-2 inline-block rounded-md border border-warning px-2 py-1 font-medium text-fg-muted"
            >
              Fassungen zusammenführen
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {session.status === 'signed-in' ? (
          <Link
            to={`${base}/${page.slug}/edit`}
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
          to={`${base}/${page.slug}/history`}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          Historie ({page.revisions.length})
        </Link>
        <button
          type="button"
          onClick={() => navigate(`${base}/new?parent=${encodeURIComponent(page.slug)}`)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          Unterseite anlegen
        </button>
      </div>

      <article className="border-t border-line pt-4">
        <Markdown>{page.head.content}</Markdown>
      </article>
    </div>
  )
}
