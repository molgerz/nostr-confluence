import { useEffect, useState } from 'react'
import type { Event, Filter } from 'nostr-tools'
import { client } from './client'
import { KINDS } from './kinds'
import { DEFAULT_RELAY_URL } from './relay-status'
import { parseGroupMetadata } from '../domain/group-state'

export type MySpace = { groupId: string; relayUrl: string; address: string; name: string }

/**
 * Quick, minimal version built alongside CON-1 to verify space creation
 * manually — CON-31 owns the real implementation (multiple relays, no
 * re-fetching metadata per space on every mount, proper empty/error states).
 */
function fetchOnce(relayUrl: string, filter: Filter, timeoutMs = 5000): Promise<Event[]> {
  return new Promise((resolve) => {
    const events: Event[] = []
    let settled = false
    let unsubscribe: () => void = () => {}
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      unsubscribe()
      resolve(events)
    }
    const timer = window.setTimeout(finish, timeoutMs)
    unsubscribe = client.subscribeAcross([relayUrl], filter, (event) => events.push(event), finish)
  })
}

/**
 * The relay's own indexing lags what it has just accepted — the same
 * eventual-consistency quirk `waitForGroupMetadata` in moderation.ts works
 * around for a single group's `39000`. Here it can affect **any** recently
 * written `39002`, so a single EOSE round-trip can under-report which spaces
 * a member is actually in. Retrying a few times, keeping the largest result
 * seen, works in practice — a space already found never "disappears" again.
 */
async function fetchMany(relayUrl: string, filter: Filter, attempts = 4): Promise<Event[]> {
  let best: Event[] = []
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500))
    const events = await fetchOnce(relayUrl, filter)
    if (events.length > best.length) best = events
  }
  return best
}

export function useMySpaces(pubkey: string | null): { spaces: MySpace[]; loading: boolean } {
  const [spaces, setSpaces] = useState<MySpace[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pubkey) {
      setSpaces([])
      return
    }
    let cancelled = false
    setLoading(true)

    void (async () => {
      // 39002 (members) is the only kind tagging every member with `p`, so it
      // is what answers "which groups is this pubkey in" across a relay.
      const memberEvents = await fetchMany(DEFAULT_RELAY_URL, {
        kinds: [KINDS.GROUP_MEMBERS],
        '#p': [pubkey],
      })
      const groupIds = [
        ...new Set(
          memberEvents
            .map((event) => event.tags.find((tag) => tag[0] === 'd')?.[1])
            .filter((id): id is string => Boolean(id)),
        ),
      ]

      const metadataEvents = await Promise.all(
        groupIds.map((id) =>
          client.getOne([DEFAULT_RELAY_URL], { kinds: [KINDS.GROUP_METADATA], '#d': [id] }),
        ),
      )
      if (cancelled) return

      const host = DEFAULT_RELAY_URL.replace(/^wss?:\/\//, '')
      setSpaces(
        groupIds.map((id, index) => ({
          groupId: id,
          relayUrl: DEFAULT_RELAY_URL,
          address: `${host}'${id}`,
          name: metadataEvents[index] ? parseGroupMetadata(metadataEvents[index]!, id).name : id,
        })),
      )
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [pubkey])

  return { spaces, loading }
}
