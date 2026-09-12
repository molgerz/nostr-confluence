import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../session/session'
import { createNostrConnectOffer } from '../nostr/nip46'
import type { NostrConnectOffer } from '../nostr/nip46'
import { DEFAULT_RELAY_URL } from '../nostr/relay-status'
import { Button, Callout, Card, IconButton, INPUT, SectionLabel } from './controls'
import { CloseIcon } from './icons'

type View = 'options' | 'bunker' | 'nostrconnect'

/**
 * The second way in. Without an extension the app used to dead-end on "install
 * one" — which is no answer at all on a phone. The dialog offers both paths as
 * equals: the extension, or a remote signer reached over a `bunker://` URI /
 * NIP-05 address, or a client-initiated `nostrconnect://` URI the signer scans
 * or opens. docs/03-auth-nip07-nip42.md
 */
export function ConnectSignerDialog({ onClose }: { onClose: () => void }) {
  const {
    session,
    extension,
    error,
    clearError,
    loginWithNip07,
    loginWithBunker,
    loginWithNostrConnect,
  } = useSession()
  const [view, setView] = useState<View>('options')
  const [input, setInput] = useState('')
  const [offer, setOffer] = useState<NostrConnectOffer | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const busy = session.status === 'signing-in'
  const shownError = localError ?? error

  // A successful sign-in closes the dialog. The session itself outlives it.
  useEffect(() => {
    if (session.status === 'signed-in') onClose()
  }, [session.status, onClose])

  // Leaving while the long poll for a `nostrconnect` answer is still running
  // must end that poll, or its subscription lives on with nothing rendering it.
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const startNostrConnect = useCallback(async () => {
    setLocalError(null)
    setView('nostrconnect')
    try {
      const next = await createNostrConnectOffer([DEFAULT_RELAY_URL])
      const controller = new AbortController()
      abortRef.current = controller
      setOffer(next)
      // Deliberately not awaited: the URI has to be visible while we wait for
      // the signer to answer it.
      void loginWithNostrConnect(next, controller.signal)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'could not create a connection request')
      setView('options')
    }
  }, [loginWithNostrConnect])

  const cancelNostrConnect = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setOffer(null)
    setView('options')
    setLocalError(null)
  }, [])

  const submitBunker = useCallback(async () => {
    setLocalError(null)
    const value = input.trim()
    if (value.length === 0) {
      setLocalError('Enter a bunker:// URI or a NIP-05 address.')
      return
    }
    await loginWithBunker(value)
  }, [input, loginWithBunker])

  const copyUri = useCallback(async () => {
    if (!offer) return
    try {
      await navigator.clipboard.writeText(offer.uri)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setLocalError('Copying failed — select the URI and copy it by hand.')
    }
  }, [offer])

  const back = () => {
    cancelNostrConnect()
    clearError()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-label="Sign in" className="w-full max-w-md">
        <Card className="space-y-4 p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionLabel>Sign in</SectionLabel>
              <p className="mt-1 text-xs text-fg-subtle">
                Akasha never stores your identity key — the signer keeps it.
              </p>
            </div>
            <IconButton label="Close" onClick={onClose}>
              <CloseIcon className="size-4" />
            </IconButton>
          </div>

          {shownError ? <Callout tone="danger">{shownError}</Callout> : null}

          {view === 'options' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-fg">Browser extension (NIP-07)</div>
                <p className="text-xs text-fg-subtle">
                  {extension === 'missing'
                    ? 'No extension was detected. Alby and nos2x are the common ones; install one and reload, or use a remote signer instead.'
                    : 'Sign with an installed extension such as Alby or nos2x.'}
                </p>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => {
                    clearError()
                    void loginWithNip07()
                  }}
                >
                  {busy ? 'signing in…' : 'Sign in with extension'}
                </Button>
              </div>

              <div className="border-t border-line pt-3">
                <div className="text-sm font-medium text-fg">Remote signer (NIP-46)</div>
                <p className="mt-1 text-xs text-fg-subtle">
                  A bunker on another device, for example Amber or nsec.app. Signing takes longer
                  than with an extension, because your signer has to approve each request.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="default" disabled={busy} onClick={() => setView('bunker')}>
                    Paste a bunker URI
                  </Button>
                  <Button
                    variant="default"
                    disabled={busy}
                    onClick={() => void startNostrConnect()}
                  >
                    Use a connect code
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {view === 'bunker' ? (
            <div className="space-y-3">
              <label className="block space-y-1.5" htmlFor="bunker-input">
                <span className="block text-sm font-medium text-fg">Bunker URI or NIP-05</span>
                <span className="block text-xs text-fg-subtle">
                  <code className="font-mono">bunker://…</code> from your signer, or a name such
                  as <code className="font-mono">you@example.com</code> that publishes one.
                </span>
              </label>
              <input
                id="bunker-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="bunker://…"
                className={INPUT}
                autoFocus
                disabled={busy}
              />
              <p className="text-xs text-fg-subtle">
                {busy ? 'Waiting for your signer to approve the connection…' : ''}
              </p>
              <div className="flex gap-2">
                <Button variant="primary" disabled={busy} onClick={() => void submitBunker()}>
                  {busy ? 'connecting…' : 'Connect'}
                </Button>
                <Button variant="subtle" disabled={busy} onClick={back}>
                  Back
                </Button>
              </div>
            </div>
          ) : null}

          {view === 'nostrconnect' ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-fg">Connect with a code</div>
              {offer ? (
                <>
                  <p className="text-xs text-fg-subtle">
                    Open this in your signer, or paste it there. It stays valid until you cancel.
                  </p>
                  <div className="break-all rounded-md border border-line bg-surface-0 p-2 font-mono text-xs text-fg-muted">
                    {offer.uri}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="default" onClick={() => void copyUri()}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="subtle" onClick={cancelNostrConnect}>
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-fg-subtle">
                    Waiting for your signer to answer… this can take a while.
                  </p>
                </>
              ) : (
                <p className="text-xs text-fg-subtle">Creating a connection request…</p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
