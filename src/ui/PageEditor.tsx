import { useState } from 'react'
import { classifyRejection } from '../nostr/client'
import { normalizeSlug } from '../nostr/kinds'
import { publishRevision } from '../nostr/publish-page'
import { publishPlacement } from '../nostr/publish-placement'
import { useSession } from '../session/session'
import { MarkdownEditor } from './MarkdownEditor'
import { hasConflictMarkers, mergeThreeWay } from '../domain/merge'
import { shortNpub, toNpub } from '../nostr/profile'
import { SignInButton } from './SignInButton'
import { Button, Callout } from './controls'
import { HeaderActions } from './layout/PageFrame'
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
  // The parent is fixed for the life of this editor session — filing a page
  // elsewhere is a separate action, not a field in here.
  const [parentSlug] = useState(page?.parentSlug ?? defaultParentSlug ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        summary: null,
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
          32px box labelled "Title". */}
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
        {collision ? (
          <p className="mt-1 text-xs text-warning">
            “{existing?.title}” already uses this slug. Saving appends another revision to that
            page instead of creating a second one.
          </p>
        ) : null}
      </div>

      <MarkdownEditor value={content} onChange={setContent} ariaLabel="Content in Markdown" />

      {/* The relay's own words, never a paraphrase: with distributed storage
          "saved" must not be claimed before an OK came back, and when it did
          not, the reason is the only thing that helps.
          docs/06-ui-information-architecture.md */}
      {error ? <Callout tone="danger" title="Not saved">{error}</Callout> : null}

      {/* Rendered into the breadcrumb bar above, not down here — see
          docs/10-roadmap.md, Phase 6. */}
      <HeaderActions>
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          {busy ? 'publishing…' : 'Publish'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </HeaderActions>
    </div>
  )
}
