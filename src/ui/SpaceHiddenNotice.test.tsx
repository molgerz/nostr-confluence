// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SpaceHiddenNotice } from './SpaceHiddenNotice'

/**
 * The one wording every withheld space shows. It is the only place that says
 * "you are not a member" and "no such space" are the same silence, and the npub
 * it hands a signed-in reader is what an admin needs — so both branches are
 * pinned here, next to the domain test that decides when the notice appears.
 * src/domain/space-access.test.ts
 */
const session = vi.hoisted(() => ({
  current: { status: 'anonymous' } as Record<string, unknown>,
}))

vi.mock('../session/session', () => ({
  useSession: () => ({ session: session.current, login: vi.fn() }),
}))

const NPUB = `npub1${'1'.repeat(58)}`

function render(): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<SpaceHiddenNotice />)
  })
  return host
}

describe('SpaceHiddenNotice', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    session.current = { status: 'anonymous' }
  })

  it('offers sign-in and says the relay hides even the name', () => {
    const host = render()
    expect(host.textContent).toContain('This space is private')
    expect(host.querySelector('button')?.textContent).toContain('Sign in')
  })

  it('hands a signed-in reader their own npub and names both possibilities', () => {
    session.current = { status: 'signed-in', pubkey: 'a'.repeat(64), npub: NPUB }
    const host = render()
    expect(host.textContent).toContain('This space is not showing you anything')
    expect(host.textContent).toContain('does not exist')
    expect(host.textContent).toContain(NPUB)
  })
})
