import { SimplePool, verifyEvent } from 'nostr-tools'
import type { Event, EventTemplate, Filter, VerifiedEvent } from 'nostr-tools'
import type { SubCloser } from 'nostr-tools/abstract-pool'
import type { Signer } from './signer'

export type ConnectionState = 'connecting' | 'online' | 'offline'

/**
 * 'none'  = Relay hat (noch) keine AUTH-Challenge geschickt
 * 'pending' = Challenge signiert, Antwort steht aus
 * 'ok'    = Relay hat die Signatur akzeptiert
 * 'failed'= Relay hat abgelehnt oder der Signer hat abgebrochen
 */
export type AuthState = 'none' | 'pending' | 'ok' | 'failed'

export type RelaySnapshot = {
  url: string
  connection: ConnectionState
  attempts: number
  auth: AuthState
  authMessage?: string
}

export type PublishResult = { ok: true; message: string } | { ok: false; reason: string }

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'unbekannter Fehler'
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Einzige Stelle, die mit Relays spricht. Kapselt NIP-42: die Challenge wird
 * automatisch signiert, und ein Publish, das mit "auth-required" abgelehnt
 * wird, läuft nach dem AUTH erneut. Genau die beiden Fallen aus
 * docs/03-auth-nip07-nip42.md.
 */
class NostrClient {
  private pool = new SimplePool({ enableReconnect: false })
  private signer: Signer | null = null
  private snapshots = new Map<string, RelaySnapshot>()
  private listeners = new Set<() => void>()
  private retryTimers = new Map<string, number>()
  private wanted = new Set<string>()

  constructor() {
    this.pool.automaticallyAuth = (url) => this.signAuth(url)
  }

  /**
   * Signierfunktion für NIP-42. Der Relay-URL steckt laut NIP-42 als
   * relay-Tag im AUTH-Template, deshalb funktioniert eine Funktion für alle
   * Relays — der urlHint dient nur der Zustandsanzeige.
   */
  private signAuth(urlHint?: string): ((template: EventTemplate) => Promise<VerifiedEvent>) | null {
    const signer = this.signer
    if (!signer) return null
    return async (template: EventTemplate): Promise<VerifiedEvent> => {
      const url = urlHint ?? template.tags.find((tag) => tag[0] === 'relay')?.[1]
      if (url) this.patch(url, { auth: 'pending', authMessage: undefined })
      const event = await signer.signEvent(template)
      if (!verifyEvent(event)) {
        if (url) this.patch(url, { auth: 'failed', authMessage: 'Signatur ungültig' })
        throw new Error('Signatur des AUTH-Events ist ungültig')
      }
      return event
    }
  }

  // --- Zustand -------------------------------------------------------------

  subscribeState(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Muss bei unveränderten Daten dieselbe Referenz liefern —
   *  useSyncExternalStore vergleicht per Identität. */
  getSnapshot(url: string): RelaySnapshot {
    let snapshot = this.snapshots.get(url)
    if (!snapshot) {
      snapshot = { url, connection: 'connecting', attempts: 0, auth: 'none' }
      this.snapshots.set(url, snapshot)
    }
    return snapshot
  }

  private patch(url: string, change: Partial<RelaySnapshot>): void {
    const next = { ...this.getSnapshot(url), ...change, url }
    this.snapshots.set(url, next)
    for (const listener of this.listeners) listener()
  }

  // --- Verbindung ----------------------------------------------------------

  /** Verbindung offenhalten und bei Abbruch mit Backoff neu aufbauen. */
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
    this.patch(url, { connection: 'connecting' })
    try {
      const relay = await this.pool.ensureRelay(url, { connectionTimeout: 5000 })
      if (!this.wanted.has(url)) return
      this.patch(url, { connection: 'online', attempts: 0 })
      relay.onclose = () => {
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
   * Fragt den AUTH-Zustand beim Relay ab. relay.auth() gibt eine bereits
   * laufende oder abgeschlossene AUTH zurück, deshalb ist der Aufruf auch
   * nachträglich aussagekräftig. Ohne empfangene Challenge wirft es — das
   * bedeutet: dieses Relay verlangt (noch) kein AUTH.
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

  // --- Signer --------------------------------------------------------------

  /**
   * Nach einem Signer-Wechsel wird die Verbindung neu aufgebaut: AUTH gilt pro
   * Verbindung, und eine neue Challenge kommt nur mit einer neuen Verbindung.
   */
  setSigner(signer: Signer | null): void {
    this.signer = signer
    for (const url of this.wanted) {
      this.pool.close([url])
      this.patch(url, { auth: 'none', authMessage: undefined, attempts: 0 })
      void this.open(url)
    }
  }

  // --- Lesen und Schreiben -------------------------------------------------

  async publish(url: string, event: Event): Promise<PublishResult> {
    const onauth = this.signAuth(url) ?? undefined
    try {
      const [promise] = this.pool.publish([url], event, { onauth })
      const message = await promise
      void this.refreshAuth(url)
      return { ok: true, message: message || 'akzeptiert' }
    } catch (error) {
      void this.refreshAuth(url)
      return { ok: false, reason: describeError(error) }
    }
  }

  /**
   * Ein Event holen; null, wenn keins existiert. Bewusst über subscribeEose
   * statt pool.get: nur diese Variante nimmt einen onauth-Haken und wiederholt
   * die Anfrage nach einer auth-required-Ablehnung. Ohne das liefert ein Relay
   * mit erzwungenem NIP-42 stillschweigend leere Ergebnisse.
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
        // Das Lesen kann ein AUTH ausgelöst haben — Anzeige danach nachziehen.
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

  /**
   * Schreibprobe mit Rückweg: erst abonnieren, dann publishen, dann auf das
   * eigene Event warten. Deckt Lese-AUTH, Schreib-AUTH und Auslieferung ab.
   * Ephemere Events werden nicht gespeichert, hinterlassen also keine Spuren —
   * brauchen aber einen Abonnenten, sonst lehnen manche Relays sie mit
   * "mute: no one was listening for this" ab.
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

    // pool.subscribe, nicht subscribeEose: letzteres schliesst bei EOSE, und
    // bei einem ephemeren Event gibt es nichts Gespeichertes — das Abo waere
    // also schon zu, bevor publiziert wird.
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
      // dem Abo einen Moment geben, damit das ephemere Event Zuhörer hat
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
 * Ablehnungsgründe eines Relays einordnen. Die Präfixe sind in NIP-01
 * standardisiert; "mute" ist nak-spezifisch für ephemere Events ohne
 * Abonnenten. Wird ab Phase 3 auch der Editor brauchen, um zwischen
 * "darf nicht" und "hat nicht geklappt" zu unterscheiden.
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
