import { useSession } from '../session/session'

/**
 * Why signing in did not work, right under the top bar. Without a sign-in page
 * there is no other place for it, and a click that visibly does nothing is the
 * worst of the possible states — somebody without an extension has to be told
 * what is missing. Only appears after an attempt, never unprompted.
 * docs/06-ui-information-architecture.md
 */
export function SessionNotice() {
  const { error, extension, clearError } = useSession()
  if (!error) return null

  return (
    <div className="shrink-0 border-b border-warning bg-warning-bg px-4 py-2">
      <div className="mx-auto flex w-full max-w-5xl items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-fg">{error}</p>
          {extension === 'missing' ? (
            <p className="text-xs text-fg-muted">
              Signing in needs a NIP-07 extension — Alby and nos2x are the common ones. Install
              one and reload this page. This app never stores a private key and offers no field
              for one.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clearError}
          aria-label="Dismiss"
          className="shrink-0 rounded-md px-2 py-0.5 text-sm text-fg-muted hover:bg-surface-2"
        >
          ×
        </button>
      </div>
    </div>
  )
}
