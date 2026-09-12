// @vitest-environment jsdom
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { Event, Filter } from 'nostr-tools'

vi.mock('./client', () => ({ client: { subscribeAcross: vi.fn(), getOne: vi.fn() } }))

import { client } from './client'
import { KINDS } from './kinds'
import { useMySpaces } from './my-spaces'
import type { MySpacesState } from './my-spaces'

const PUBKEY = 'a'.repeat(64)

type Call = {
  filter: Filter
  onEvent: (event: Event) => void
  onEose: () => void
}

let calls: Call[]
let closed: number[]
let latest: MySpacesState | null = null
let root: Root

function membershipEvent(kind: number, id: string): Event {
  return {
    id: 'b'.repeat(64),
    pubkey: PUBKEY,
    created_at: 0,
    kind,
    tags: [['d', id]],
    content: '',
    sig: 'c'.repeat(128),
  } as Event
}

/** Every read issued against the 39002 (members) filter, in order. */
const members = () => calls.filter((call) => call.filter.kinds?.includes(KINDS.GROUP_MEMBERS))
/** Every read issued against the 39001 (admins) filter, in order. */
const admins = () => calls.filter((call) => call.filter.kinds?.includes(KINDS.GROUP_ADMINS))

function memberEvent(id: string): Event {
  return membershipEvent(KINDS.GROUP_MEMBERS, id)
}

function adminEvent(id: string): Event {
  return membershipEvent(KINDS.GROUP_ADMINS, id)
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
  vi.mocked(client.subscribeAcross).mockImplementation((_urls, filter, onEvent, onEose) => {
    const index = calls.length
    calls.push({ filter, onEvent, onEose: onEose ?? (() => {}) })
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
    expect(members()).toHaveLength(1)

    await act(async () => {
      members()[0].onEvent(memberEvent('engineering'))
      members()[0].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(members(), 'one retry after the gap').toHaveLength(2)

    await act(async () => {
      members()[1].onEvent(memberEvent('engineering'))
      members()[1].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(members(), 'two agreeing reads are enough, no further attempts').toHaveLength(2)
    expect(latest?.spaces.map((space) => space.groupId)).toEqual(['engineering'])
    expect(latest?.spaces[0].name).toBe('engineering')
    expect(latest?.loading).toBe(false)
    expect(latest?.error).toBe(false)
  })

  it('keeps the largest result when an earlier read lagged behind', async () => {
    await mount(PUBKEY)

    await act(async () => {
      members()[0].onEvent(memberEvent('alpha'))
      members()[0].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    await act(async () => {
      members()[1].onEvent(memberEvent('alpha'))
      members()[1].onEvent(memberEvent('beta'))
      members()[1].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    expect(members(), 'a disagreeing read asks for a third').toHaveLength(3)

    await act(async () => {
      members()[2].onEvent(memberEvent('alpha'))
      members()[2].onEvent(memberEvent('beta'))
      members()[2].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(members()).toHaveLength(3)
    expect(latest?.spaces.map((space) => space.groupId).sort()).toEqual(['alpha', 'beta'])
  })

  it('marks a space the npub administers from 39001', async () => {
    await mount(PUBKEY)

    await act(async () => {
      members()[0].onEvent(memberEvent('engineering'))
      members()[0].onEose()
      admins()[0].onEvent(adminEvent('engineering'))
      admins()[0].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    await act(async () => {
      members()[1].onEvent(memberEvent('engineering'))
      members()[1].onEose()
      admins()[1].onEvent(adminEvent('engineering'))
      admins()[1].onEose()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(latest?.spaces.map((space) => [space.groupId, space.isAdmin])).toEqual([
      ['engineering', true],
    ])
  })

  it('reports an error when the relay never answers, not an empty list', async () => {
    await mount(PUBKEY)
    expect(latest?.loading).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })

    expect(members(), 'an unreachable relay is not retried four times').toHaveLength(1)
    expect(admins(), 'the admin read is bounded the same way').toHaveLength(1)
    expect(latest?.loading).toBe(false)
    expect(latest?.error).toBe(true)
    expect(latest?.spaces).toEqual([])
  })

  it('cancels the in-flight subscription and stops retrying on unmount', async () => {
    await mount(PUBKEY)
    expect(members()).toHaveLength(1)

    await act(async () => {
      root.unmount()
    })
    expect(closed, 'the live subscriptions are closed').toContain(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(members()).toHaveLength(1)
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
