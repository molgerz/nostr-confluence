import { useState } from 'react'
import { Link } from 'react-router-dom'
import { classifyRejection } from '../nostr/client'
import { normalizeSlug } from '../nostr/kinds'
import { publishRevision } from '../nostr/publish-page'
import { useSession } from '../session/session'
import { Markdown } from './Markdown'
import type { Page } from '../domain/pages'

type Props = {
  relayUrl: string
  groupId: string
  /** vorhandene Seite = bearbeiten; ohne = neue Seite */
  page?: Page
  /** Elternseite für eine neue Unterseite */
  defaultParentSlug?: string | null
  existingSlugs: string[]
  onSaved: (slug: string) => void
  onCancel: () => void
}

export function PageEditor({
  relayUrl,
  groupId,
  page,
  defaultParentSlug = null,
  existingSlugs,
  onSaved,
  onCancel,
}: Props) {
  const { session } = useSession()
  const [title, setTitle] = useState(page?.title ?? '')
  const [content, setContent] = useState(page?.head.content ?? '')
  const [summary, setSummary] = useState('')
  const [parentSlug, setParentSlug] = useState(page?.parentSlug ?? defaultParentSlug ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  if (session.status !== 'signed-in') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-fg-muted">
          Bearbeiten braucht eine Anmeldung — Lesen nicht. Die Revision wird mit deinem Schlüssel
          signiert, deshalb geht es nicht anonym.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
        >
          Mit Nostr anmelden
        </Link>
      </div>
    )
  }

  const slug = page?.slug ?? normalizeSlug(title)
  const collision = !page && slug.length > 0 && existingSlugs.includes(slug)

  const save = async () => {
    setError(null)
    if (title.trim().length === 0) {
      setError('Gib der Seite einen Titel.')
      return
    }
    if (slug.length === 0) {
      setError('Aus diesem Titel lässt sich kein Slug bilden — bitte Buchstaben oder Zahlen verwenden.')
      return
    }
    setBusy(true)
    try {
      const result = await publishRevision(session.signer, {
        relayUrl,
        groupId,
        slug,
        title: title.trim(),
        parentSlug: parentSlug.trim() || null,
        summary: summary.trim() || null,
        content,
        // Neue Seite: keine Vorgänger. Bearbeiten: der aktuelle Kopf der Kette.
        parentRevs: page ? [page.head.id] : [],
      })
      if (result.ok) {
        onSaved(slug)
        return
      }
      const kind = classifyRejection(result.reason)
      setError(
        kind === 'auth'
          ? `Das Relay verlangt eine Anmeldung am Relay (NIP-42): ${result.reason}`
          : kind === 'permission'
            ? `Das Relay erlaubt dir das Schreiben in diesem Space nicht: ${result.reason}`
            : `Nicht gespeichert: ${result.reason}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signieren abgebrochen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="title" className="text-xs font-medium text-fg-subtle">
          Titel
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Seitentitel"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg"
        />
        <p className="font-mono text-xs text-fg-subtle">
          Slug: {slug || '—'}
          {page ? ' (unveränderlich)' : ''}
        </p>
        {collision ? (
          <p className="text-xs text-warning">
            Eine Seite mit diesem Slug existiert schon. Speichern erzeugt eine weitere Revision
            dieser Seite, keine zweite Seite.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="parent" className="text-xs font-medium text-fg-subtle">
          Elternseite (Slug, optional)
        </label>
        <input
          id="parent"
          value={parentSlug}
          onChange={(event) => setParentSlug(event.target.value)}
          placeholder="z. B. handbuch"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="content" className="text-xs font-medium text-fg-subtle">
            Inhalt (Markdown)
          </label>
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted"
          >
            {showPreview ? 'Quelltext' : 'Vorschau'}
          </button>
        </div>
        {showPreview ? (
          <div className="min-h-64 rounded-md border border-line bg-surface-2 p-3">
            <Markdown>{content || '_noch leer_'}</Markdown>
          </div>
        ) : (
          <textarea
            id="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={16}
            placeholder={'# Überschrift\n\nText …'}
            className="w-full rounded-md border border-line bg-surface-2 p-3 font-mono text-xs text-fg"
          />
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="summary" className="text-xs font-medium text-fg-subtle">
          Was hast du geändert? (steht in der Historie)
        </label>
        <input
          id="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={page ? 'z. B. Abschnitt Deployment ergänzt' : 'Seite erstellt'}
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-md bg-accent-bg px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? 'speichere…' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-line px-4 py-2 text-sm text-fg-muted"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
