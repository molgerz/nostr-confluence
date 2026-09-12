// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KINDS } from './kinds'
import type { Event, Filter } from 'nostr-tools'

type Sub = { url: string; filter: Filter; onEvent: (event: Event) => void; onEose: () => void }

// vi.mock is hoisted above the imports, so the registry the factory writes to
// has to be hoisted with it.
const relay = vi.hoisted(() => ({
  subs: [] as Sub[],
  generation: 1,
  epoch: 1,
  auth: 'ok',
  ready: true,
}))

vi.mock('./client', () => ({
  client: {
    getGeneration: () => relay.generation,
    getSnapshot: () => ({ epoch: relay.epoch, auth: relay.auth, ready: relay.ready }),
    subscribe: (url: string, filter: Filter, onEvent: Sub['onEvent'], onEose: Sub['onEose']) => {
      relay.subs.push({ url, filter, onEvent, onEose })
      return () => {}
    },
    subscribeState: () => () => {},
  },
}))

const { clearAllSpaces, getSpaceStore } = await import('./space-store')

const RELAY = 'wss://relay.test'
const GROUP = 'engineering'

function revision(id: string, slug: string): Event {
  return {
    id,
    pubkey: 'alice',
    created_at: 1000,
    kind: KINDS.PAGE_REVISION,
    tags: [
      ['h', GROUP],
      ['d', slug],
    ],
    content: '# secret',
    sig: 'sig',
  } as Event
}

/** Hands an event to whichever subscription asked for its kind. */
function deliver(event: Event, subs: Sub[] = relay.subs): void {
  for (const sub of subs) {
    if (sub.filter.kinds?.includes(event.kind)) sub.onEvent(event)
  }
}

