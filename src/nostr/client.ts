import { SimplePool, verifyEvent } from 'nostr-tools'
import type { Event, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'
import type { SubCloser } from 'nostr-tools/abstract-pool'
import type { Signer } from './signer'

export type ConnectionState = 'connecting' | 'online' | 'offline'

/**
 * 'none'    = the relay has not sent an AUTH challenge (yet)
 * 'pending' = challenge signed, answer outstanding
 * 'ok'      = the relay accepted the signature
 * 'failed'  = the relay rejected it, or the signer cancelled
 */
export type AuthState = 'none' | 'pending' | 'ok' | 'failed'

export type RelaySnapshot = {
  url: string
  connection: ConnectionState
  attempts: number
  auth: AuthState
  authMessage?: string
  /**
   * Counts successful connections. Subscriptions die with their connection —
   * whoever holds one has to set it up again when this counter increases.
   */
  epoch: number
}

export type PublishResult = { ok: true; message: string } | { ok: false; reason: string }

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'unknown error'
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The only place that talks to relays. Encapsulates NIP-42: the challenge is
 * signed automatically, and a publish rejected with "auth-required" runs again
 * after AUTH. Exactly the two pitfalls from docs/03-auth-nip07-nip42.md.
 */
class NostrClient {
  private pool = new SimplePool({ enableReconnect: false })
  private signer: Signer | null = null
  private snapshots = new Map<string, RelaySnapshot>()
  private listeners = new Set<() => void>()
  private retryTimers = new Map<string, number>()
  private wanted = new Set<string>()
  /** increased on every signer change; subscriptions must be rebuilt then */
  private generation = 0
  /** Relays we close on purpose — their onclose must not trigger the
   *  reconnect counter, otherwise the UI shows "offline" when in fact only the
   *  signer changed. */
  private reopening = new Set<string>()

  constructor() {
    this.pool.automaticallyAuth = (url) => this.signAuth(url)
  }

  /**
   * Signing function for NIP-42. Per NIP-42 the relay URL sits in the AUTH
   * template as a relay tag, so one function works for every relay — the
   * urlHint only drives the status display.
   */
  private signAuth(urlHint?: string): ((template: EventTemplate) => Promise<VerifiedEvent>) | null {
    const signer = this.signer
    if (!signer) return null
    return async (template: EventTemplate): Promise<VerifiedEvent> => {
      const url = urlHint ?? template.tags.find((tag) => tag[0] === 'relay')?.[1]
      if (url) this.patch(url, { auth: 'pending', authMessage: undefined })
      const event = await signer.signEvent(template)
      if (!verifyEvent(event)) {
        if (url) this.patch(url, { auth: 'failed', authMessage: 'invalid signature' })
        throw new Error('the AUTH event signature is invalid')
      }
      return event
    }
  }

  // --- state ---------------------------------------------------------------

  subscribeState(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Has to return the same reference while the data is unchanged —
   *  useSyncExternalStore compares by identity. */
  getSnapshot(url: string): RelaySnapshot {
    let snapshot = this.snapshots.get(url)
    if (!snapshot) {
      snapshot = { url, connection: 'connecting', attempts: 0, auth: 'none', epoch: 0 }
      this.snapshots.set(url, snapshot)
    }
    return snapshot
  }

  private patch(url: string, change: Partial<RelaySnapshot>): void {
    const next = { ...this.getSnapshot(url), ...change, url }
    this.snapshots.set(url, next)
    for (const listener of this.listeners) listener()
  }

  // --- connection ----------------------------------------------------------

  /** Keep the connection open and rebuild it with backoff when it drops. */
  want(url: string): () => void {
    this.wanted.add(url)
    void this.open(url)
    return () => {
      this.wanted.delete(url)
      window.clearTimeout(this.retryTimers.get(url))
      this.retryTimers.delete(url)
    }
  }

  private async open(url: string): Promise<void> {
    if (!this.wanted.has(url)) return
    window.clearTimeout(this.retryTimers.get(url))
    this.retryTimers.delete(url)
    this.patch(url, { connection: 'connecting' })
    try {
      const relay = await this.pool.ensureRelay(url, { connectionTimeout: 5000 })
      if (!this.wanted.has(url)) return
      this.patch(url, {
        connection: 'online',
        attempts: 0,
        epoch: this.getSnapshot(url).epoch + 1,
      })
      // The pool installs its own onclose to drop the dead connection from its
      // registry. Do not overwrite it, chain onto it — otherwise the next
      // ensureRelay hands back the same dead object.
      const poolOnClose = relay.onclose
      relay.onclose = () => {
        poolOnClose?.()
        if (this.reopening.delete(url)) return
        this.patch(url, { connection: 'offline', auth: 'none', authMessage: undefined })
        this.scheduleRetry(url)
      }
      void this.refreshAuth(url)
    } catch (error) {
      this.patch(url, { connection: 'offline', authMessage: describeError(error) })
      this.scheduleRetry(url)
    }
  }

  private scheduleRetry(url: string): void {
    if (!this.wanted.has(url)) return
    const attempts = this.getSnapshot(url).attempts + 1
    this.patch(url, { attempts })
    const wait = Math.min(1000 * 2 ** (attempts - 1), 15000)
    window.clearTimeout(this.retryTimers.get(url))
    this.retryTimers.set(
      url,
      window.setTimeout(() => void this.open(url), wait),
    )
  }

  /**
   * Asks the relay for the AUTH state. relay.auth() returns an AUTH that is
   * already running or finished, so calling it after the fact is still
   * meaningful. Without a received challenge it throws — which means this relay
   * does not (yet) require AUTH.
   */
  private async refreshAuth(url: string): Promise<void> {
    const sign = this.signAuth(url)
    if (!sign) {
      this.patch(url, { auth: 'none', authMessage: undefined })
      return
    }
    const relay = this.pool.listConnectionStatus().get(url)
      ? await this.pool.ensureRelay(url)
      : null
    if (!relay) return
    await delay(200)
    try {
      const message = await relay.auth(sign)
      this.patch(url, { auth: 'ok', authMessage: message || undefined })
    } catch (error) {
      const reason = describeError(error)
      if (reason.includes('no challenge')) {
        this.patch(url, { auth: 'none', authMessage: undefined })
      } else {
        this.patch(url, { auth: 'failed', authMessage: reason })
      }
    }
  }

  // --- signer --------------------------------------------------------------

  /**
   * After a signer change the connection is rebuilt: AUTH is per connection,
   * and a new challenge only arrives with a new connection.
   */
  getGeneration(): number {
    return this.generation
  }

  setSigner(signer: Signer | null): void {
    this.signer = signer
    this.generation += 1
    for (const url of this.wanted) {
      this.reopening.add(url)
      this.pool.close([url])
      this.patch(url, { auth: 'none', authMessage: undefined, attempts: 0 })
      void this.open(url)
    }
  }

  // --- reading and writing ---------------------------------------------------

  async publish(url: string, event: Event): Promise<PublishResult> {
    const onauth = this.signAuth(url) ?? undefined
    try {
      const [promise] = this.pool.publish([url], event, { onauth })
      const message = await promise
      void this.refreshAuth(url)
      return { ok: true, message: message || 'accepted' }
    } catch (error) {
      void this.refreshAuth(url)
      return { ok: false, reason: describeError(error) }
    }
  }

  /**
   * Fetch one event; null when none exists. Deliberately via subscribeEose
   * instead of pool.get: only that variant takes an onauth hook and repeats the
   * request after an auth-required rejection. Without it, a relay with enforced
   * NIP-42 returns empty results silently.
   */
  async getOne(urls: string[], filter: Filter): Promise<Event | null> {
    if (urls.length === 0) return null
    const onauth = this.signAuth() ?? undefined

    return new Promise<Event | null>((resolve) => {
      let closer: SubCloser | null = null
      let settled = false
      const finish = (event: Event | null) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        closer?.close()
        // Reading may have triggered an AUTH — update the display afterwards.
        for (const url of urls) void this.refreshAuth(url)
        resolve(event)
      }
      const timeout = window.setTimeout(() => finish(null), 6000)

      try {
        closer = this.pool.subscribeEose(urls, filter, {
          onauth,
          onevent: (event) => finish(event),
          onclose: () => finish(null),
          maxWait: 5000,
        })
      } catch {
        finish(null)
      }
      if (settled) closer?.close()
    })
  }

  /** Like `subscribe`, but across several relays (e.g. for profiles). */
  subscribeAcross(
    urls: string[],
    filter: Filter,
    onEvent: (event: Event) => void,
    onEose?: () => void,
  ): () => void {
    if (urls.length === 0) {
      onEose?.()
      return () => {}
    }
    const onauth = this.signAuth() ?? undefined
    const closer = this.pool.subscribe(urls, filter, {
      onauth,
      onevent: onEvent,
      oneose: onEose,
    })
    return () => closer.close()
  }

  /**
   * A persistent subscription. Returns an unsubscribe function. Signatures are
   * verified by the pool (`SimplePool` sets `verifyEvent`); AUTH runs through
   * the same hook as reading.
   */
  subscribe(
    url: string,
    filter: Filter,
    onEvent: (event: Event) => void,
    onEose?: () => void,
  ): () => void {
    const onauth = this.signAuth(url) ?? undefined
    const closer = this.pool.subscribe([url], filter, {
      onauth,
      onevent: onEvent,
      oneose: onEose,
    })
    return () => closer.close()
  }

  /**
   * Write probe with an echo: subscribe first, then publish, then wait for our
   * own event. Covers read AUTH, write AUTH and delivery. Ephemeral events are
   * not stored and therefore leave no traces — but they need a subscriber,
   * otherwise some relays reject them with
   * "mute: no one was listening for this".
   */
  async writeProbe(
    url: string,
    event: Event,
    timeoutMs = 6000,
  ): Promise<{ published: PublishResult; echoed: boolean }> {
    const onauth = this.signAuth(url) ?? undefined
    let echoed = false
    let markDone: () => void = () => {}
    const done = new Promise<void>((resolve) => {
      markDone = resolve
    })

    // pool.subscribe, not subscribeEose: the latter closes on EOSE, and an
    // ephemeral event has nothing stored — so the subscription would already be
    // closed before we publish.
    const closer = this.pool.subscribe(
      [url],
      { kinds: [event.kind], authors: [event.pubkey] },
      {
        onauth,
        onevent: (received) => {
          if (received.id === event.id) {
            echoed = true
            markDone()
          }
        },
        maxWait: timeoutMs,
      },
    )

    try {
      // give the subscription a moment so the ephemeral event has listeners
      await delay(400)
      const published = await this.publish(url, event)
      if (published.ok) await Promise.race([done, delay(timeoutMs)])
      return { published, echoed }
    } finally {
      closer.close()
    }
  }
}

export const client = new NostrClient()

/**
 * Classifies a relay's rejection reason. The prefixes are standardised in
 * NIP-01; "mute" is nak-specific for ephemeral events without subscribers. The
 * editor uses this to tell "not allowed" apart from "did not work".
 */
export type RejectionKind = 'auth' | 'permission' | 'not-stored' | 'duplicate' | 'other'

export function classifyRejection(reason: string): RejectionKind {
  const text = reason.toLowerCase()
  if (text.includes('auth-required')) return 'auth'
  if (text.includes('restricted') || text.includes('blocked')) return 'permission'
  if (text.includes('mute')) return 'not-stored'
  if (text.includes('duplicate')) return 'duplicate'
  return 'other'
}
