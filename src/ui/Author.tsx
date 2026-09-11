import { useProfile } from '../nostr/profile-store'
import { shortNpub, toNpub } from '../nostr/profile'

/**
 * Shows authorship. Product decision (2026-09-11): the name is the primary
 * display everywhere, the npub only a fallback for a key with no profile —
 * never both. Pass `showNpub={false}` explicitly at each call site to get
 * that; the prop still *defaults* to `true` (both shown) for backward
 * compatibility with call sites not yet audited against the decision above —
 * see CON-33, which tracks flipping the default itself and the other
 * places (history, blame, merge/fork notices) that show a raw npub with no
 * attempt at a name at all.
 */
export function Author({
  pubkey,
  avatar = false,
  showNpub = true,
}: {
  pubkey: string
  avatar?: boolean
  showNpub?: boolean
}) {
  const profile = useProfile(pubkey)
  const npub = toNpub(pubkey)
  const name = profile?.displayName ?? profile?.name ?? null

  return (
    <span className="inline-flex items-center gap-1.5" title={npub}>
      {avatar && profile?.picture ? (
        <img
          src={profile.picture}
          alt=""
          className="size-4 rounded-full border border-line object-cover"
        />
      ) : null}
      {name ? <span className="text-fg-muted">{name}</span> : null}
      {showNpub || !name ? (
        <span className="font-mono text-fg-subtle">{shortNpub(npub)}</span>
      ) : null}
    </span>
  )
}
