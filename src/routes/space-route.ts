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
  /** Basis für Links innerhalb des Spaces, z. B. /s/host'gruppe */
  base: string | null
  slug: string | null
}

/**
 * Gruppen-Adresse aus der Route lesen und den zugehörigen Space-Zustand
 * holen. Der Store ist pro (Relay, Gruppe) geteilt, mehrfaches Aufrufen
 * erzeugt also keine zusätzlichen Abos.
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
