import { useParams } from 'react-router-dom'
import { parseGroupAddress } from '../nostr/group-address'
import type { GroupAddress } from '../nostr/group-address'
import { useSpace } from '../nostr/space-store'
import type { SpaceSnapshot } from '../nostr/space-store'
import { DEFAULT_RELAY_URL } from '../nostr/relay-status'

export type SpaceRoute = {
  group: GroupAddress | null
  relayUrl: string
  space: SpaceSnapshot
  /** Base for links inside the space, e.g. /s/host'group */
  base: string | null
  slug: string | null
}

/**
 * Reads the group address from the route and returns the matching space.
 * The store is shared per (relay, group), so calling this several times
 * creates no extra subscriptions.
 */
export function useSpaceRoute(): SpaceRoute {
  const params = useParams<{ group?: string; slug?: string }>()
  const group = params.group ? parseGroupAddress(params.group) : null
  const relayUrl = group?.relayUrl ?? DEFAULT_RELAY_URL
  const space = useSpace(relayUrl, group?.id ?? '')
  return {
    group,
    relayUrl,
    space,
    base: group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null,
    slug: params.slug ?? null,
  }
}
