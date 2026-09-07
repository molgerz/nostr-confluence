import { Link, useNavigate } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { Markdown } from '../ui/Markdown'
import { Byline } from '../ui/Byline'
import { useSession } from '../session/session'
import { shortNpub, toNpub } from '../nostr/profile'
import { SignInButton } from '../ui/SignInButton'
import { Comments } from '../ui/Comments'
import { useTocSource } from '../ui/layout/toc-context'

export function PageView() {
  const { group, space, base, slug } = useSpaceRoute()
  const { session } = useSession()
  const navigate = useNavigate()

  // Hooks have to run before any early return, otherwise their order changes
  // between renders.
  const page = slug ? space.pages.find((entry) => entry.slug === slug) : undefined
  useTocSource(page?.head.content ?? '')

  if (!group || !base || !slug) {
    return <p className="text-sm text-danger">Invalid address.</p>
  }

  if (!page) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-fg-subtle">{space.loading ? 'loading…' : 'not found'}</div>
        <h1 className="text-3xl font-semibold tracking-tight text-fg">{slug}</h1>
        {space.loading ? null : (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              There is no revision for this slug in this space yet.
            </p>
            <Link
              to={`${base}/new?slug=${encodeURIComponent(slug)}`}
              className="inline-block rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
            >
              Create this page
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

      <h1 className="text-3xl font-semibold tracking-tight text-fg">{page.title}</h1>
      <Byline revision={page.head} />

      {forked ? (
        <div className="rounded-xl border border-warning bg-warning-bg p-3 text-xs">
          <div className="font-medium text-fg">
            This page has {page.leaves.length} open versions
          </div>
          <p className="mt-1 text-fg-muted">
            Several people saved at the same time. The newest one is shown (
            {shortNpub(toNpub(page.head.author))}); all versions are in the history.
          </p>
          {session.status === 'signed-in' ? (
            <Link
              to={`${base}/${page.slug}/edit?merge=1`}
              className="mt-2 inline-block rounded-md border border-warning px-2 py-1 font-medium text-fg-muted"
            >
              Merge versions
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
            Edit
          </Link>
        ) : (
          <SignInButton
            variant="quiet"
            title="Reading works without signing in, editing does not"
          >
            Sign in to edit
          </SignInButton>
        )}
        <Link
          to={`${base}/${page.slug}/history`}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          History ({page.revisions.length})
        </Link>
        <Link
          to={`${base}/${page.slug}/blame`}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          Line origin
        </Link>
        <button
          type="button"
          onClick={() => navigate(`${base}/new?parent=${encodeURIComponent(page.slug)}`)}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          New subpage
        </button>
      </div>

      <article className="border-t border-line pt-4">
        <Markdown>{page.head.content}</Markdown>
      </article>

      <Comments
        relayUrl={group.relayUrl}
        groupId={group.id}
        slug={page.slug}
        comments={space.comments}
        isAdmin={
          session.status === 'signed-in' &&
          space.admins.some((admin) => admin.pubkey === session.pubkey)
        }
      />
    </div>
  )
}
