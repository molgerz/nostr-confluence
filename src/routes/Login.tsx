import { useSession } from '../session/session'
import { DEFAULT_RELAY_URL, useRelay } from '../nostr/relay-status'
import { displayName } from '../nostr/profile'
import { PhaseNote } from '../ui/Phase'

export function Login() {
  const { session, extension, error, login } = useSession()
  const { snapshot, info } = useRelay(DEFAULT_RELAY_URL)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium text-fg">Sign in with Nostr</h1>

      {session.status === 'signed-in' ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface-1 p-4">
          <div className="text-sm font-medium text-fg">
            Signed in as {displayName(session.profile, session.npub)}
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
            <dt className="text-fg-subtle">Profile</dt>
            <dd className="text-fg-muted">
              {session.profile ? 'loaded from kind 0' : 'no kind 0 event found'}
            </dd>
          </dl>
        </div>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            Signing in works through a NIP-07 extension. This app never stores a private key
            and offers no field for one.
          </p>

          {extension === 'checking' ? (
            <p className="text-sm text-fg-subtle">Looking for a NIP-07 extension…</p>
          ) : null}

          {extension === 'missing' ? (
            <div className="space-y-2 rounded-xl border border-warning bg-warning-bg p-4">
              <div className="text-sm font-medium text-fg">No extension found</div>
              <p className="text-sm text-fg-muted">
                No <code className="font-mono text-xs">window.nostr</code> was found. Common
                NIP-07 extensions are Alby and nos2x. Reload this page after installing one.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void login()}
            disabled={session.status === 'signing-in'}
            className="rounded-md bg-accent-bg px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
          >
            {session.status === 'signing-in' ? 'waiting for the extension…' : 'Sign in with Nostr'}
          </button>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </>
      )}

      <PhaseNote phase="Phase 1 done">
        Detecting window.nostr, getPublicKey on click, profile from kind 0, NIP-42 AUTH
        automatically on every new connection, a retried publish after auth-required, and an
        account switch detected before writing.
      </PhaseNote>
      <PhaseNote phase="later">
        NIP-46 (bunker) as a second signer implementation behind the same interface.
      </PhaseNote>
    </div>
  )
}
