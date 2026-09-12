import { useCallback, useState } from 'react'
import { useSession } from '../session/session'
import { ConnectSignerDialog } from './ConnectSignerDialog'
import { Button } from './controls'
import type { ReactNode } from 'react'

/** `inline` is the odd one out: a word inside a sentence, not a control. */
type Variant = 'primary' | 'quiet' | 'inline'

/**
 * Signing in happens where the click happens — there is no sign-in page.
 * A separate page would mean leaving whatever you were reading and being sent
 * back afterwards, for a step that is one dialog in the extension. The click
 * opens `ConnectSignerDialog`, which offers the extension and a NIP-46 remote
 * signer side by side; what went wrong is shown by `SessionNotice`.
 * docs/06-ui-information-architecture.md
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
  const { session } = useSession()
  const [open, setOpen] = useState(false)
  const busy = session.status === 'signing-in'
  const label = busy ? 'signing in…' : children
  const close = useCallback(() => setOpen(false), [])

  const trigger =
    variant === 'inline' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        title={title}
        className="text-accent-fg underline underline-offset-2 disabled:opacity-60"
      >
        {label}
      </button>
    ) : (
      <Button
        variant={variant === 'primary' ? 'primary' : 'default'}
        onClick={() => setOpen(true)}
        disabled={busy}
        title={title}
      >
        {label}
      </Button>
    )

  return (
    <>
      {trigger}
      {open ? <ConnectSignerDialog onClose={close} /> : null}
    </>
  )
}
