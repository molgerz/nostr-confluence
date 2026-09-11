import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createGroupAndWait, editMetadata } from '../nostr/moderation'
import { classifyRejection } from '../nostr/client'
import { KINDS, normalizeSlug } from '../nostr/kinds'
import { DEFAULT_RELAY_URL } from '../nostr/relay-status'
import { useSession } from '../session/session'
import { SignInButton } from './SignInButton'
import { Button, Callout, Card, INPUT, SectionLabel, TEXTAREA } from './controls'
import { PlusIcon } from './icons'

const LOCAL_HOST = DEFAULT_RELAY_URL.replace(/^wss?:\/\//, '')

// Every kind the app writes as content, declared up front so a freshly
// created space accepts its own pages and comments right away.
// src/routes/SpaceOverview.tsx warns once a space is missing one of these.
const DEFAULT_SUPPORTED_KINDS = [KINDS.PAGE_REVISION, KINDS.COMMENT, KINDS.PAGE_PLACEMENT]

/**
 * Creates a space: `9007` (create-group), then `9002` with a name and the
 * invite-only flags — a group without that second step would sit there as
 * `private`+`closed` but not `restricted`, letting non-members publish into
 * it. docs/04-permissions-nip29.md
 */
export function CreateSpaceForm() {
  const { session, ensureSamePubkey } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <Button variant="subtle" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Create a space
      </Button>
    )
  }

  if (session.status !== 'signed-in') {
    return (
      <Card className="p-4">
        <p className="text-sm text-fg-muted">
          <SignInButton variant="inline">Sign in</SignInButton> to create a space.
        </p>
      </Card>
    )
  }

  const groupId = normalizeSlug(name)
  const address = `${LOCAL_HOST}'${groupId}`

  const create = async () => {
    setError(null)
    if (name.trim().length === 0) {
      setError('Give the space a name.')
      return
    }
    if (groupId.length === 0) {
      setError('No id can be derived from this name — please use letters or digits.')
      return
    }

    setBusy(true)
    try {
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setError(same.reason)
        return
      }

      const base = { relayUrl: DEFAULT_RELAY_URL, groupId }
      const created = await createGroupAndWait(session.signer, base)
      if (!created.ok) {
        const kind = classifyRejection(created.reason)
        setError(
          kind === 'auth'
            ? `The relay requires authentication (NIP-42): ${created.reason}`
            : `Not created: ${created.reason}`,
        )
        return
      }

      const metadata = await editMetadata(session.signer, {
        ...base,
        name: name.trim(),
        about: about.trim() || undefined,
        supportedKinds: DEFAULT_SUPPORTED_KINDS,
      })
      if (!metadata.ok) {
        setError(
          `The space was created, but its metadata was not: ${metadata.reason}. ` +
            'It may be missing its name and invite-only flags — try again from the space settings once available.',
        )
        return
      }

      navigate(`/s/${encodeURIComponent(address)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'signing was cancelled')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Create a space</SectionLabel>

      <div>
        <label htmlFor="space-name" className="mb-1 block text-xs font-medium text-fg-muted">
          Name
        </label>
        <input
          id="space-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Engineering"
          className={INPUT}
          autoFocus
        />
        {name.trim().length > 0 ? (
          <p className="mt-1 truncate font-mono text-xs text-fg-subtle">{address}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="space-about" className="mb-1 block text-xs font-medium text-fg-muted">
          Description (optional)
        </label>
        <textarea
          id="space-about"
          value={about}
          onChange={(event) => setAbout(event.target.value)}
          rows={2}
          className={TEXTAREA}
        />
      </div>

      <p className="text-xs text-fg-subtle">
        Invite-only: only npubs an admin adds can read or write here. You become the first
        admin.
      </p>

      {error ? <Callout tone="danger">{error}</Callout> : null}

      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void create()}>
          {busy ? 'creating…' : 'Create space'}
        </Button>
        <Button
          variant="subtle"
          disabled={busy}
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
        >
          Cancel
        </Button>
      </div>
    </Card>
  )
}
