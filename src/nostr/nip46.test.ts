import { afterEach, describe, expect, it, vi } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import type { Event, EventTemplate } from 'nostr-tools'
import type { BunkerPointer } from 'nostr-tools/nip46'

/**
 * The RPC lives in nostr-tools; this file is about what the adapter adds on
 * top — the guard rails around parsing, the bound on every request, and
 * verification before a remote answer reaches the data layer.
 */
vi.mock('nostr-tools/nip46', () => ({
  BunkerSigner: { fromBunker: vi.fn(), fromURI: vi.fn() },
  parseBunkerInput: vi.fn(),
  createNostrConnectURI: vi.fn(() => 'nostrconnect://mock'),
}))

import { BunkerSigner, parseBunkerInput, createNostrConnectURI } from 'nostr-tools/nip46'
import {
  connectBunker,
  connectNostrConnect,
  createNip46Signer,
  createNostrConnectOffer,
  restoreNip46Session,
} from './nip46'
import type { RemoteSigner } from './nip46'

const IDENTITY = getPublicKey(generateSecretKey())
const BUNKER_PUBKEY = 'b'.repeat(64)

type FakeRemote = {
  bp: BunkerPointer
  connect: ReturnType<typeof vi.fn>
  getPublicKey: ReturnType<typeof vi.fn>
  signEvent: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

function fakeRemote(overrides: Partial<FakeRemote> = {}): FakeRemote {
  return {
    bp: { pubkey: BUNKER_PUBKEY, relays: ['wss://relay.example'], secret: null },
    connect: vi.fn().mockResolvedValue(undefined),
    getPublicKey: vi.fn().mockResolvedValue(IDENTITY),
    signEvent: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function pointer(overrides: Partial<BunkerPointer> = {}): BunkerPointer {
  return { pubkey: BUNKER_PUBKEY, relays: ['wss://relay.example'], secret: null, ...overrides }
}

const TEMPLATE: EventTemplate = { kind: 1, created_at: 0, tags: [], content: 'hello' }

afterEach(() => {
  vi.clearAllMocks()
})

describe('connectBunker', () => {
  it('rejects input that is neither a bunker URI nor a NIP-05 pointer', async () => {
    vi.mocked(parseBunkerInput).mockResolvedValue(null)
    await expect(connectBunker('not a pointer')).rejects.toThrow(/neither a bunker/)
    expect(BunkerSigner.fromBunker).not.toHaveBeenCalled()
  })

  it('rejects a pointer that names no relay instead of letting the library throw', async () => {
    vi.mocked(parseBunkerInput).mockResolvedValue(pointer({ relays: [] }))
    await expect(connectBunker('bunker://x')).rejects.toThrow(/names no relay/)
    expect(BunkerSigner.fromBunker).not.toHaveBeenCalled()
  })

  it('connects through its own pool with the idle-close disabled', async () => {
    // The library would otherwise use a SimplePool with the 20 s default and
    // close the bunker subscription between two requests — the answer to a
    // request sent a moment later then races the re-subscribe and is lost.
    const remote = fakeRemote()
    vi.mocked(parseBunkerInput).mockResolvedValue(pointer())
    vi.mocked(BunkerSigner.fromBunker).mockReturnValue(remote as unknown as BunkerSigner)

    const connection = await connectBunker('bunker://x')

    expect(connection.pubkey).toBe(IDENTITY)
    expect(connection.signer.kind).toBe('nip46')
    expect(remote.connect).toHaveBeenCalledTimes(1)
    expect(connection.session).toMatchObject({
      version: 1,
      bunkerPubkey: BUNKER_PUBKEY,
      pubkey: IDENTITY,
    })
    const params = vi.mocked(BunkerSigner.fromBunker).mock.calls[0]?.[2] as
      | { pool?: { idleTimeout?: number } }
      | undefined
    expect(params?.pool?.idleTimeout).toBe(0)
  })

  it('closes a half-open channel when the signer never answers', async () => {
    const remote = fakeRemote()
    vi.mocked(parseBunkerInput).mockResolvedValue(pointer())
    vi.mocked(BunkerSigner.fromBunker).mockReturnValue(remote as unknown as BunkerSigner)
    remote.getPublicKey.mockResolvedValue('not-hex')

    await expect(connectBunker('bunker://x')).rejects.toThrow(/no valid pubkey/)
    expect(remote.close).toHaveBeenCalledTimes(1)
  })
})

describe('createNip46Signer', () => {
  it('reports kind nip46 and forwards both calls', async () => {
    const remote = fakeRemote()
    const signer = createNip46Signer(remote as unknown as RemoteSigner)
    expect(signer.kind).toBe('nip46')
    expect(await signer.getPublicKey()).toBe(IDENTITY)

    const signed = finalizeEvent(TEMPLATE, generateSecretKey())
    remote.signEvent.mockResolvedValue(signed)
    expect(await signer.signEvent(TEMPLATE)).toEqual(signed)
  })

  it('rejects an event the remote signer did not sign correctly', async () => {
    const remote = fakeRemote()
    const signed = finalizeEvent(TEMPLATE, generateSecretKey())
    // A remote signer answers with JSON, so the event arrives without
    // nostr-tools' in-memory "already verified" marker; a plain clone models
    // that. Mutation guard: drop verifyEvent and this forged event travels on.
    const forged = JSON.parse(JSON.stringify(signed)) as Event
    forged.sig = '0'.repeat(128)
    remote.signEvent.mockResolvedValue(forged)
    const signer = createNip46Signer(remote as unknown as RemoteSigner)
    await expect(signer.signEvent(TEMPLATE)).rejects.toThrow(/invalid signature/)
  })

  it('rejects with a readable message when the signer never answers', async () => {
    vi.useFakeTimers()
    try {
      const remote = fakeRemote()
      remote.signEvent.mockImplementation(() => new Promise<Event>(() => {}))
      const signer = createNip46Signer(remote as unknown as RemoteSigner, { signTimeoutMs: 5000 })
      const pending = signer.signEvent(TEMPLATE)
      const assertion = expect(pending).rejects.toThrow(
        'the remote signer did not answer within 5s',
      )
      await vi.advanceTimersByTimeAsync(5000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('connectNostrConnect', () => {
  it('forwards the abort signal and ends the wait when it fires', async () => {
    const controller = new AbortController()
    let captured: AbortSignal | number | undefined
    vi.mocked(BunkerSigner.fromURI).mockImplementation(
      (_secret, _uri, _params, maxWaitOrAbort) => {
        captured = maxWaitOrAbort as AbortSignal
        return new Promise<BunkerSigner>((_resolve, reject) => {
          ;(captured as AbortSignal).addEventListener('abort', () =>
            reject(new Error('the wait was aborted')),
          )
        })
      },
    )

    const offer = {
      uri: 'nostrconnect://mock',
      clientSecret: generateSecretKey(),
      relays: ['wss://relay.example'],
      secret: 'shared',
    }
    const pending = connectNostrConnect(offer, controller.signal)
    // The function awaits its dynamic import before it reaches fromURI, so
    // give it a tick to get there — that the already-started wait then ends on
    // abort is the point of the test.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(captured).toBe(controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow(/aborted/)
  })

  it('creates an offer with a URI and refuses to create one without a relay', async () => {
    const offer = await createNostrConnectOffer(['wss://relay.example'])
    expect(offer.uri).toBe('nostrconnect://mock')
    expect(offer.clientSecret).toHaveLength(32)
    expect(createNostrConnectURI).toHaveBeenCalledTimes(1)
    await expect(createNostrConnectOffer([])).rejects.toThrow(/No relay/)
  })
})

describe('restoreNip46Session', () => {
  it('rebuilds the channel without any remote call', async () => {
    const remote = fakeRemote()
    vi.mocked(BunkerSigner.fromBunker).mockReturnValue(remote as unknown as BunkerSigner)
    const signer = await restoreNip46Session({
      version: 1,
      clientSecret: 'c'.repeat(64),
      bunkerPubkey: BUNKER_PUBKEY,
      relays: ['wss://relay.example'],
      secret: null,
      pubkey: IDENTITY,
    })
    expect(signer.kind).toBe('nip46')
    expect(remote.connect).not.toHaveBeenCalled()
    expect(remote.getPublicKey).not.toHaveBeenCalled()
  })
})
