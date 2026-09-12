import { SimplePool, verifyEvent } from 'nostr-tools'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { bytesToHex, hexToBytes, isHex32 } from 'nostr-tools/utils'
import type { Event, EventTemplate } from 'nostr-tools'
import type { BunkerPointer } from 'nostr-tools/nip46'
import { withTimeout } from './with-timeout'
import type { Signer } from './signer'
import type { Nip46Session } from '../session/nip46-store'

/**
 * NIP-46 (bunker / remote signer) as a second `Signer` implementation. The RPC
 * itself — kind 24133, NIP-44 encryption, the subscribe/publish dance — lives
 * in `nostr-tools/nip46`, imported dynamically so NIP-07 users never download
 * it. This file adds what the library deliberately leaves open:
 *
 * - a bound on every request (`BunkerSigner.sendRequest` has no timeout of its
 *   own, and remote signing is a phone prompt away from a blink),
 * - its own pool with nostr-tools' idle-close disabled, because closing the
 *   bunker subscription between two requests drops the answer that races the
 *   re-subscribe (AGENTS.md, "nostr-tools closes an idle relay by itself"),
 * - signature verification before a remote answer reaches the data layer.
 *
 * The kind number `24133` and its `p` tag are constructed inside the library;
 * this file never writes that event, so `src/nostr/kinds.ts` gains no entry.
 * docs/03-auth-nip07-nip42.md
 */

/** A phone with a manual approval step: long, but not forever. */
export const NIP46_SIGN_TIMEOUT_MS = 60_000
export const NIP46_CONNECT_TIMEOUT_MS = 120_000

export type Nip46Options = {
  signTimeoutMs?: number
  connectTimeoutMs?: number
}

/** Just enough of nostr-tools' `BunkerSigner` for the adapter and its tests. */
export type RemoteSigner = {
  getPublicKey(): Promise<string>
  signEvent(template: EventTemplate): Promise<Event>
  close(): Promise<void>
}

type ConnectedBunker = RemoteSigner & {
  bp: BunkerPointer
  connect(metadata?: { name?: string; url?: string }): Promise<void>
}

export type Nip46Connection = {
  signer: Signer
  pubkey: string
  /** What has to be stored to rebuild this channel after a reload. */
  session: Nip46Session
}

/** A client-initiated request (`nostrconnect://`) waiting for a signer. */
export type NostrConnectOffer = {
  uri: string
  clientSecret: Uint8Array
  relays: string[]
  secret: string
}

function timeoutMessage(ms: number): string {
  return `the remote signer did not answer within ${Math.round(ms / 1000)}s`
}

function origin(): string | undefined {
  return typeof window !== 'undefined' ? window.location.origin : undefined
}

