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
  /** an existing page = editing; without it = a new page */
  page?: Page
  /** parent page for a new subpage */
  defaultParentSlug?: string | null
  /** existing pages of the space, for slug collisions */
  pages: Page[]
  /** pre-filled content, e.g. the result of a merge */
  initialContent?: string
  /** note above the editor, e.g. "merged two versions" */
  initialNotice?: string
  /** override the predecessor revisions (merging several leaves) */
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
  // The version this editor was opened on. If the head of the chain moves in
  // the meantime, we merge instead of overwriting.
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
          Editing requires signing in, reading does not. The revision is signed with your key,
          so it cannot be done anonymously.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
        >
          Sign in with Nostr
        </Link>
      </div>
    )
  }

  const slug = page?.slug ?? normalizeSlug(title)
  const existing = page ?? (slug.length > 0 ? pages.find((entry) => entry.slug === slug) : undefined)
  const collision = !page && existing !== undefined

  /**
   * Upload an attachment and insert it at the cursor. Images as ![…](url),
   * everything else as a link — the file then lives on the Blossom server and
   * the Nostr event only carries the URL.
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
        setUploadNote(`${file.name} uploaded (${Math.round(result.size / 1024)} kB)`)
      }
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : 'upload failed')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    setError(null)
    if (title.trim().length === 0) {
      setError('Give the page a title.')
      return
    }
    if (slug.length === 0) {
      setError('No slug can be derived from this title — please use letters or digits.')
      return
    }
    if (hasConflictMarkers(content)) {
      setError('There are still conflict markers in the text. Please resolve them and remove the markers.')
      return
    }

    // Optimistic lock: if somebody else saved since this editor was opened, we
    // merge and only publish after a human has reviewed the result.
    // docs/05-versioning-history.md
    const live = existing
    if (baseRevision && live && live.head.id !== baseRevision.id && !overrideParents) {
      const theirs = live.head
      const merged = mergeThreeWay(baseRevision.content, content, theirs.content, {
        mine: 'your version',
        theirs: `version by ${shortNpub(toNpub(theirs.author))}`,
      })
      setBaseRevision(theirs)
      setContent(merged.content)
      setNotice(
        merged.status === 'conflict'
          ? `${shortNpub(toNpub(theirs.author))} changed this page in the meantime. ` +
              `${merged.conflicts} spot(s) overlap — please resolve them in the text, ` +
              'remove the markers and save again.'
          : merged.status === 'identical'
            ? `${shortNpub(toNpub(theirs.author))} saved in the meantime, with the same ` +
                'result. Nothing to do.'
            : `${shortNpub(toNpub(theirs.author))} changed this page in the meantime. ` +
                'Both changes were merged — please review and save again.',
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
        // On a slug collision keep the existing page's parent instead of
        // silently lifting it to the top level.
        parentSlug: parentSlug.trim() || existing?.parentSlug || null,
        summary: summary.trim() || null,
        content,
        // New page: no predecessors. Merge: all leaves. Otherwise the current
        // head of the chain.
        parentRevs: overrideParents ?? (existing ? [existing.head.id] : []),
      })
      if (result.ok) {
        onSaved(slug)
        return
      }
      const kind = classifyRejection(result.reason)
      setError(
        kind === 'auth'
          ? `The relay requires authentication (NIP-42): ${result.reason}`
          : kind === 'permission'
            ? `The relay does not allow you to write in this space: ${result.reason}`
            : `Not saved: ${result.reason}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signing was cancelled')
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
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Page title"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg"
        />
        <p className="font-mono text-xs text-fg-subtle">
          Slug: {slug || '—'}
          {page ? ' (immutable)' : ''}
        </p>
        {collision ? (
          <p className="text-xs text-warning">
            “{existing?.title}” already uses this slug. Saving appends another revision to that
            page instead of creating a second one.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="parent" className="text-xs font-medium text-fg-subtle">
          Parent page (slug, optional)
        </label>
        <input
          id="parent"
          value={parentSlug}
          onChange={(event) => setParentSlug(event.target.value)}
          placeholder="e.g. handbook"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-fg-subtle">Content (Markdown)</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!attachmentsEnabled() || uploading}
              title={
                attachmentsEnabled()
                  ? 'Attach an image or file — it goes to the Blossom server, not into the event'
                  : 'No Blossom server configured (VITE_BLOSSOM_SERVER)'
              }
              onClick={() => fileInput.current?.click()}
              className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted disabled:opacity-60"
            >
              {uploading ? 'uploading…' : 'Attach'}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview((value) => !value)}
              className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted"
            >
              {showPreview ? 'Source' : 'Preview'}
            </button>
          </div>
        </div>
        {showPreview ? (
          <div className="min-h-64 rounded-md border border-line bg-surface-2 p-3">
            <Markdown>{content || '_still empty_'}</Markdown>
          </div>
        ) : (
          <MarkdownEditor
            value={content}
            onChange={setContent}
            ariaLabel="Content in Markdown"
            handleRef={editorHandle}
            onDropFiles={(files) => void upload(files)}
          />
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="summary" className="text-xs font-medium text-fg-subtle">
          What did you change? (shown in the history)
        </label>
        <input
          id="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={page ? 'e.g. added a deployment section' : 'created the page'}
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
          {busy ? 'saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-line px-4 py-2 text-sm text-fg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
