// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  client: { subscribeAcross: vi.fn() },
}))

import { client } from './client'
import { observeProfile } from './profile-store'

/**
 * CON-37: flush()'s 5s timeout and an EOSE across several relays can both
 * fire — an EOSE message already in flight when the timeout wins the race
 * still arrives after close() runs. Without a settled guard finish() runs
 * twice.
 */
describe('ProfileStore.flush', () => {
  it('only finishes a batch once even if the timeout and EOSE both fire', () => {
    vi.useFakeTimers()
    try {
      let capturedOnEose: (() => void) | undefined
      let closeCalls = 0
      vi.mocked(client.subscribeAcross).mockImplementation((_urls, _filter, _onEvent, onEose) => {
        capturedOnEose = onEose
        return () => {
          closeCalls += 1
        }
      })

      let notifyCount = 0
      const pubkey = 'a'.repeat(64)
      const unsubscribe = observeProfile(pubkey, () => {
        notifyCount += 1
      })

      vi.advanceTimersByTime(120) // request()'s batching delay -> flush()
      expect(client.subscribeAcross).toHaveBeenCalledTimes(1)

      const notifyCountAfterFlushStart = notifyCount
      vi.advanceTimersByTime(5000) // the 5s timeout wins the race, calls finish()
      capturedOnEose?.() // the EOSE that was already in flight arrives right after

      expect(closeCalls, 'finish() must not close the subscription twice').toBe(1)
      expect(
        notifyCount - notifyCountAfterFlushStart,
        'listeners must not be notified twice for one batch',
      ).toBe(1)

      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})
