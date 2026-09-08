import { useSession } from '../session/session'
import { Button } from './controls'
import type { ReactNode } from 'react'

/** `inline` is the odd one out: a word inside a sentence, not a control. */
type Variant = 'primary' | 'quiet' | 'inline'

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
  const label = busy ? 'signing in…' : children

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={() => void login()}
        disabled={busy}
        title={title}
        className="text-accent-fg underline underline-offset-2 disabled:opacity-60"
      >
        {label}
      </button>
    )
  }

  return (
    <Button
      variant={variant === 'primary' ? 'primary' : 'default'}
      onClick={() => void login()}
      disabled={busy}
      title={title}
    >
      {label}
    </Button>
  )
}
