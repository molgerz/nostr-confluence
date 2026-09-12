// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The connection lifecycle, with the pool faked. Everything here is about the
 * moments where a connection is being replaced — signing out and back in does
 * that twice within a moment, and every bug this file guards against lived in
 * that window.
 */

type FakeRelay = { onclose: (() => void) | null; close: () => void }

const pool = vi.hoisted(() => ({
  /** resolves the pending ensureRelay, or null while one is outstanding */
  settle: null as ((relay: FakeRelay) => void) | null,
  /** never settle the next ensureRelay — a connection attempt that hangs */
  hang: false,
  connectMs: 0,
  relays: [] as FakeRelay[],
  dead: new Set<FakeRelay>(),
  closed: [] as string[],
  ensureCalls: 0,
}))

vi.mock('nostr-tools', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  class FakeSimplePool {
    automaticallyAuth: unknown = null
    ensureRelay(): Promise<FakeRelay> {
      pool.ensureCalls += 1
      if (pool.hang) return new Promise<FakeRelay>(() => {})
      const relay: FakeRelay = { onclose: null, close: () => {} }
      pool.relays.push(relay)
      // A real handshake takes a moment, which decides whether the previous
      // socket's close event lands before or after the new connection is up.
      if (pool.connectMs === 0) return Promise.resolve(relay)
      return new Promise((resolve) => setTimeout(() => resolve(relay), pool.connectMs))
    }
    close(urls: string[]): void {
      pool.closed.push(...urls)
      // Every socket still open gets its close event, and asynchronously, the
      // way a real one does. Two reopen cycles in a row really do produce two
      // of them.
      const open = pool.relays.filter((relay) => !pool.dead.has(relay))
      for (const relay of open) {
        pool.dead.add(relay)
        setTimeout(() => relay.onclose?.(), 0)
      }
    }
    listConnectionStatus(): Map<string, boolean> {
      return new Map()
    }
    subscribe(): { close: () => void } {
      return { close: () => {} }
    }
  }
  return { ...actual, SimplePool: FakeSimplePool }
})

const { client } = await import('./client')

const URL = 'wss://relay.test'

describe('client connection lifecycle', () => {
  let release: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    pool.hang = false
    pool.connectMs = 0
    pool.relays = []
    pool.dead = new Set()
    pool.closed = []
    pool.ensureCalls = 0
  })

  afterEach(() => {
    release?.()
    release = null
    client.setSigner(null)
    vi.useRealTimers()
  })

  it('reports a connection as ready only once, and only after it is up', async () => {
    release = client.want(URL)
    expect(client.getSnapshot(URL).connection).toBe('connecting')
    expect(client.getSnapshot(URL).ready).toBe(false)

    await vi.runOnlyPendingTimersAsync()

    expect(client.getSnapshot(URL).connection).toBe('online')
    expect(client.getSnapshot(URL).ready).toBe(true)
    expect(client.getSnapshot(URL).epoch).toBeGreaterThan(0)
  })

  // The failure the user hit: the relay sat on "connecting" and never moved,
  // so nothing ever subscribed and the space stayed on "loading pages…".
  // Closing a socket that is still connecting can leave the pool's cached
  // attempt pending for good, and every later attempt awaits that same promise.
  it('does not sit on "connecting" when the attempt never finishes', async () => {
    pool.hang = true
    release = client.want(URL)
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.getSnapshot(URL).connection).toBe('connecting')

    // The bounded wait gives up instead of waiting forever, and says so by
    // starting to count attempts — the retry that follows puts the state back
    // to 'connecting', which is why the counter is what proves it.
    await vi.advanceTimersByTimeAsync(9000)
    expect(client.getSnapshot(URL).attempts).toBeGreaterThan(0)
    // It also stops awaiting the dead attempt instead of asking again.
    expect(pool.ensureCalls).toBeGreaterThan(1)

    // And once the relay answers again, it comes up on its own.
    pool.hang = false
    await vi.advanceTimersByTimeAsync(60000)
    expect(client.getSnapshot(URL).connection).toBe('online')
    expect(client.getSnapshot(URL).ready).toBe(true)
  })

  it('withdraws readiness before anyone hears about a signer change', async () => {
    release = client.want(URL)
    await vi.runOnlyPendingTimersAsync()
    expect(client.getSnapshot(URL).ready).toBe(true)

    // A subscriber must never see a usable connection in the instant the old
    // socket is being dropped — that socket is still authenticated as the
    // identity being left behind.
    let readyWhenTold: boolean | null = null
    const stop = client.subscribeState(() => {
      readyWhenTold ??= client.getSnapshot(URL).ready
    })
    client.setSigner(null)
    stop()

    expect(readyWhenTold).toBe(false)
  })

  // A close we caused says nothing about reachability. Reporting it as a lost
  // connection puts the relay "offline" and books a backoff before the real
  // connection is allowed up — which is what left a tab on "connecting".
  it('does not read a connection it replaced as a connection lost', async () => {
    release = client.want(URL)
    await vi.runOnlyPendingTimersAsync()

    const seen: string[] = []
    const stop = client.subscribeState(() => {
      const state = client.getSnapshot(URL).connection
      if (seen.at(-1) !== state) seen.push(state)
    })

    client.setSigner(null)
    client.setSigner(null)
    await vi.advanceTimersByTimeAsync(30000)
    stop()

    // 'offline' would mean a close we caused was mistaken for the connection
    // dropping by itself — which also books a backoff before the real one is
    // allowed to come up. Checking the state at the end would not catch it:
    // a successful attempt resets the counter and hides the detour.
    expect(seen).not.toContain('offline')
    expect(client.getSnapshot(URL).connection).toBe('online')
    expect(client.getSnapshot(URL).ready).toBe(true)
  })

  // Plain sign-out, nothing hurried about it: the connection is replaced, and
  // the old socket reports its close while the new one is still shaking hands.
  // That must not show up as the relay having gone away — red in the top bar
  // for as long as nobody signs back in.
  it('stays connected through a sign-out even when the old socket closes first', async () => {
    release = client.want(URL)
    await vi.runOnlyPendingTimersAsync()
    expect(client.getSnapshot(URL).ready).toBe(true)

    const seen: string[] = []
    const stop = client.subscribeState(() => {
      const state = client.getSnapshot(URL).connection
      if (seen.at(-1) !== state) seen.push(state)
    })

    pool.connectMs = 50 // the new connection needs longer than the old close
    client.setSigner(null)
    await vi.advanceTimersByTimeAsync(30000)
    stop()

    expect(seen).not.toContain('offline')
    expect(client.getSnapshot(URL).connection).toBe('online')
    expect(client.getSnapshot(URL).ready).toBe(true)
  })

  // The other half: the guard above must not swallow the real thing. A relay
  // that goes away on its own has to be noticed and retried, otherwise the app
  // shows a connection that is not there.
  it('still notices the connection in use going away', async () => {
    release = client.want(URL)
    await vi.runOnlyPendingTimersAsync()
    const live = pool.relays.at(-1)!

    live.onclose?.()

    expect(client.getSnapshot(URL).connection).toBe('offline')
    expect(client.getSnapshot(URL).ready).toBe(false)

    await vi.advanceTimersByTimeAsync(30000)
    expect(client.getSnapshot(URL).connection).toBe('online')
    expect(client.getSnapshot(URL).ready).toBe(true)
  })
})
