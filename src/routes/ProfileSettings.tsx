import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../session/session'
import { classifyRejection } from '../nostr/client'
import { parseProfile, parseProfileContent } from '../nostr/profile'
import {
  loadOwnProfileEvent,
  preservedFields,
  profileWriteRelays,
  publishProfile,
} from '../nostr/publish-profile'
import type { ProfileDraft, RelayOutcome } from '../nostr/publish-profile'

const EMPTY: ProfileDraft = { name: '', about: '', picture: '' }

type Saved = { relays: RelayOutcome[]; ok: boolean }

/**
 * Editing one's own kind 0. Only the three fields NIP-01 names — everything
 * else another client has set is preserved unchanged, because kind 0 is
 * replaceable and a save replaces the whole profile.
 * docs/06-ui-information-architecture.md
 */
export function ProfileSettings() {
  const { session, ensureSamePubkey, applyProfile, logout } = useSession()
  const navigate = useNavigate()
  const pubkey = session.status === 'signed-in' ? session.pubkey : null

  const [existing, setExisting] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [error, setError] = useState<string | null>(null)

  const writeRelays = useMemo(() => profileWriteRelays(), [])
  const kept = useMemo(() => preservedFields(existing), [existing])

  useEffect(() => {
    if (!pubkey) return
    let cancelled = false
    setLoading(true)
    void loadOwnProfileEvent(pubkey)
      .then((event) => {
        if (cancelled) return
        setExisting(event?.content ?? null)
        const profile = event ? parseProfile(event) : null
        setDraft({
          name: profile?.name ?? '',
          about: profile?.about ?? '',
          picture: profile?.picture ?? '',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pubkey])

  const field = useCallback(
    (key: keyof ProfileDraft) => (value: string) => {
      setDraft((current) => ({ ...current, [key]: value }))
      setSaved(null)
    },
    [],
  )

  async function save() {
    if (session.status !== 'signed-in') return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      // Somebody may have switched accounts in the extension since sign-in.
      const same = await ensureSamePubkey()
      if (!same.ok) {
        setError(same.reason)
        return
      }
      const result = await publishProfile(session.signer, existing, draft)
      if (result.reason && result.relays.length === 0) {
        setError(result.reason)
        return
      }
      setSaved({ relays: result.relays, ok: result.ok })
      if (result.ok) {
        // Only now is the profile the published one — not a moment earlier.
        setExisting(result.content)
        // Read back from what was signed, so a display_name set by another
        // client keeps showing instead of falling back to the npub.
        applyProfile(parseProfileContent(result.content))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'the extension refused to sign')
    } finally {
      setSaving(false)
    }
  }

  if (session.status !== 'signed-in') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium text-fg">Profile</h1>
        <p className="text-sm text-fg-muted">
          A profile belongs to an npub, so it can only be edited while signed in.
        </p>
        <Link
          to="/login"
          className="inline-block rounded-md bg-accent-bg px-4 py-2 text-sm font-medium text-accent-fg"
        >
          Sign in with Nostr
        </Link>
      </div>
    )
  }

  const noRelay = writeRelays.length === 0

  return (
    <div className="max-w-2xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-medium text-fg">Profile</h1>
        <p className="text-sm text-fg-muted">
          Your <code className="font-mono text-xs">kind 0</code> event — the name and picture
          other people see in bylines here and in every other Nostr client.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface-1 p-4">
        <div className="text-xs text-fg-subtle">This is the identity. It cannot be changed.</div>
        <div className="mt-1 font-mono text-xs break-all text-fg-muted">{session.npub}</div>
      </div>

      {noRelay ? (
        <div className="space-y-2 rounded-xl border border-warning bg-warning-bg p-4">
          <div className="text-sm font-medium text-fg">No relay for profiles configured</div>
          <p className="text-sm text-fg-muted">
            A NIP-29 relay rejects <code className="font-mono text-xs">kind 0</code>: it demands
            an <code className="font-mono text-xs">h</code> tag on every event. The profile
            therefore needs a relay of its own — set{' '}
            <code className="font-mono text-xs">VITE_PROFILE_RELAYS</code> and reload. Locally{' '}
            <code className="font-mono text-xs">nak serve --port 10577</code> does the job.
          </p>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-fg-subtle">Reading the current profile…</p> : null}

      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-fg">Name</span>
          <span className="block text-xs text-fg-subtle">
            Freely chosen and not unique — the app always shows it next to the npub.
          </span>
          <input
            value={draft.name}
            onChange={(event) => field('name')(event.target.value)}
            placeholder="how you want to be called"
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-fg">About</span>
          <span className="block text-xs text-fg-subtle">A short bio. Plain text.</span>
          <textarea
            value={draft.about}
            onChange={(event) => field('about')(event.target.value)}
            rows={4}
            placeholder="a few sentences about you"
            className="w-full resize-y rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-fg">Picture</span>
          <span className="block text-xs text-fg-subtle">
            A URL. The image is loaded from wherever it lies — pick a host you trust.
          </span>
          <div className="flex items-start gap-3">
            <input
              value={draft.picture}
              onChange={(event) => field('picture')(event.target.value)}
              placeholder="https://…"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-subtle"
            />
            <PicturePreview url={draft.picture} />
          </div>
        </label>
      </div>

      {kept.length > 0 ? (
        <p className="text-xs text-fg-subtle">
          Kept unchanged, because this editor only writes the three NIP-01 fields:{' '}
          <span className="font-mono">{kept.join(', ')}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading || noRelay}
          className="rounded-md bg-accent-bg px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          {saving ? 'publishing…' : 'Save profile'}
        </button>
        <span className="text-xs text-fg-subtle">
          {noRelay
            ? 'nowhere to publish to'
            : `publishes to ${writeRelays.join(', ')}`}
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-danger bg-danger-bg p-3 text-sm text-fg">
          {error}
        </div>
      ) : null}

      {saved ? <PublishReport saved={saved} /> : null}

      <div className="space-y-2 border-t border-line pt-5">
        <div className="text-sm font-medium text-fg">Sign out</div>
        <p className="text-sm text-fg-muted">
          Only forgets which npub is signed in here. Nothing is deleted: the key stays in your
          extension, and everything you have published stays on the relay.
        </p>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/', { replace: true })
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-fg-muted hover:border-line-strong"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function PicturePreview({ url }: { url: string }) {
  const trimmed = url.trim()
  const [broken, setBroken] = useState(false)

  useEffect(() => setBroken(false), [trimmed])

  if (!trimmed) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-xs text-fg-subtle">
        —
      </span>
    )
  }
  if (broken) {
    return (
      <span
        title="the image could not be loaded"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-danger text-xs text-danger"
      >
        !
      </span>
    )
  }
  return (
    <img
      src={trimmed}
      alt=""
      onError={() => setBroken(true)}
      className="size-10 shrink-0 rounded-full border border-line object-cover"
    />
  )
}

/**
 * With several relays "saved" is not one boolean. Every relay is listed with
 * the reason it gave, literally — a profile that only landed on one of two
 * relays is a state the user has to be able to see.
 */
function PublishReport({ saved }: { saved: Saved }) {
  return (
    <div
      className={`space-y-2 rounded-xl border p-3 ${saved.ok ? 'border-success bg-success-bg' : 'border-danger bg-danger-bg'}`}
    >
      <div className="text-sm font-medium text-fg">
        {saved.ok ? 'Profile published' : 'No relay stored the profile'}
      </div>
      <ul className="space-y-1">
        {saved.relays.map(({ url, result }) => (
          <li key={url} className="flex flex-wrap items-baseline gap-2 text-xs">
            <span className="font-mono text-fg-muted">{url}</span>
            {result.ok ? (
              <span className="text-fg-muted">{result.message}</span>
            ) : (
              <>
                <span className="text-fg-muted">{result.reason}</span>
                <span className="text-fg-subtle">({classifyRejection(result.reason)})</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
