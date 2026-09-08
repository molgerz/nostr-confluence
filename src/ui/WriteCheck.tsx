import { useState } from 'react'
import { classifyRejection, client } from '../nostr/client'
import { KINDS, TAGS } from '../nostr/kinds'
import { useSession } from '../session/session'
import { Button } from './controls'

type Result = { ok: boolean; text: string }

/**
 * Checks real write access: signs an ephemeral event (kind 20817, which relays
 * do not store) and publishes it. That exercises the whole chain of signer →
 * NIP-42 AUTH → relay answer without leaving traces.
 *
 * Satisfies the acceptance criterion from docs/10-roadmap.md: a publish must
 * not fail silently after a reconnect — the relay's answer is shown verbatim.
 */
export function WriteCheck({ relayUrl, groupId }: { relayUrl: string; groupId: string }) {
  const { session, ensureSamePubkey } = useSession()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  if (session.status !== 'signed-in') {
    return (
      <p className="text-sm text-fg-muted">
        Sign in to check write access — reading works without signing in.
      </p>
    )
  }

  const run = async () => {
    setBusy(true)
    setResult(null)
    try {
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setResult({ ok: false, text: same.reason })
        return
      }
      const signed = await session.signer.signEvent({
        kind: KINDS.DIAGNOSTIC_PING,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          [TAGS.GROUP, groupId],
          [TAGS.ALT, 'write test from nostr confluence'],
        ],
        content: '',
      })
      const { published, echoed } = await client.writeProbe(relayUrl, signed)

      if (published.ok) {
        setResult({
          ok: true,
          text: echoed
            ? `Writing allowed. Relay: ${published.message}. The event came back through the subscription.`
            : `Writing allowed. Relay: ${published.message}. No echo — the subscription did not receive it.`,
        })
        return
      }

      const kind = classifyRejection(published.reason)
      const explanation =
        kind === 'auth'
          ? 'The relay requires NIP-42 AUTH and authenticating did not go through.'
          : kind === 'permission'
            ? 'The relay forbids this identity from writing in this group.'
            : kind === 'not-stored'
              ? 'Not a permission problem: the relay does not store ephemeral events and had no subscriber for it.'
              : 'Reason unclear — please read the message from the relay.'
      setResult({ ok: kind === 'not-stored', text: `${published.reason} — ${explanation}` })
      return
    } catch (error) {
      setResult({
        ok: false,
        text: error instanceof Error ? error.message : 'signing was cancelled',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void run()} disabled={busy}>
        {busy ? 'checking…' : 'Check write access'}
      </Button>
      {result ? (
        <p className={`text-sm ${result.ok ? 'text-success' : 'text-danger'}`}>{result.text}</p>
      ) : null}
    </div>
  )
}
