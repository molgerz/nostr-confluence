import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { classifyRejection } from '../nostr/client'
import { normalizeSlug } from '../nostr/kinds'
import { publishRevision } from '../nostr/publish-page'
import { useSession } from '../session/session'
import { Markdown } from './Markdown'
import { MarkdownEditor } from './MarkdownEditor'
import type { EditorHandle } from './MarkdownEditor'
import { attachmentMarkdown, attachmentsEnabled, uploadAttachment } from '../nostr/blossom'
import { hasConflictMarkers, mergeThreeWay } from '../domain/merge'
import { shortNpub, toNpub } from '../nostr/profile'
import type { Page } from '../domain/pages'
import type { Revision } from '../domain/revision'

type Props = {
  relayUrl: string
  groupId: string
  /** vorhandene Seite = bearbeiten; ohne = neue Seite */
  page?: Page
  /** Elternseite für eine neue Unterseite */
  defaultParentSlug?: string | null
  /** vorhandene Seiten des Spaces, für Slug-Kollisionen */
  pages: Page[]
  /** vorbelegter Inhalt, z. B. das Ergebnis eines Merges */
  initialContent?: string
  /** Hinweis über dem Editor, z. B. "zwei Fassungen zusammengeführt" */
  initialNotice?: string
  /** Vorgänger-Revisionen überschreiben (Merge mehrerer Blätter) */
  overrideParents?: string[]
  onSaved: (slug: string) => void
  onCancel: () => void
}

export function PageEditor({
  relayUrl,
  groupId,
  page,
  defaultParentSlug = null,
  pages,
  initialContent,
  initialNotice,
  overrideParents,
  onSaved,
  onCancel,
}: Props) {
  const { session } = useSession()
  const [title, setTitle] = useState(page?.title ?? '')
  const [content, setContent] = useState(initialContent ?? page?.head.content ?? '')
  // Fassung, auf der dieser Editor geöffnet wurde. Bewegt sich der Kopf der
  // Kette in der Zwischenzeit, wird zusammengeführt statt überschrieben.
  const [baseRevision, setBaseRevision] = useState<Revision | null>(page?.head ?? null)
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null)
  const [summary, setSummary] = useState('')
  const [parentSlug, setParentSlug] = useState(page?.parentSlug ?? defaultParentSlug ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const editorHandle = useRef<EditorHandle | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState<string | null>(null)

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
  const existing = page ?? (slug.length > 0 ? pages.find((entry) => entry.slug === slug) : undefined)
  const collision = !page && existing !== undefined

  /**
   * Anhang hochladen und an der Cursorposition einfügen. Bilder als
   * ![…](url), alles andere als Link — die Datei liegt danach auf dem
   * Blossom-Server, im Nostr-Event steht nur die URL.
   */
  const upload = async (files: File[]) => {
    if (session.status !== 'signed-in' || files.length === 0) return
    setUploadNote(null)
    setUploading(true)
    try {
      for (const file of files) {
        const result = await uploadAttachment(session.signer, file)
        if (!result.ok) {
          setUploadNote(`${file.name}: ${result.reason}`)
          return
        }
        const snippet = attachmentMarkdown(result, file.name)
        if (editorHandle.current) editorHandle.current.insert(`\n${snippet}\n`)
        else setContent((current) => `${current}\n${snippet}\n`)
        setUploadNote(`${file.name} hochgeladen (${Math.round(result.size / 1024)} kB)`)
      }
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

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
    if (hasConflictMarkers(content)) {
      setError('Im Text stehen noch Konfliktmarker. Bitte auflösen und die Marker entfernen.')
      return
    }

    // Optimistische Sperre: hat jemand anderes seit dem Öffnen gespeichert,
    // wird zusammengeführt und erst nach Prüfung durch den Menschen
    // veröffentlicht. docs/05-versioning-history.md
    const live = existing
    if (baseRevision && live && live.head.id !== baseRevision.id && !overrideParents) {
      const theirs = live.head
      const merged = mergeThreeWay(baseRevision.content, content, theirs.content, {
        mine: 'deine Fassung',
        theirs: `Fassung von ${shortNpub(toNpub(theirs.author))}`,
      })
      setBaseRevision(theirs)
      setContent(merged.content)
      setNotice(
        merged.status === 'conflict'
          ? `${shortNpub(toNpub(theirs.author))} hat diese Seite in der Zwischenzeit geändert. ` +
              `${merged.conflicts} Stelle(n) überschneiden sich — bitte im Text auflösen, ` +
              'die Marker entfernen und erneut speichern.'
          : merged.status === 'identical'
            ? `${shortNpub(toNpub(theirs.author))} hat inzwischen gespeichert, mit demselben ` +
                'Ergebnis. Nichts zu tun.'
            : `${shortNpub(toNpub(theirs.author))} hat diese Seite in der Zwischenzeit geändert. ` +
                'Beide Änderungen wurden zusammengeführt — bitte prüfen und erneut speichern.',
      )
      return
    }

    setBusy(true)
    try {
      const result = await publishRevision(session.signer, {
        relayUrl,
        groupId,
        slug,
        title: title.trim(),
        // Bei einer Slug-Kollision die Elternseite der vorhandenen Seite
        // behalten, statt sie stillschweigend auf die oberste Ebene zu heben.
        parentSlug: parentSlug.trim() || existing?.parentSlug || null,
        summary: summary.trim() || null,
        content,
        // Neue Seite: keine Vorgänger. Merge: alle Blätter. Sonst der aktuelle
        // Kopf der Kette.
        parentRevs: overrideParents ?? (existing ? [existing.head.id] : []),
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
      {notice ? (
        <div className="rounded-xl border border-warning bg-warning-bg p-3 text-xs text-fg-muted">
          {notice}
        </div>
      ) : null}

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
            „{existing?.title}" hat schon diesen Slug. Speichern hängt eine weitere Revision an
            diese Seite an, statt eine zweite Seite anzulegen.
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
          <span className="text-xs font-medium text-fg-subtle">Inhalt (Markdown)</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!attachmentsEnabled() || uploading}
              title={
                attachmentsEnabled()
                  ? 'Bild oder Datei anhängen — landet auf dem Blossom-Server, nicht im Event'
                  : 'Kein Blossom-Server konfiguriert (VITE_BLOSSOM_SERVER)'
              }
              onClick={() => fileInput.current?.click()}
              className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted disabled:opacity-60"
            >
              {uploading ? 'lädt hoch…' : 'Anhang'}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted"
            >
              {showPreview ? 'Quelltext' : 'Vorschau'}
            </button>
          </div>
        </div>
        {showPreview ? (
          <div className="min-h-64 rounded-md border border-line bg-surface-2 p-3">
            <Markdown>{content || '_noch leer_'}</Markdown>
          </div>
        ) : (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            ariaLabel="Inhalt in Markdown"
            handleRef={editorHandle}
            onDropFiles={(files) => void upload(files)}
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

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          void upload(files)
        }}
      />
      {uploadNote ? <p className="text-xs text-fg-subtle">{uploadNote}</p> : null}

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