function randomSecret(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

/**
 * A pool of our own, with idle-close off. `BunkerSigner` would otherwise
 * build one with the 20 s default and close the bunker subscription between
 * two requests; the answer to a request sent a moment later races the
 * re-subscribe and is lost, and the request hangs until our timeout. It must
 * stay separate from `NostrClient`'s pool: that one's refcounting and
 * `setSigner` teardown only know app relays and must never touch this.
 */
function createBunkerPool(): SimplePool {
  const pool = new SimplePool({ enableReconnect: false })
  // SimplePool's constructor type does not expose it, but AbstractSimplePool
  // has idleTimeout as a plain public field.
  pool.idleTimeout = 0
  return pool
}

/**
 * The adapter handed to the session. Every call is bounded and every signed
 * event is verified, so a hostile or buggy bunker cannot inject an event the
 * data layer would trust by default.
 */
export function createNip46Signer(remote: RemoteSigner, options: Nip46Options = {}): Signer {
  const signTimeout = options.signTimeoutMs ?? NIP46_SIGN_TIMEOUT_MS
  const connectTimeout = options.connectTimeoutMs ?? NIP46_CONNECT_TIMEOUT_MS
  return {
    kind: 'nip46',
    getPublicKey: () =>
      withTimeout(remote.getPublicKey(), connectTimeout, timeoutMessage(connectTimeout)),
    signEvent: async (template) => {
      const event = await withTimeout(
        remote.signEvent(template),
        signTimeout,
        timeoutMessage(signTimeout),
      )
      if (!verifyEvent(event)) {
        throw new Error('the remote signer returned an event with an invalid signature')
      }
      return event
    },
    close: () => remote.close(),
  }
}

async function finishConnection(
  remote: ConnectedBunker,
  clientSecret: Uint8Array,
  pointer: BunkerPointer,
  handshake: 'connect' | 'none',
  options: Nip46Options,
): Promise<Nip46Connection> {
  const connectTimeout = options.connectTimeoutMs ?? NIP46_CONNECT_TIMEOUT_MS
  try {
    if (handshake === 'connect') {
      await withTimeout(
        remote.connect({ name: 'Akasha', url: origin() }),
        connectTimeout,
        timeoutMessage(connectTimeout),
      )
    }
    const pubkey = await withTimeout(
      remote.getPublicKey(),
      connectTimeout,
      timeoutMessage(connectTimeout),
    )
    if (!isHex32(pubkey)) throw new Error('the remote signer returned no valid pubkey')
    return {
      signer: createNip46Signer(remote, options),
      pubkey,
      session: {
        version: 1,
        clientSecret: bytesToHex(clientSecret),
        bunkerPubkey: pointer.pubkey,
        relays: pointer.relays,
        secret: pointer.secret,
        pubkey,
      },
    }
  } catch (error) {
    // A half-open channel would keep a subscription alive for a sign-in that
    // never happened. Closing is best effort; the original error is what the
    // dialog has to show.
    await remote.close().catch(() => undefined)
    throw error
  }
}

/** Turn a `bunker://` URI or a NIP-05 address into a live session. */
export async function connectBunker(
  input: string,
  options: Nip46Options = {},
): Promise<Nip46Connection> {
  const { BunkerSigner, parseBunkerInput } = await import('nostr-tools/nip46')
  const trimmed = input.trim()
  if (trimmed.length === 0) throw new Error('Enter a bunker:// URI or a NIP-05 address.')
  const pointer = await parseBunkerInput(trimmed)
  if (!pointer) {
    throw new Error(
      'That is neither a bunker:// URI nor a NIP-05 address that publishes a NIP-46 signer.',
    )
  }
  if (!isHex32(pointer.pubkey)) throw new Error('The signer pointer names no valid pubkey.')
  // fromBunker() throws synchronously on an empty relay list; catch it here so
  // the dialog shows one readable message instead of an uncaught throw.
  if (pointer.relays.length === 0) {
    throw new Error('The signer pointer names no relay the signer can be reached through.')
  }
  const clientSecret = generateSecretKey()
  const remote = BunkerSigner.fromBunker(clientSecret, pointer, { pool: createBunkerPool() })
  return finishConnection(remote, clientSecret, pointer, 'connect', options)
}

/**
 * Step one of the client-initiated flow: create the throwaway key and the
 * `nostrconnect://` URI to show (or, later, encode as a QR code).
 */
export async function createNostrConnectOffer(relays: string[]): Promise<NostrConnectOffer> {
  const { createNostrConnectURI } = await import('nostr-tools/nip46')
  if (relays.length === 0) throw new Error('No relay is configured to introduce the signer over.')
  const clientSecret = generateSecretKey()
  const secret = randomSecret()
  const uri = createNostrConnectURI({
    clientPubkey: getPublicKey(clientSecret),
    relays,
    secret,
    name: 'Akasha',
    url: origin(),
  })
  return { uri, clientSecret, relays, secret }
}

/**
 * Step two: wait until a signer answers the offer. The library's default wait
 * is 300 000 ms; the caller passes an AbortSignal so its own cancel button —
 * and unmount — can end the wait instead.
 */
export async function connectNostrConnect(
  offer: NostrConnectOffer,
  signal: AbortSignal,
  options: Nip46Options = {},
): Promise<Nip46Connection> {
  const { BunkerSigner } = await import('nostr-tools/nip46')
  const remote = await BunkerSigner.fromURI(
    offer.clientSecret,
    offer.uri,
    { pool: createBunkerPool() },
    signal,
  )
  // No `connect` RPC here: the signer already approved this request by
  // answering the offer. `get_public_key` still runs, because `bp.pubkey` is
  // the bunker's key, not necessarily the identity it signs as.
  return finishConnection(
    remote,
    offer.clientSecret,
    { pubkey: remote.bp.pubkey, relays: remote.bp.relays, secret: offer.secret },
    'none',
    options,
  )
}

/**
 * Rebuild the channel from storage after a reload, without a remote call:
 * `connect` / `get_public_key` on every page load would put a prompt on the
 * phone every time. The stored pubkey is trusted here; a signer that has
 * meanwhile decided to answer as somebody else shows up at the next write
 * (`ensureSamePubkey`), which is the earliest it could be seen at all.
 *
 * Two tabs may rebuild from the same stored client secret, so two bunker
 * subscriptions exist at once. Request ids carry a per-instance random prefix
 * (nostr-tools), so they do not collide; the duplication is accepted rather
 * than coordinated across tabs.
 */
export async function restoreNip46Session(
  session: Nip46Session,
  options: Nip46Options = {},
): Promise<Signer> {
  const { BunkerSigner } = await import('nostr-tools/nip46')
  const remote = BunkerSigner.fromBunker(
    hexToBytes(session.clientSecret),
    { pubkey: session.bunkerPubkey, relays: session.relays, secret: session.secret },
    { pool: createBunkerPool() },
  )
  return createNip46Signer(remote, options)
}
