import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildCommentTree, countComments } from '../domain/comment'
import type { Comment, CommentNode } from '../domain/comment'
import { classifyRejection } from '../nostr/client'
import { publishComment } from '../nostr/publish-comment'
import { deleteGroupEvent } from '../nostr/moderation'
import { forgetEvent } from '../nostr/space-store'
import { useSession } from '../session/session'
import { shortNpub, toNpub } from '../nostr/profile'
import { Markdown } from './Markdown'

type Props = {
  relayUrl: string
  groupId: string
  slug: string
  comments: Comment[]
  /** Admins dürfen fremde Kommentare vom Relay entfernen (Kind 9005) */
  isAdmin?: boolean
}

function timeLabel(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
  return new Date(seconds * 1000).toLocaleDateString('de-DE')
}

/**
 * Kommentare zu einer Seite, wie die Diskussion unter einer Confluence-Seite.
 * Verankert an (Gruppe, Slug), nicht an einer einzelnen Revision — sonst wäre
 * der Faden nach der nächsten Bearbeitung verwaist.
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
      setError('Schreib etwas, bevor du absendest.')
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
          ? `Das Relay erlaubt dir das Kommentieren hier nicht: ${result.reason}`
          : `Nicht gespeichert: ${result.reason}`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signieren abgebrochen')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (comment: Comment) => {
    if (session.status !== 'signed-in') return
    if (!window.confirm('Diesen Kommentar auf dem Relay löschen?')) return
    setError(null)
    setBusy(true)
    try {
      const result = await deleteGroupEvent(session.signer, {
        relayUrl,
        groupId,
        eventId: comment.id,
      })
      if (result.ok) forgetEvent(relayUrl, groupId, comment.id)
      else setError(`Nicht gelöscht: ${result.reason}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signieren abgebrochen')
    } finally {
      setBusy(false)
    }
  }

  const renderNode = (node: CommentNode) => (
    <li key={node.id} style={{ marginLeft: `${node.depth * 16}px` }} className="space-y-1">
      <div className="rounded-xl border border-line bg-surface-1 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
          <span className="font-mono" title={toNpub(node.author)}>
            {shortNpub(toNpub(node.author))}
          </span>
          <span>· {timeLabel(node.createdAt)}</span>
        </div>
        <div className="mt-1">
          <Markdown>{node.content}</Markdown>
        </div>
        {session.status === 'signed-in' ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setReplyTo(node)}
              className="rounded-md border border-line px-2 py-1 text-xs text-fg-muted"
            >
              Antworten
            </button>
            {isAdmin ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(node)}
                className="rounded-md border border-danger px-2 py-1 text-xs text-danger disabled:opacity-60"
              >
                Löschen (Admin)
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {node.replies.length > 0 ? (
        <ul className="space-y-1">{node.replies.map(renderNode)}</ul>
      ) : null}
    </li>
  )

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <h2 className="text-sm font-medium text-fg">
        Kommentare{total > 0 ? ` (${total})` : ''}
      </h2>

      {tree.length === 0 ? (
        <p className="text-xs text-fg-subtle">Noch keine Kommentare.</p>
      ) : (
        <ul className="space-y-2">{tree.map(renderNode)}</ul>
      )}

      {session.status === 'signed-in' ? (
        <div className="space-y-2">
          {replyTo ? (
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              <span>
                Antwort an <span className="font-mono">{shortNpub(toNpub(replyTo.author))}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-md border border-line px-2 py-0.5 text-fg-muted"
              >
                abbrechen
              </button>
            </div>
          ) : null}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            aria-label="Kommentar schreiben"
            placeholder="Kommentar schreiben — Markdown erlaubt"
            className="w-full rounded-md border border-line bg-surface-2 p-2 text-sm text-fg"
          />
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60"
          >
            {busy ? 'sende…' : replyTo ? 'Antwort absenden' : 'Kommentar absenden'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-fg-subtle">
          <Link to="/login" className="text-accent-fg underline">
            Anmelden
          </Link>{' '}
          zum Kommentieren — Lesen geht ohne.
        </p>
      )}
    </section>
  )
}
