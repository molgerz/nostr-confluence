// @vitest-environment jsdom
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { Event } from 'nostr-tools'

vi.mock('./client', () => ({ client: { subscribeAcross: vi.fn(), getOne: vi.fn() } }))

import { client } from './client'
import { useMySpaces } from './my-spaces'
import type { MySpacesState } from './my-spaces'

const PUBKEY = 'a'.repeat(64)

type Call = { onEvent: (event: Event) => void; onEose: () => void }

let calls: Call[]
let closed: number[]
let latest: MySpacesState | null = null
let root: Root

function memberEvent(id: string): Event {
  return {
    id: 'b'.repeat(64),
    pubkey: PUBKEY,
    created_at: 0,
    kind: 39002,
    tags: [['d', id]],
    content: '',
    sig: 'c'.repeat(128),
  } as Event
}

function Harness({ pubkey }: { pubkey: string | null }) {
  latest = useMySpaces(pubkey)
  return null
}

async function mount(pubkey: string | null) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root.render(createElement(Harness, { pubkey }))
  })
}

beforeEach(() => {
  calls = []
  closed = []
  latest = null
  vi.useFakeTimers()
  vi.mocked(client.subscribeAcross).mockImplementation((_urls, _filter, onEvent, onEose) => {
    const index = calls.length
    calls.push({ onEvent, onEose: onEose ?? (() => {}) })
    return () => {
      closed.push(index)
    }
  })
  vi.mocked(client.getOne).mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
  document.body.innerHTML = ''
  latest = null
})

describe('useMySpaces (CON-31)', () => {
  it('stops retrying as soon as two consecutive reads agree', async () => {
    await mount(PUBKEY)
    expect(calls).toHaveLength(1)

    await act(async () => {
      calls[0].onEvent(memberEvent('engineering'))
      calls[0].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(calls, 'one retry after the gap').toHaveLength(2)

    await act(async () => {
      calls[1].onEvent(memberEvent('engineering'))
      calls[1].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(calls, 'two agreeing reads are enough, no further attempts').toHaveLength(2)
    expect(latest?.spaces.map((space) => space.groupId)).toEqual(['engineering'])
    expect(latest?.spaces[0].name).toBe('engineering')
    expect(latest?.loading).toBe(false)
    expect(latest?.error).toBe(false)
  })

  it('keeps the largest result when an earlier read lagged behind', async () => {
    await mount(PUBKEY)

    await act(async () => {
      calls[0].onEvent(memberEvent('alpha'))
      calls[0].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    await act(async () => {
      calls[1].onEvent(memberEvent('alpha'))
      calls[1].onEvent(memberEvent('beta'))
      calls[1].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(calls, 'a disagreeing read asks for a third').toHaveLength(3)

    await act(async () => {
      calls[2].onEvent(memberEvent('alpha'))
      calls[2].onEvent(memberEvent('beta'))
      calls[2].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(calls).toHaveLength(3)
    expect(latest?.spaces.map((space) => space.groupId).sort()).toEqual(['alpha', 'beta'])
  })

  it('reports an error when the relay never answers, not an empty list', async () => {
    await mount(PUBKEY)
    expect(latest?.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(calls, 'an unreachable relay is not retried four times').toHaveLength(1)
    expect(latest?.loading).toBe(false)
    expect(latest?.error).toBe(true)
    expect(latest?.spaces).toEqual([])
  })

  it('cancels the in-flight subscription and stops retrying on unmount', async () => {
    await mount(PUBKEY)
    expect(calls).toHaveLength(1)

    await act(async () => {
      root.unmount()
    })
    expect(closed, 'the live subscription is closed').toContain(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(calls).toHaveLength(1)
  })

  it('resets loading when the pubkey goes null mid-fetch', async () => {
    await mount(PUBKEY)
    expect(latest?.loading).toBe(true)

    await act(async () => {
      root.render(createElement(Harness, { pubkey: null }))
    })

    expect(latest?.loading).toBe(false)
    expect(latest?.spaces).toEqual([])
    expect(latest?.error).toBe(false)
  })
})
