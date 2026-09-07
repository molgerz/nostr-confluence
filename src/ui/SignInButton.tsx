import { useSession } from '../session/session'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'quiet' | 'inline'

const STYLES: Record<Variant, string> = {
  primary:
    'rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg disabled:opacity-60',
  quiet:
    'rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong disabled:opacity-60',
  inline: 'text-accent-fg underline disabled:opacity-60',
}

/**
 * Signing in happens where the click happens — there is no sign-in page.
 * A separate page would mean leaving whatever you were reading and being sent
 * back afterwards, for a step that is one dialog in the extension. What the
 * page used to explain (no extension, sign-in refused) is shown by
 * `SessionNotice` instead. docs/06-ui-information-architecture.md
 */
export function SignInButton({
  children,
  variant = 'primary',
  title,
}: {
  children: ReactNode
  variant?: Variant
  title?: string
}) {
  const { session, login } = useSession()
  const busy = session.status === 'signing-in'

  return (
    <button
      type="button"
      onClick={() => void login()}
      disabled={busy}
      title={title}
      className={STYLES[variant]}
    >
      {busy ? 'signing in…' : children}
    </button>
  )
}
