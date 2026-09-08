import { useRef, useState } from 'react'
import { classifyRejection } from '../nostr/client'
import { normalizeSlug } from '../nostr/kinds'
import { publishRevision } from '../nostr/publish-page'
import { publishPlacement } from '../nostr/publish-placement'
import { useSession } from '../session/session'
import { Markdown } from './Markdown'
import { MarkdownEditor } from './MarkdownEditor'
import type { EditorHandle } from './MarkdownEditor'
import { attachmentMarkdown, attachmentsEnabled, uploadAttachment } from '../nostr/blossom'
import { hasConflictMarkers, mergeThreeWay } from '../domain/merge'
import { shortNpub, toNpub } from '../nostr/profile'
import { SignInButton } from './SignInButton'
import { Button, Callout, INPUT, Segmented } from './controls'
import { PencilIcon, BookIcon, PlusIcon } from './icons'
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
      <div className="space-y-4 rounded-lg border border-dashed border-line-strong p-6">
        <p className="max-w-[56ch] text-sm text-fg-muted">
          Editing requires signing in, reading does not. The revision is signed with your key,
          so it cannot be done anonymously.
        </p>
        <SignInButton>Sign in with Nostr</SignInButton>
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
        // Carry the sidebar position over. Without this every save would drop
        // the page back into alphabetical order. src/domain/order.ts
        order: existing?.order ?? null,
        summary: summary.trim() || null,
        content,
        // New page: no predecessors. Merge: all leaves. Otherwise the current
        // head of the chain.
        parentRevs: overrideParents ?? (existing ? [existing.head.id] : []),
      })
      if (result.ok) {
        // Where a page hangs lives in its placement event once it has one, so
        // the tag alone would not move it. An existing page therefore gets a
        // placement when this field changed. src/domain/placement.ts
        const desiredParent = parentSlug.trim() || null
        if (page && desiredParent !== page.parentSlug) {
          const placed = await publishPlacement(session.signer, {
            relayUrl,
            groupId,
            slug,
            parentSlug: desiredParent,
            order: page.order,
          })
          if (!placed.ok) {
            setError(
              `Saved, but the page was not moved: ${placed.reason}. It is still ` +
                `filed under ${page.parentSlug ?? 'the top level'}.`,
            )
            return
          }
        }
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
    <div className="space-y-5">
      {notice ? <Callout tone="warning">{notice}</Callout> : null}

      {/* The title is the page's own heading, so it is edited at the size it
          will be read at — a borderless field the width of the column, not a
          32px box labelled "Title". The slug it derives sits under it in the
          same place the byline will. */}
      <div>
        <label htmlFor="title" className="sr-only">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled page"
          className="w-full bg-transparent text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg placeholder:text-fg-subtle/60 focus:outline-none"
        />
        <p className="mt-2 font-mono text-xs text-fg-subtle">
          /{slug || '…'}
          {page ? ' · fixed for the life of the page' : ''}
        </p>
        {collision ? (
          <p className="mt-1 text-xs text-warning">
            “{existing?.title}” already uses this slug. Saving appends another revision to that
            page instead of creating a second one.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-line py-2.5">
        <label htmlFor="parent" className="text-xs font-medium text-fg-subtle">
          Filed under
        </label>
        <input
          id="parent"
          value={parentSlug}
          onChange={(event) => setParentSlug(event.target.value)}
          placeholder="the top level"
          list="nc-parent-slugs"
          className={`${INPUT} w-56 font-mono text-xs`}
        />
        {/* The slugs of the space, so the field can be picked from rather than
            typed from memory — a wrong slug here files the page nowhere. */}
        <datalist id="nc-parent-slugs">
          {pages
            .filter((entry) => entry.slug !== page?.slug)
            .map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.title}
              </option>
            ))}
        </datalist>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            disabled={!attachmentsEnabled() || uploading}
            title={
              attachmentsEnabled()
                ? 'Attach an image or file — it goes to the Blossom server, not into the event'
                : 'No Blossom server configured (VITE_BLOSSOM_SERVER)'
            }
            onClick={() => fileInput.current?.click()}
          >
            <PlusIcon className="size-3.5" />
            {uploading ? 'uploading…' : 'Attach'}
          </Button>
          <Segmented
            label="Source or preview"
            value={showPreview ? 'preview' : 'source'}
            options={[
              { value: 'source', label: 'Write', icon: <PencilIcon className="size-3.5" /> },
              { value: 'preview', label: 'Preview', icon: <BookIcon className="size-3.5" /> },
            ]}
            onChange={(next) => setShowPreview(next === 'preview')}
          />
        </div>
      </div>

      {showPreview ? (
        <div className="min-h-64 rounded-lg border border-line p-4">
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

      <div className="space-y-1.5">
        <label htmlFor="summary" className="block text-xs font-medium text-fg-muted">
          What did you change?
        </label>
        <input
          id="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={page ? 'e.g. added a deployment section' : 'created the page'}
          className={INPUT}
        />
        <p className="text-xs text-fg-subtle">Shown in the history next to this revision.</p>
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

      {/* The relay's own words, never a paraphrase: with distributed storage
          "saved" must not be claimed before an OK came back, and when it did
          not, the reason is the only thing that helps.
          docs/06-ui-information-architecture.md */}
      {error ? <Callout tone="danger" title="Not saved">{error}</Callout> : null}

      {/* Pinned to the bottom of the viewport: on a long page the save button
          was two screens below the paragraph being written. */}
      <div className="sticky bottom-0 -mx-1 flex gap-2 border-t border-line bg-surface-2/90 px-1 py-3 backdrop-blur-sm">
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'saving…' : 'Save'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
