import { Link } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { shortNpub, toNpub } from '../nostr/profile'
import { PhaseNote } from '../ui/Phase'

export function HistoryView() {
  const { group, space, base, slug } = useSpaceRoute()

  if (!group || !base || !slug) return <p className="text-sm text-danger">Ungültige Adresse.</p>

  const page = space.pages.find((entry) => entry.slug === slug)
  if (!page) {
    return (
      <p className="text-sm text-fg-muted">
        {space.loading ? 'lade…' : 'Keine Revisionen für diesen Slug.'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">Historie</div>
      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      <Link to={`${base}/${page.slug}`} className="text-xs text-accent-fg underline">
        zurück zur Seite
      </Link>

      <ol className="space-y-2 border-t border-line pt-4">
        {page.revisions.map((revision) => {
          const isHead = revision.id === page.head.id
          const npub = toNpub(revision.author)
          return (
            <li
              key={revision.id}
              className="rounded-xl border border-line bg-surface-1 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-fg-muted" title={npub}>
                  {shortNpub(npub)}
                </span>
                <span className="text-fg-subtle">
                  {new Date(revision.createdAt * 1000).toLocaleString('de-DE')}
                </span>
                {isHead ? (
                  <span className="rounded bg-accent-bg px-1.5 py-0.5 font-medium text-accent-fg">
                    aktuell
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-fg-muted">{revision.summary ?? '(keine Notiz)'}</div>
              <div className="mt-1 font-mono text-fg-subtle">
                id {revision.id.slice(0, 12)}
                {revision.parentRevs.length > 0
                  ? ` · parent ${revision.parentRevs.map((id) => id.slice(0, 8)).join(', ')}`
                  : ' · erste Revision'}
              </div>
            </li>
          )
        })}
      </ol>

      <PhaseNote phase="Phase 5">
        Diff zwischen beliebigen Revisionen, Blame pro Zeile, Wiederherstellen als neue Revision,
        Signatur-Detailansicht.
      </PhaseNote>
    </div>
  )
}
