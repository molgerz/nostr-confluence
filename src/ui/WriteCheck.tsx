import { useState } from 'react'
import { classifyRejection, client } from '../nostr/client'
import { KINDS, TAGS } from '../nostr/kinds'
import { useSession } from '../session/session'

type Result = { ok: boolean; text: string }

/**
 * Prüft echten Schreibzugriff: signiert ein ephemeres Event (Kind 20817, wird
 * von Relays nicht gespeichert) und publisht es. Deckt damit die Kette
 * Signer → NIP-42-AUTH → Relay-Antwort ab, ohne Spuren zu hinterlassen.
 *
 * Erfüllt das Abnahmekriterium aus docs/10-roadmap.md: ein Publish darf nach
 * einem Reconnect nicht still fehlschlagen — hier wird die Relay-Antwort
 * wörtlich angezeigt.
 */
export function WriteCheck({ relayUrl, groupId }: { relayUrl: string; groupId: string }) {
  const { session, ensureSamePubkey } = useSession()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  if (session.status !== 'signed-in') {
    return (
      <p className="text-sm text-fg-muted">
        Zum Prüfen des Schreibzugriffs anmelden — Lesen geht ohne Anmeldung.
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
          [TAGS.ALT, 'Schreibtest von nostr confluence'],
        ],
        content: '',
      })
      const { published, echoed } = await client.writeProbe(relayUrl, signed)

      if (published.ok) {
        setResult({
          ok: true,
          text: echoed
            ? `Schreiben erlaubt. Relay: ${published.message}. Das Event kam über das Abo zurück.`
            : `Schreiben erlaubt. Relay: ${published.message}. Kein Rückweg — Abo hat es nicht erhalten.`,
        })
        return
      }

      const kind = classifyRejection(published.reason)
      const explanation =
        kind === 'auth'
          ? 'Das Relay verlangt NIP-42-AUTH, und die Anmeldung am Relay ist nicht durchgegangen.'
          : kind === 'permission'
            ? 'Das Relay verbietet dieser Identität das Schreiben in dieser Gruppe.'
            : kind === 'not-stored'
              ? 'Kein Rechteproblem: das Relay speichert ephemere Events nicht und hatte keinen Abonnenten dafür.'
              : 'Grund unklar — bitte den Relay-Text lesen.'
      setResult({ ok: kind === 'not-stored', text: `${published.reason} — ${explanation}` })
      return
    } catch (error) {
      setResult({
        ok: false,
        text: error instanceof Error ? error.message : 'Signieren abgebrochen',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60"
      >
        {busy ? 'prüfe…' : 'Schreibzugriff prüfen'}
      </button>
      {result ? (
        <p className={`text-xs ${result.ok ? 'text-success' : 'text-danger'}`}>{result.text}</p>
      ) : null}
    </div>
  )
}
