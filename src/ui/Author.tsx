import { useProfile } from '../nostr/profile-store'
import { shortNpub, toNpub } from '../nostr/profile'

/**
 * Autorschaft anzeigen: Anzeigename **und** npub. Anzeigenamen sind frei
 * wählbar und nicht eindeutig — der npub steht deshalb immer daneben, nie
 * nur der Name. docs/06-ui-information-architecture.md
 */
export function Author({ pubkey, avatar = false }: { pubkey: string; avatar?: boolean }) {
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
      <span className="font-mono text-fg-subtle">{shortNpub(npub)}</span>
    </span>
  )
}
