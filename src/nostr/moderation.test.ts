import { afterEach, describe, expect, it, vi } from 'vitest'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools'
import type { Signer } from './signer'
import { KINDS } from './kinds'
import { client } from './client'
import { createGroupAndWait, waitForGroupMetadata } from './moderation'

vi.mock('./client', () => ({
  client: { getOne: vi.fn(), publish: vi.fn() },
}))

const secretKey = generateSecretKey()
const signer: Signer = {
  kind: 'dev',
  getPublicKey: async () => getPublicKey(secretKey),
  signEvent: async (template) => finalizeEvent(template, secretKey),
}
const base = { relayUrl: 'ws://relay.example', groupId: 'engineering' }

function metadataEvent() {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 0,
    kind: KINDS.GROUP_METADATA,
    tags: [],
    content: '',
    sig: 'c'.repeat(128),
  }
}

describe('waitForGroupMetadata', () => {
  afterEach(() => {
    vi.mocked(client.getOne).mockReset()
  })

  it('returns true as soon as the group metadata is queryable', async () => {
    vi.mocked(client.getOne).mockResolvedValueOnce(null).mockResolvedValueOnce(metadataEvent())
    await expect(waitForGroupMetadata(base.relayUrl, base.groupId, 1000, 50)).resolves.toBe(true)
    expect(client.getOne).toHaveBeenCalledTimes(2)
  })

  it('asks for 39000 of this group', async () => {
    vi.mocked(client.getOne).mockResolvedValue(metadataEvent())
    await waitForGroupMetadata(base.relayUrl, base.groupId, 500, 50)
    expect(client.getOne).toHaveBeenCalledWith(
      [base.relayUrl],
      { kinds: [KINDS.GROUP_METADATA], '#d': [base.groupId] },
      expect.anything(),
    )
  })

  it('returns false once the budget is spent instead of waiting forever', async () => {
    vi.mocked(client.getOne).mockResolvedValue(null)
    await expect(waitForGroupMetadata(base.relayUrl, base.groupId, 250, 50)).resolves.toBe(false)
  })

  // The review's MEDIUM: getOne's own default allowed ~6s per call, so one slow
  // relay could blow the outer budget in a single attempt.
  it('bounds every read to the smaller of perCall and the remaining budget', async () => {
    vi.mocked(client.getOne).mockResolvedValue(null)
    await waitForGroupMetadata(base.relayUrl, base.groupId, 400, 100)
    const options = vi.mocked(client.getOne).mock.calls.map((call) => call[2])
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect(option?.timeoutMs).toBeLessThanOrEqual(100)
      expect(option?.maxWait).toBeLessThanOrEqual(100)
    }
  })
})

describe('createGroupAndWait', () => {
  afterEach(() => {
    vi.mocked(client.publish).mockReset()
    vi.mocked(client.getOne).mockReset()
    vi.useRealTimers()
  })

  it('reports a rejected 9007 as a failure without polling', async () => {
    vi.mocked(client.publish).mockResolvedValue({ ok: false, reason: 'restricted: not an admin' })
    await expect(createGroupAndWait(signer, base)).resolves.toEqual({
      ok: false,
      reason: 'restricted: not an admin',
    })
    expect(client.getOne).not.toHaveBeenCalled()
  })

  // The review's HIGH: a group the relay accepted but did not make readable in
  // time is not a "not created" — the 9007 did land.
  it('keeps a created-but-unsettled group as a success', async () => {
    vi.useFakeTimers()
    vi.mocked(client.publish).mockResolvedValue({ ok: true, message: 'accepted' })
    vi.mocked(client.getOne).mockResolvedValue(null)
    const pending = createGroupAndWait(signer, base)
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toEqual({ ok: true, settled: false })
  })

  it('reports a settled group as settled', async () => {
    vi.mocked(client.publish).mockResolvedValue({ ok: true, message: 'accepted' })
    vi.mocked(client.getOne).mockResolvedValue(metadataEvent())
    await expect(createGroupAndWait(signer, base)).resolves.toEqual({ ok: true, settled: true })
  })
})
