import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { shortNpub, toNpub } from '../nostr/profile'
import { DiffView } from '../ui/DiffView'
import { Author } from '../ui/Author'
import { useSession } from '../session/session'
import { publishRevision } from '../nostr/publish-page'
import { classifyRejection } from '../nostr/client'
import { deleteGroupEvent } from '../nostr/moderation'
import { forgetEvent } from '../nostr/space-store'
import type { Revision } from '../domain/revision'

export function HistoryView() {
  const { group, space, base, slug } = useSpaceRoute()
  const { session, ensureSamePubkey } = useSession()
  const navigate = useNavigate()
  const [selection, setSelection] = useState<{ from: string; to: string } | null>(null)
  const [details, setDetails] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!group || !base || !slug) return <p className="text-sm text-danger">Ungültige Adresse.</p>

  const page = space.pages.find((entry) => entry.slug === slug)
  if (!page) {
    return (
      <p className="text-sm text-fg-muted">
        {space.loading ? 'lade…' : 'Keine Revisionen für diesen Slug.'}
      </p>
    )
  }

  const isAdmin =
    session.status === 'signed-in' &&
    space.admins.some((admin) => admin.pubkey === session.pubkey)
  const revisions = page.revisions

  const removeRevision = async (revision: Revision) => {
    if (session.status !== 'signed-in') return
    // Das Relay setzt diese Löschung wirklich durch — deshalb nachfragen.
    const ok = window.confirm(
      `Revision vom ${new Date(revision.createdAt * 1000).toLocaleString('de-DE')} auf dem Relay löschen? Das lässt sich nicht rückgängig machen.`,
    )
    if (!ok) return
    setError(null)
    setBusy(true)
    try {
      const result = await deleteGroupEvent(session.signer, {
        relayUrl: group.relayUrl,
        groupId: group.id,
        eventId: revision.id,
      })
      if (result.ok) {
        forgetEvent(group.relayUrl, group.id, revision.id)
        return
      }
      setError(`Nicht gelöscht: ${result.reason}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signieren abgebrochen')
    } finally {
      setBusy(false)
    }
  }
  const from = selection ? revisions.find((r) => r.id === selection.from) : revisions[1]
  const to = selection ? revisions.find((r) => r.id === selection.to) : revisions[0]

  const restore = async (revision: Revision) => {
    if (session.status !== 'signed-in') return
    setError(null)
    setBusy(true)
    try {
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setError(same.reason)
        return
      }
      const result = await publishRevision(session.signer, {
        relayUrl: group.relayUrl,
        groupId: group.id,
        slug: page.slug,
        title: revision.title,
        parentSlug: revision.parentSlug,
        summary: `Fassung von ${new Date(revision.createdAt * 1000).toLocaleString('de-DE')} wiederhergestellt`,
        content: revision.content,
        // Wiederherstellen hängt an den aktuellen Kopf an — die Historie
        // bleibt vollständig, nichts wird gelöscht.
        parentRevs: [page.head.id],
        restoreOf: revision.id,
      })
      if (result.ok) {
        navigate(`${base}/${page.slug}`)
        return
      }
      const kind = classifyRejection(result.reason)
      setError(
        kind === 'permission'
          ? `Das Relay erlaubt dir das Schreiben hier nicht: ${result.reason}`
          : `Nicht gespeichert: ${result.reason}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signieren abgebrochen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs text-fg-subtle">Historie</div>
        <h1 className="mt-1 text-2xl font-medium text-fg">{page.title}</h1>
        <div className="mt-1 flex gap-3 text-xs">
          <Link to={`${base}/${page.slug}`} className="text-accent-fg underline">
            zurück zur Seite
          </Link>
          <Link to={`${base}/${page.slug}/blame`} className="text-accent-fg underline">
            Zeilenherkunft
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {revisions.length > 1 ? (
        <section className="space-y-2 rounded-xl border border-line bg-surface-1 p-3">
          <h2 className="text-sm font-medium text-fg">Vergleichen</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-1">
              von
              <select
                value={from?.id ?? ''}
                onChange={(event) =>
                  setSelection({ from: event.target.value, to: to?.id ?? revisions[0].id })
                }
                className="rounded-md border border-line bg-surface-2 px-2 py-1"
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {new Date(revision.createdAt * 1000).toLocaleString('de-DE')} ·{' '}
                    {shortNpub(toNpub(revision.author))}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              bis
              <select
                value={to?.id ?? ''}
                onChange={(event) =>
                  setSelection({ from: from?.id ?? revisions[1].id, to: event.target.value })
                }
                className="rounded-md border border-line bg-surface-2 px-2 py-1"
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {new Date(revision.createdAt * 1000).toLocaleString('de-DE')} ·{' '}
                    {shortNpub(toNpub(revision.author))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {from && to ? <DiffView before={from.content} after={to.content} /> : null}
        </section>
      ) : null}

      <ol className="space-y-2">
        {revisions.map((revision) => {
          const isHead = revision.id === page.head.id
          const npub = toNpub(revision.author)
          const open = details === revision.id
          return (
            <li key={revision.id} className="rounded-xl border border-line bg-surface-1 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Author pubkey={revision.author} />
                <span className="text-fg-subtle">
                  {new Date(revision.createdAt * 1000).toLocaleString('de-DE')}
                </span>
                {isHead ? (
                  <span className="rounded bg-accent-bg px-1.5 py-0.5 font-medium text-accent-fg">
                    aktuell
                  </span>
                ) : null}
                {revision.parentRevs.length > 1 ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-fg-subtle">
                    Zusammenführung
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-fg-muted">{revision.summary ?? '(keine Notiz)'}</div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDetails(open ? null : revision.id)}
                  className="rounded-md border border-line px-2 py-1 text-fg-muted"
                >
                  {open ? 'Details zu' : 'Details'}
                </button>
                {!isHead && session.status === 'signed-in' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void restore(revision)}
                    className="rounded-md border border-line px-2 py-1 text-fg-muted disabled:opacity-60"
                  >
                    Wiederherstellen
                  </button>
                ) : null}
                {!isHead ? (
                  <button
                    type="button"
                    onClick={() => setSelection({ from: revision.id, to: page.head.id })}
                    className="rounded-md border border-line px-2 py-1 text-fg-muted"
                  >
                    Mit aktueller vergleichen
                  </button>
                ) : null}
                {isAdmin ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeRevision(revision)}
                    className="rounded-md border border-danger px-2 py-1 text-danger disabled:opacity-60"
                  >
                    Löschen (Admin)
                  </button>
                ) : null}
              </div>

              {open ? (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono break-all text-fg-subtle">
                  <dt>Event-ID</dt>
                  <dd>{revision.id}</dd>
                  <dt>Autor</dt>
                  <dd>{npub}</dd>
                  <dt>Vorgänger</dt>
                  <dd>{revision.parentRevs.join(', ') || 'keine (erste Revision)'}</dd>
                  <dt>Signatur</dt>
                  <dd>beim Empfang geprüft</dd>
                </dl>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
