// @vitest-environment jsdom
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { Event, EventTemplate } from 'nostr-tools'

vi.mock('../nostr/client', () => ({
  client: {
    setSigner: vi.fn(),
    getOne: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(),
    subscribeAcross: vi.fn(),
  },
}))
vi.mock('../nostr/space-store', () => ({ clearAllSpaces: vi.fn() }))
vi.mock('../nostr/profile-store', () => ({ cacheProfile: vi.fn() }))
// The extension poll would otherwise add a real 1.5 s delay; there is no
// window.nostr in jsdom anyway.
vi.mock('../nostr/signer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nostr/signer')>()
  return { ...actual, waitForNip07: vi.fn().mockResolvedValue(null) }
})
vi.mock('../nostr/nip46', () => ({
  restoreNip46Session: vi.fn(),
  connectBunker: vi.fn(),
  connectNostrConnect: vi.fn(),
}))

import { restoreNip46Session } from '../nostr/nip46'
import { SessionProvider, useSession } from './session'
import { NIP46_STORAGE_KEY } from './nip46-store'

const IDENTITY = 'a'.repeat(64)
const BOB = 'd'.repeat(64)
const CLIENT = 'c'.repeat(64)
const BUNKER = 'b'.repeat(64)

type SignerStub = {
  kind: 'nip46'
  getPublicKey: () => Promise<string>
  signEvent: (template: EventTemplate) => Promise<Event>
  close: () => Promise<void>
}

let root: Root | null = null
let latest: ReturnType<typeof useSession> | null = null
let signerStub: SignerStub
let closeSpy: Mock<() => Promise<void>>

function Harness() {
  latest = useSession()
  return null
}

function stored(pubkey: string, clientSecret = CLIENT) {
  return JSON.stringify({
    version: 1,
    clientSecret,
    bunkerPubkey: BUNKER,
    relays: ['wss://relay.example'],
    secret: null,
    pubkey,
  })
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(createElement(SessionProvider, null, createElement(Harness)))
  })
  // one more tick for the async mount effect
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
  closeSpy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  signerStub = {
    kind: 'nip46',
    getPublicKey: async () => IDENTITY,
    signEvent: async () => {
      throw new Error('not used in this test')
    },
    close: closeSpy,
  }
  vi.mocked(restoreNip46Session).mockResolvedValue(signerStub)
  localStorage.clear()
  localStorage.setItem('nc-pubkey', IDENTITY)
  localStorage.setItem(NIP46_STORAGE_KEY, stored(IDENTITY))
  latest = null
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root!.unmount()
    })
    root = null
  }
  document.body.innerHTML = ''
  latest = null
})

describe('session NIP-46 resume', () => {
  it('resumes a stored NIP-46 session without asking the remote signer', async () => {
    await mount()
    expect(latest?.session.status).toBe('signed-in')
    if (latest?.session.status !== 'signed-in') throw new Error('expected a signed-in session')
    expect(latest.session.pubkey).toBe(IDENTITY)
    expect(latest.session.signer.kind).toBe('nip46')
    expect(latest.session.relays).toEqual(['wss://relay.example'])
    expect(restoreNip46Session).toHaveBeenCalledTimes(1)
  })

  it('discards a bunker pointer that has no signed-in identity', async () => {
    localStorage.removeItem('nc-pubkey')
    await mount()
    expect(latest?.session.status).toBe('anonymous')
    expect(localStorage.getItem(NIP46_STORAGE_KEY)).toBeNull()
  })

  it('discards a bunker pointer for a different identity', async () => {
    localStorage.setItem(NIP46_STORAGE_KEY, stored(BOB))
    await mount()
    expect(latest?.session.status).toBe('anonymous')
    expect(localStorage.getItem(NIP46_STORAGE_KEY)).toBeNull()
  })

  it('signs out by clearing both keys and closing the remote channel', async () => {
    await mount()
    await act(async () => {
      latest!.logout()
    })
    expect(latest?.session.status).toBe('anonymous')
    expect(localStorage.getItem('nc-pubkey')).toBeNull()
    expect(localStorage.getItem(NIP46_STORAGE_KEY)).toBeNull()
    expect(closeSpy).toHaveBeenCalledTimes(1)
  })

  it('adopts the NIP-46 session another tab signed in with', async () => {
    await mount()
    // another tab signs in as BOB through its own NIP-46 channel
    localStorage.setItem(NIP46_STORAGE_KEY, stored(BOB))
    localStorage.setItem('nc-pubkey', BOB)
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'nc-pubkey' }))
    })
    await act(async () => {})
    if (latest?.session.status !== 'signed-in') throw new Error('expected an adopted session')
    expect(latest.session.pubkey).toBe(BOB)
    expect(latest.session.signer.kind).toBe('nip46')
  })
})
