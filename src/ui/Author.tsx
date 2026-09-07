import { useProfile } from '../nostr/profile-store'
import { shortNpub, toNpub } from '../nostr/profile'

/**
 * Shows authorship: display name **and** npub. Display names are freely chosen
 * and not unique — which is why the npub sits next to it wherever somebody is
 * weighing whether to trust a change: history, blame, the member list.
 * docs/06-ui-information-architecture.md
 *
 * `showNpub={false}` drops it where the name is a byline rather than a claim
 * about who signed what. Even then the npub appears if the key has no profile
 * at all — an unattributed byline would be worse than a key.
 * It stays in the tooltip either way.
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