describe('clearAllSpaces', () => {
  beforeEach(() => {
    // Unsubscribing defers the actual close by 500ms (StrictMode mounts
    // twice). Nothing here asserts on that, and letting it fire after the test
    // has finished only leaves work running in a torn-down environment.
    vi.useFakeTimers()
    relay.subs = []
    relay.generation = 1
    relay.epoch = 1
    relay.auth = 'ok'
    relay.ready = true
    clearAllSpaces()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // The leak this guards against: sign-out (or an account switch in the
  // extension) leaves a private group's pages sitting in the store, where the
  // tree and the search keep showing them to whoever comes next.
  it('drops the pages a previous identity fetched', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    deliver(revision('e1', 'onboarding'))
    expect(store.getSnapshot().pages).toHaveLength(1)

    clearAllSpaces()

    expect(store.getSnapshot().pages).toEqual([])
    expect(store.getSnapshot().metadata).toBeNull()
    unsubscribe()
  })

  it('keeps listening, so the next identity still gets its own space', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    deliver(revision('e1', 'onboarding'))

    const before = relay.subs.length
    clearAllSpaces()
    // Only the subscriptions reset() opened afterwards, so this proves the
    // store resubscribed rather than the old ones still being wired up.
    const fresh = relay.subs.slice(before)
    expect(fresh.length).toBeGreaterThan(0)
    deliver(revision('e2', 'handbook'), fresh)

    const { pages } = store.getSnapshot()
    expect(pages.map((page) => page.slug)).toEqual(['handbook'])
    unsubscribe()
  })

  // What signing out actually looked like: reset() emptied the Maps, but the
  // requests still in flight over the old authenticated socket delivered one
  // more load of pages, and nothing ever removed those again — the sidebar
  // kept its tree and every page kept its content for an anonymous viewer.
  it('drops what an earlier round delivered when the subscriptions restart', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    const stale = relay.subs.slice()
    deliver(revision('e1', 'onboarding'), stale)
    expect(store.getSnapshot().pages).toHaveLength(1)

    // The connection comes back under a new identity; the store notices and
    // rebuilds its subscriptions.
    relay.generation = 2
    relay.epoch = 2
    store.checkConnection()

    // The relay serves an anonymous reader nothing at all: no events, and the
    // old ones must not stand in for them.
    expect(store.getSnapshot().pages).toEqual([])
    expect(store.getSnapshot().tree).toEqual([])
    unsubscribe()
  })

  it('ignores what a closed round delivers late', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    const stale = relay.subs.slice()

    relay.generation = 2
    store.checkConnection()
    // The old subscription is closed but its callback still exists — a request
    // that was in flight when the socket went down lands here.
    deliver(revision('e1', 'onboarding'), stale)

    // It is still collected (the callback cannot know), but the next restart
    // clears it rather than carrying it into the new identity's view.
    relay.generation = 3
    store.checkConnection()
    expect(store.getSnapshot().pages).toEqual([])
    unsubscribe()
  })

  // Switching accounts in the extension and then signing out and back in
  // quickly: the connection is torn down and rebuilt twice over, and while it
  // is, the pool still hands out the socket authenticated as the account
  // before. Subscribing into that window filled the store with pages the new
  // npub may not see, and no later round took them back out.
  it('opens no subscription while the connection is being rebuilt', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    relay.subs = []

    relay.ready = false
    relay.generation = 2
    store.checkConnection()

    expect(relay.subs).toEqual([])
    // Still loading, so nothing claims the space is empty or hidden either.
    expect(store.getSnapshot().loading).toBe(true)
    unsubscribe()
  })

  it('subscribes as soon as the rebuilt connection is authenticated', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    relay.subs = []

    relay.ready = false
    relay.generation = 2
    store.checkConnection()
    expect(relay.subs).toEqual([])

    relay.ready = true
    relay.epoch = 2
    store.checkConnection()

    expect(relay.subs.length).toBeGreaterThan(0)
    deliver(revision('e2', 'handbook'))
    expect(store.getSnapshot().pages.map((page) => page.slug)).toEqual(['handbook'])
    unsubscribe()
  })

  // What left tab B on "loading pages…" until a reload: start() bailed on a
  // connection that was still being rebuilt, and by the time it was ready
  // again nothing was listening. A settled connection announces nothing
  // further, so waiting for the next change means waiting forever.
  it('picks up a connection that became ready unannounced', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    expect(relay.subs.length).toBeGreaterThan(0)

    // Torn down: the subscriptions are closed and nothing is opened, because
    // the connection is being rebuilt.
    relay.ready = false
    relay.generation = 2
    store.checkConnection()
    relay.subs = []
    store.checkConnection()
    expect(relay.subs).toEqual([])

    // It comes back looking exactly like what this store last subscribed
    // under, so there is no change left to notice — the mock reproduces that
    // by restoring the values start() stamped. Only the state itself still
    // says anything, and without reading it the space waits for an
    // announcement that a settled connection never sends.
    relay.generation = 1
    relay.ready = true
    store.checkConnection()

    expect(relay.subs.length).toBeGreaterThan(0)
    deliver(revision('e1', 'onboarding'))
    expect(store.getSnapshot().pages).toHaveLength(1)
    unsubscribe()
  })

  it('keeps looking even while a signature is outstanding', () => {
    const store = getSpaceStore(RELAY, GROUP)
    relay.ready = false
    const unsubscribe = store.subscribe(() => {})
    relay.subs = []

    // An AUTH the extension never answers leaves this hanging. It must not
    // stop the store from subscribing once the connection is usable.
    relay.auth = 'pending'
    relay.ready = true
    store.checkConnection()

    expect(relay.subs.length).toBeGreaterThan(0)
    unsubscribe()
  })

  // The review asked for this one by name: the store has to rebuild its
  // subscriptions when AUTH settles, exactly once, and not on the transient
  // 'pending' on the way there or on every later patch. Without it a private
  // space reads as empty for the admin who just signed in, forever.
  it('restarts once when AUTH settles, not on the way there', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    expect(relay.subs.length).toBeGreaterThan(0)

    // Signing out first: the round that is open went out as the old identity.
    relay.auth = 'none'
    const beforeDrop = relay.subs.length
    store.checkConnection()
    const oneRound = relay.subs.length - beforeDrop
    expect(oneRound, 'the drop starts one new round').toBeGreaterThan(0)

    // 'pending' is the transient on the way back. A round opened here would be
    // as unauthenticated as the one before it.
    relay.auth = 'pending'
    const beforePending = relay.subs.length
    store.checkConnection()
    expect(relay.subs.length, 'pending is not a reason to restart').toBe(beforePending)

    // AUTH settles: one new round, this time authenticated.
    relay.auth = 'ok'
    const beforeOk = relay.subs.length
    store.checkConnection()
    const authenticated = relay.subs.slice(beforeOk)
    expect(relay.subs.length - beforeOk, 'AUTH settling opens one round, not two').toBe(oneRound)

    // And the round it opened is the one the space now reads from.
    deliver(revision('e9', 'handbook'), authenticated)
    expect(store.getSnapshot().pages.map((page) => page.slug)).toEqual(['handbook'])

    // Further patches with the same AUTH state change nothing.
    store.checkConnection()
    store.checkConnection()
    expect(relay.subs.length).toBe(beforeOk + oneRound)
    unsubscribe()
  })

  it('does not pile up a second round on a store that is already subscribed', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const unsubscribe = store.subscribe(() => {})
    const opened = relay.subs.length
    expect(opened).toBeGreaterThan(0)

    store.checkConnection()
    store.checkConnection()

    expect(relay.subs.length).toBe(opened)
    unsubscribe()
  })

  it('tells its listeners, so the UI does not keep rendering the old snapshot', () => {
    const store = getSpaceStore(RELAY, GROUP)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    deliver(revision('e1', 'onboarding'))
    listener.mockClear()

    clearAllSpaces()

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })
})
