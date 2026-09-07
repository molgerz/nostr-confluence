import { useSession } from '../session/session'
import { DEFAULT_RELAY_URL, useRelay } from '../nostr/relay-status'
import { displayName } from '../nostr/profile'
import { PhaseNote } from '../ui/Phase'

export function Login() {
  const { session, extension, error, login } = useSession()
  const { snapshot, info } = useRelay(DEFAULT_RELAY_URL)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium text-fg">Mit Nostr anmelden</h1>

      {session.status === 'signed-in' ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface-1 p-4">
          <div className="text-sm font-medium text-fg">
            Angemeldet als {displayName(session.profile, session.npub)}
          </div>
          <div className="font-mono text-xs break-all text-fg-subtle">{session.npub}</div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-fg-subtle">Signer</dt>
            <dd className="text-fg-muted">{session.signer.kind}</dd>
            <dt className="text-fg-subtle">Relay</dt>
            <dd className="text-fg-muted">
              {info?.name ?? snapshot.url} — {snapshot.connection}
            </dd>
            <dt className="text-fg-subtle">NIP-42</dt>
            <dd className="text-fg-muted">
              {snapshot.auth}
              {snapshot.authMessage ? ` (${snapshot.authMessage})` : ''}
            </dd>
            <dt className="text-fg-subtle">Profil</dt>
            <dd className="text-fg-muted">
              {session.profile ? 'aus Kind 0 geladen' : 'kein Kind-0-Event gefunden'}
            </dd>
          </dl>
        </div>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            Die Anmeldung läuft über eine NIP-07-Extension. Diese App speichert niemals einen
            privaten Schlüssel und bietet auch kein Feld dafür an.
          </p>

          {extension === 'checking' ? (
            <p className="text-sm text-fg-subtle">Suche NIP-07-Extension…</p>
          ) : null}

          {extension === 'missing' ? (
            <div className="space-y-2 rounded-xl border border-warning bg-warning-bg p-4">
              <div className="text-sm font-medium text-fg">Keine Extension gefunden</div>
              <p className="text-sm text-fg-muted">
                Es wurde kein <code className="font-mono text-xs">window.nostr</code> gefunden.
                Verbreitete NIP-07-Extensions sind Alby und nos2x. Nach der Installation diese
                Seite neu laden.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void login()}
            disabled={session.status === 'signing-in'}
            className="rounded-md bg-accent-bg px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
          >
            {session.status === 'signing-in' ? 'warte auf Extension…' : 'Mit Nostr anmelden'}
          </button>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </>
      )}

      <PhaseNote phase="Phase 1 erledigt">
        Erkennung von window.nostr, getPublicKey per Klick, Profil aus Kind 0, NIP-42-AUTH
        automatisch bei jeder neuen Verbindung, erneuter Publish-Versuch nach
        auth-required, Account-Wechsel wird vor dem Schreiben erkannt.
      </PhaseNote>
      <PhaseNote phase="später">
        NIP-46 (Bunker) als zweite Signer-Implementierung hinter demselben Interface.
      </PhaseNote>
    </div>
  )
}
