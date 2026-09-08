import { useState } from 'react'
import { buildCommentTree, countComments } from '../domain/comment'
import type { Comment, CommentNode } from '../domain/comment'
import { classifyRejection } from '../nostr/client'
import { publishComment } from '../nostr/publish-comment'
import { deleteGroupEvent } from '../nostr/moderation'
import { forgetEvent } from '../nostr/space-store'
import { useSession } from '../session/session'
import { SignInButton } from './SignInButton'
import { Author } from './Author'
import { Markdown } from './Markdown'
import { Button, SectionLabel, TEXTAREA } from './controls'
import { CommentIcon } from './icons'

type Props = {
  relayUrl: string
  groupId: string
  slug: string
  comments: Comment[]
  /** admins may remove other people's comments from the relay (kind 9005) */
  isAdmin?: boolean
}

function timeLabel(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return new Date(seconds * 1000).toLocaleDateString()
}

/**
 * Comments on a page, like the discussion below a Confluence page. Anchored to
 * (group, slug), not to a single revision — otherwise the thread would be
 * orphaned after the next edit.
 *
 * Each comment is a bordered card, and a reply is a card indented behind a
 * rule that runs down the thread it belongs to. The rule is what makes a
 * three-deep thread readable: at 16px of indent alone the second and third
 * level are told apart by counting pixels.
 *
 * Reply and delete only appear on the card the pointer is over. A column of
 * cards each carrying two buttons is a form; the same column with the buttons
 * held back is a conversation.
 */
export function Comments({ relayUrl, groupId, slug, comments, isAdmin = false }: Props) {
  const { session, ensureSamePubkey } = useSession()
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tree = buildCommentTree(comments.filter((comment) => comment.slug === slug))
  const total = countComments(tree)

  const send = async () => {
    if (session.status !== 'signed-in') return
    if (text.trim().length === 0) {
      setError('Write something before sending.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setError(same.reason)
        return
      }
      const result = await publishComment(session.signer, {
        relayUrl,
        groupId,
        slug,
        content: text,
        parentId: replyTo?.id ?? null,
        parentAuthor: replyTo?.author ?? null,
      })
      if (result.ok) {
        setText('')
        setReplyTo(null)
        return
      }
      const kind = classifyRejection(result.reason)
      setError(
        kind === 'permission'
          ? `The relay does not allow you to comment here: ${result.reason}`
          : `Not saved: ${result.reason}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signing was cancelled')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (comment: Comment) => {
    if (session.status !== 'signed-in') return
    if (!window.confirm('Delete this comment on the relay?')) return
    setError(null)
    setBusy(true)
    try {
      const result = await deleteGroupEvent(session.signer, {
        relayUrl,
        groupId,
        eventId: comment.id,
      })
      if (result.ok) forgetEvent(relayUrl, groupId, comment.id)
      else setError(`Not deleted: ${result.reason}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signing was cancelled')
    } finally {
      setBusy(false)
    }
  }

  const renderNode = (node: CommentNode) => (
    <li key={node.id}>
      <div className="group/comment rounded-lg border border-line bg-surface-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Author pubkey={node.author} avatar showNpub={false} />
          <span className="text-fg-subtle">{timeLabel(node.createdAt)}</span>

          {session.status === 'signed-in' ? (
            <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
              <Button size="sm" variant="subtle" onClick={() => setReplyTo(node)}>
                Reply
              </Button>
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="subtle"
                  className="text-danger hover:bg-danger-bg"
                  disabled={busy}
                  onClick={() => void remove(node)}
                >
                  Delete
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5">
          <Markdown density="compact">{node.content}</Markdown>
        </div>
      </div>

      {node.replies.length > 0 ? (
        // The rule sits in the margin the replies are indented by, so it runs
        // the exact height of the thread hanging off this comment.
        <ul className="mt-2 space-y-2 border-l-2 border-line pl-4">
          {node.replies.map(renderNode)}
        </ul>
      ) : null}
    </li>
  )

  return (
    <section className="mt-12 border-t border-line pt-6">
      <div className="flex items-center gap-2">
        <CommentIcon className="size-4 text-fg-subtle" />
        <SectionLabel>Comments{total > 0 ? ` · ${total}` : ''}</SectionLabel>
      </div>

      {tree.length === 0 ? (
        <p className="mt-3 text-sm text-fg-subtle">No comments yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">{tree.map(renderNode)}</ul>
      )}

      {session.status === 'signed-in' ? (
        <div className="mt-5 space-y-2">
          {replyTo ? (
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                Replying to <Author pubkey={replyTo.author} showNpub={false} />
              </span>
              <Button size="sm" variant="subtle" onClick={() => setReplyTo(null)}>
                cancel
              </Button>
            </div>
          ) : null}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            aria-label="Write a comment"
            placeholder="Write a comment — Markdown allowed"
            className={TEXTAREA}
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <Button variant="primary" onClick={() => void send()} disabled={busy}>
            {busy ? 'sending…' : replyTo ? 'Send reply' : 'Send comment'}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-fg-subtle">
          <SignInButton variant="inline">Sign in</SignInButton> to comment — reading works
          without.
        </p>
      )}
    </section>
  )
}
