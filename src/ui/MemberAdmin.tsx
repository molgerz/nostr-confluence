import { useState } from 'react'
import { addMember, removeMember } from '../nostr/moderation'
import { classifyRejection } from '../nostr/client'
import { parsePubkeyInput } from '../nostr/profile'
import { Author } from './Author'
import { useSession } from '../session/session'
import type { Admin } from '../domain/group-state'

type Props = {
  relayUrl: string
  groupId: string
  members: string[]
  admins: Admin[]
  loading: boolean
}

/**
 * Member administration. Every action is a request to the relay — it decides
 * whether they go through and then produces the new member list itself. That is
 * why the list here is never "corrected" locally.
 */
export function MemberAdmin({ relayUrl, groupId, members, admins, loading }: Props) {
  const { session, ensureSamePubkey } = useSession()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const isAdmin =
    session.status === 'signed-in' && admins.some((admin) => admin.pubkey === session.pubkey)

  const run = async (label: string, action: () => Promise<{ ok: boolean; reason?: string }>) => {
    if (session.status !== 'signed-in') return
    setMessage(null)
    setBusy(label)
    try {
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setMessage({ ok: false, text: same.reason })
        return
      }
      const result = await action()
      if (result.ok) {
        setMessage({ ok: true, text: 'The relay accepted the change.' })
        setInput('')
        return
      }
      const reason = result.reason ?? 'unbekannt'
      setMessage({
        ok: false,
        text:
          classifyRejection(reason) === 'permission'
            ? `The relay does not let you do that: ${reason}`
            : `Rejected: ${reason}`,
      })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'signing was cancelled' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-fg">Members ({members.length})</h2>

      <ul className="space-y-1 text-xs">
        {members.map((pubkey) => {
          const roles = admins.find((admin) => admin.pubkey === pubkey)?.roles ?? []
          return (
            <li key={pubkey} className="flex flex-wrap items-center gap-2">
              <Author pubkey={pubkey} avatar />
              {roles.length > 0 ? (
                <span className="rounded bg-surface-1 px-1.5 py-0.5 text-fg-subtle">
                  {roles.join(', ')}
                </span>
              ) : null}
              {session.status === 'signed-in' && pubkey === session.pubkey ? (
                <span className="text-fg-subtle">(you)</span>
              ) : null}
              {isAdmin && session.status === 'signed-in' && pubkey !== session.pubkey ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(pubkey, () =>
                      removeMember(session.signer, { relayUrl, groupId, pubkey }),
                    )
                  }
                  className="rounded-md border border-line px-2 py-0.5 text-fg-muted disabled:opacity-60"
                >
                  {busy === pubkey ? '…' : 'remove'}
                </button>
              ) : null}
            </li>
          )
        })}
        {members.length === 0 ? (
          <li className="text-fg-subtle">
            {loading ? 'loading…' : 'The relay reports no member list.'}
          </li>
        ) : null}
      </ul>

      {isAdmin && session.status === 'signed-in' ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface-1 p-3">
          <label htmlFor="member" className="text-xs font-medium text-fg-subtle">
            Add a member (npub or hex)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="member"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="npub1…"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-fg"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                const pubkey = parsePubkeyInput(input)
                if (!pubkey) {
                  setMessage({ ok: false, text: 'That is neither a valid npub nor a hex key.' })
                  return
                }
                void run('add', () => addMember(session.signer, { relayUrl, groupId, pubkey }))
              }}
              className="rounded-md bg-accent-bg px-3 py-1 text-xs font-medium text-accent-fg disabled:opacity-60"
            >
              {busy === 'add' ? 'sending…' : 'add'}
            </button>
          </div>
          <p className="text-xs text-fg-subtle">
            In an open group this is unnecessary: whoever writes is added by the relay
            automatically.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className={`text-xs ${message.ok ? 'text-success' : 'text-danger'}`}>{message.text}</p>
      ) : null}
    </section>
  )
}
