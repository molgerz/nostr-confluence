import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NIP46_STORAGE_KEY,
  clearNip46Session,
  readNip46Session,
  storeNip46Session,
} from './nip46-store'
import type { Nip46Session } from './nip46-store'

/**
 * The store is the only place a NIP-46 client key is ever written, so the
 * interesting cases are the broken ones: a value an older build, a manual edit
 * or a half-finished write left behind must read back as "no remote session"
 * instead of throwing in the mount effect.
 */
class MemoryStorage {
  private data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  clear(): void {
    this.data.clear()
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

const CLIENT = 'c'.repeat(64)
const BUNKER = 'b'.repeat(64)
const PUBKEY = 'a'.repeat(64)

const SESSION: Nip46Session = {
  version: 1,
  clientSecret: CLIENT,
  bunkerPubkey: BUNKER,
  relays: ['wss://relay.example'],
  secret: 'shared-secret',
  pubkey: PUBKEY,
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function writeRaw(value: unknown): void {
  storage.setItem(NIP46_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

describe('nip46-store', () => {
  it('round-trips a session', () => {
    storeNip46Session(SESSION)
    expect(readNip46Session()).toEqual(SESSION)
  })

  it('reads nothing when the key is absent', () => {
    expect(readNip46Session()).toBeNull()
  })

  it('refuses malformed JSON', () => {
    writeRaw('{not json')
    expect(readNip46Session()).toBeNull()
  })

  it('refuses a non-hex pubkey', () => {
    // Mutation guard: drop the isHex32 check and a malformed key survives into
    // the session, where it becomes an npub nobody can sign for.
    writeRaw({ ...SESSION, pubkey: 'z'.repeat(64) })
    expect(readNip46Session()).toBeNull()
  })

  it('refuses a truncated client secret', () => {
    writeRaw({ ...SESSION, clientSecret: 'abc' })
    expect(readNip46Session()).toBeNull()
  })

  it('refuses an empty relay list', () => {
    writeRaw({ ...SESSION, relays: [] })
    expect(readNip46Session()).toBeNull()
  })

  it('refuses a value without a version marker', () => {
    const { version: _version, ...withoutVersion } = SESSION
    writeRaw(withoutVersion)
    expect(readNip46Session()).toBeNull()
  })

  it('clear removes the key', () => {
    storeNip46Session(SESSION)
    clearNip46Session()
    expect(readNip46Session()).toBeNull()
    expect(storage.getItem(NIP46_STORAGE_KEY)).toBeNull()
  })
})
