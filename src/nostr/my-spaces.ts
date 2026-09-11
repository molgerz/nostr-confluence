import { useEffect, useState } from 'react'
import type { Event, Filter } from 'nostr-tools'
import { client } from './client'
import { KINDS } from './kinds'
import { DEFAULT_RELAY_URL } from './relay-status'
import { formatGroupAddress } from './group-address'
import { parseGroupMetadata } from '../domain/group-state'

export type MySpace = {
  groupId: string
  relayUrl: string
  address: string
  name: string
  /** The npub holds an admin role in this group (39001), so it has settings. */
  isAdmin: boolean
}

export type MySpacesState = {
  spaces: MySpace[]
  loading: boolean
  /**
   * The relay could not be read at all — distinct from a genuine empty
   * membership, which means every read reached EOSE.
   */
  error: boolean
}

/** One bounded read of the members list: EOSE, timeout, or abort. */
type ReadResult = {
  events: Event[]
  /** EOSE arrived, so the relay answered — even if it had nothing to say. */
  reached: boolean
}

const READ_TIMEOUT_MS = 5000
const RETRY_GAP_MS = 500

function groupIdsOf(events: Event[]): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    const id = event.tags.find((tag) => tag[0] === 'd')?.[1]
    if (id) ids.add(id)
  }
  return ids
}

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/**
 * A single EOSE round-trip for one membership filter. Resolves null when the
 * signal aborts before the relay answered.
 */
function fetchOnce(
  relayUrl: string,
  filter: Filter,
  signal: AbortSignal,
  timeoutMs = READ_TIMEOUT_MS,
): Promise<ReadResult | null> {
  return new Promise((resolve) => {
    const events: Event[] = []
    let settled = false
    let unsubscribe: () => void = () => {}
    const finish = (result: ReadResult | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      unsubscribe()
      resolve(result)
    }
    const onAbort = () => finish(null)
    const timer = window.setTimeout(() => finish({ events, reached: false }), timeoutMs)
    if (signal.aborted) {
      finish(null)
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      unsubscribe = client.subscribeAcross(
        [relayUrl],
        filter,
        (event) => events.push(event),
        () => finish({ events, reached: true }),
      )
    } catch {
      finish({ events, reached: false })
    }
  })
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * The relay's own indexing lags what it has just accepted — the same
 * eventual-consistency quirk waitForGroupMetadata in moderation.ts works
 * around for a single group's 39000. Here it can affect any recently written
 * 39002/39001, so a single EOSE round-trip can under-report which spaces a
 * member is actually in.
 *
 * Retries stop as soon as two consecutive reads agree with each other, and
 * keep the largest result seen (a space already found never disappears again).
 * A read that never reached EOSE is not retried: that is an unreachable relay,
 * and more identical timeouts only delay the error.
 */
async function fetchMany(
  relayUrl: string,
  filter: Filter,
  signal: AbortSignal,
  attempts = 4,
): Promise<ReadResult> {
  let best: Event[] = []
  let bestIds = new Set<string>()
  let previousIds: Set<string> | null = null
  let reached = false

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (signal.aborted) break
    if (attempt > 0) {
      await sleep(RETRY_GAP_MS, signal)
      if (signal.aborted) break
    }
    const read = await fetchOnce(relayUrl, filter, signal)
    if (!read) break
    if (read.reached) reached = true
    const ids = groupIdsOf(read.events)
    if (ids.size > bestIds.size) {
      best = read.events
      bestIds = ids
    }
    if (previousIds && sameIds(previousIds, ids)) break
    previousIds = ids
    if (!read.reached) break
  }

  return { events: best, reached }
}

/**
 * The spaces the signed-in npub is a member of, discovered from the relay's
 * 39002 membership events and named via each group's 39000 metadata.
 *
 * 39001 (admins) is fetched alongside 39002 so callers can tell which of
 * those spaces the npub can actually administer — /settings/spaces lists only
 * those.
 *
 * Reads only the app's one relay; a read path across several relays is
 * deferred with the mirror-relay decision (CON-25, CON-24). Metadata is
 * re-fetched on every mount instead of cached — that is the IndexedDB cache,
 * CON-8.
 */
export function useMySpaces(pubkey: string | null): MySpacesState {
  const [state, setState] = useState<MySpacesState>({
    spaces: [],
    loading: false,
    error: false,
  })

  useEffect(() => {
    if (!pubkey) {
      setState({ spaces: [], loading: false, error: false })
      return
    }
    const controller = new AbortController()
    const { signal } = controller
    setState({ spaces: [], loading: true, error: false })

    void (async () => {
      try {
        // 39002 (members) tags every member with p, so it is what answers
        // "which groups is this pubkey in" across a relay. 39001 (admins)
        // does the same for admin status.
        const [members, admins] = await Promise.all([
          fetchMany(
            DEFAULT_RELAY_URL,
            { kinds: [KINDS.GROUP_MEMBERS], '#p': [pubkey] },
            signal,
          ),
          fetchMany(
            DEFAULT_RELAY_URL,
            { kinds: [KINDS.GROUP_ADMINS], '#p': [pubkey] },
            signal,
          ),
        ])
        if (signal.aborted) return

        const groupIds = [...groupIdsOf(members.events)]
        const adminGroupIds = groupIdsOf(admins.events)
        const metadataEvents = await Promise.all(
          groupIds.map((id) =>
            client.getOne([DEFAULT_RELAY_URL], {
              kinds: [KINDS.GROUP_METADATA],
              '#d': [id],
            }),
          ),
        )
        if (signal.aborted) return

        const host = DEFAULT_RELAY_URL.replace(/^wss?:\/\//, '')
        const spaces = groupIds.map((id, index) => ({
          groupId: id,
          relayUrl: DEFAULT_RELAY_URL,
          address: formatGroupAddress({ host, id, relayUrl: DEFAULT_RELAY_URL }),
          name: metadataEvents[index]
            ? parseGroupMetadata(metadataEvents[index]!, id).name
            : id,
          isAdmin: adminGroupIds.has(id),
        }))
        setState({
          spaces,
          loading: false,
          error: !members.reached && spaces.length === 0,
        })
      } catch {
        if (signal.aborted) return
        setState({ spaces: [], loading: false, error: true })
      }
    })()

    return () => controller.abort()
  }, [pubkey])

  return state
}
