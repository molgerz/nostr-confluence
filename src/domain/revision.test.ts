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
  it('liest Tags vollständig aus', () => {
    const revision = parseRevision(
      event({
        tags: [
          ['h', 'engineering'],
          ['d', 'onboarding'],
          ['title', 'Onboarding'],
          ['page-parent', 'handbuch'],
          ['summary', 'Tippfehler'],
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
      summary: 'Tippfehler',
      parentRevs: ['r1', 'r2'],
    })
  })

  it('verwirft Events einer fremden Gruppe', () => {
    // Ein Relay könnte Fremdes mitliefern — der h-Tag wird geprüft, nicht geglaubt
    expect(parseRevision(event({}), 'andere-gruppe')).toBeNull()
  })

  it('verwirft den falschen Kind', () => {
    expect(parseRevision(event({ kind: 1 }), 'engineering')).toBeNull()
  })

  it('verwirft Events ohne Slug', () => {
    expect(parseRevision(event({ tags: [['h', 'engineering']] }), 'engineering')).toBeNull()
  })

  it('nimmt den Slug als Titel, wenn kein Titel-Tag da ist', () => {
    expect(parseRevision(event({}), 'engineering')?.title).toBe('onboarding')
  })
})
