import { describe, expect, it } from 'vitest'
import { parseRevision } from './revision'
import { KINDS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

function event(partial: Partial<Event>): Event {
  return {
    id: 'e1',
    pubkey: 'alice',
    created_at: 1000,
    kind: KINDS.PAGE_REVISION,
    tags: [
      ['h', 'engineering'],
      ['d', 'onboarding'],
    ],
    content: '# Onboarding',
    sig: 'sig',
    ...partial,
  } as Event
}

describe('parseRevision', () => {
  it('reads all tags', () => {
    const revision = parseRevision(
      event({
        tags: [
          ['h', 'engineering'],
          ['d', 'onboarding'],
          ['title', 'Onboarding'],
          ['page-parent', 'handbuch'],
          ['summary', 'typo'],
          ['parent-rev', 'r1'],
          ['parent-rev', 'r2'],
        ],
      }),
      'engineering',
    )
    expect(revision).toMatchObject({
      slug: 'onboarding',
      title: 'Onboarding',
      parentSlug: 'handbuch',
      summary: 'typo',
      parentRevs: ['r1', 'r2'],
    })
  })

  it('discards events from a foreign group', () => {
    // A relay could deliver foreign events — the h tag is checked, not trusted
    expect(parseRevision(event({}), 'andere-gruppe')).toBeNull()
  })

  it('discards the wrong kind', () => {
    expect(parseRevision(event({ kind: 1 }), 'engineering')).toBeNull()
  })

  it('discards events without a slug', () => {
    expect(parseRevision(event({ tags: [['h', 'engineering']] }), 'engineering')).toBeNull()
  })

  it('falls back to the slug as the title when no title tag exists', () => {
    expect(parseRevision(event({}), 'engineering')?.title).toBe('onboarding')
  })
})
