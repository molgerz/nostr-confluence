import { describe, expect, it } from 'vitest'
import { spaceAccess } from './space-access'
import type { GroupMetadata } from './group-state'

const META: GroupMetadata = {
  name: 'Engineering',
  about: null,
  picture: null,
  isPublic: false,
  isOpen: false,
  supportedKinds: [1818],
}

const ALICE = 'a'.repeat(64)
const STRANGER = 'b'.repeat(64)

describe('spaceAccess', () => {
  it('says nothing while the subscriptions are still settling', () => {
    // Answering early would flash "no access" at a member on every reload.
    const access = spaceAccess(ALICE, { loading: true, metadata: null, members: [] })
    expect(access.state).toBe('loading')
  })

  it('treats missing metadata as hidden, not as an empty space', () => {
    const access = spaceAccess(null, { loading: false, metadata: null, members: [] })
    expect(access).toEqual({ state: 'hidden', signedIn: false })
  })

  it('keeps hidden apart by whether anyone is signed in', () => {
    // The two need different wording: one can be resolved by signing in, the
    // other only by an admin adding the npub.
    const access = spaceAccess(STRANGER, { loading: false, metadata: null, members: [ALICE] })
    expect(access).toEqual({ state: 'hidden', signedIn: true })
  })

  it('is a reader when the space is visible but nobody is signed in', () => {
    const access = spaceAccess(null, { loading: false, metadata: META, members: [ALICE] })
    expect(access.state).toBe('reader')
  })

  it('is a reader when signed in but outside the member list', () => {
    const access = spaceAccess(STRANGER, { loading: false, metadata: META, members: [ALICE] })
    expect(access.state).toBe('reader')
  })

  it('is a member when the member list carries the viewer', () => {
    const access = spaceAccess(ALICE, { loading: false, metadata: META, members: [ALICE] })
    expect(access.state).toBe('member')
  })

  it('does not call an empty but visible space hidden', () => {
    // A member of a space with no pages yet must not be told they have no
    // access — that is the confusion this module exists to prevent.
    const access = spaceAccess(ALICE, { loading: false, metadata: META, members: [ALICE] })
    expect(access.state).not.toBe('hidden')
  })
})
