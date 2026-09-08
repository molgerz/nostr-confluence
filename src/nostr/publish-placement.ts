import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, TAGS } from './kinds'
import type { Signer } from './signer'

export type PlacementInput = {
  relayUrl: string
  groupId: string
  slug: string
  /** the parent page, null = top level */
  parentSlug: string | null
  /** position among the siblings, null = ordered by title */
  order: string | null
}

/**
 * Publish where a page hangs in the tree. Addressable on `(pubkey, 31818,
 * slug)`, so moving the same page again replaces this event instead of adding
 * to the page's history — a move is not an edit.
 * docs/02-data-model-events.md
 */
export async function publishPlacement(
  signer: Signer,
  input: PlacementInput,
): Promise<PublishResult> {
  const tags: string[][] = [
    [TAGS.GROUP, input.groupId],
    [TAGS.SLUG, input.slug],
    [
      TAGS.ALT,
      input.parentSlug
        ? `Position of wiki page "${input.slug}" below "${input.parentSlug}"`
        : `Position of wiki page "${input.slug}" at the top level`,
    ],
  ]
  // Absent rather than empty when there is none: an empty tag would be a
  // third state to reason about.
  if (input.parentSlug) tags.push([TAGS.PAGE_PARENT, input.parentSlug])
  if (input.order) tags.push([TAGS.PAGE_ORDER, input.order])

  const event = await signer.signEvent({
    kind: KINDS.PAGE_PLACEMENT,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  })

  if (!verifyEvent(event)) {
    return { ok: false, reason: 'the event signature is invalid' }
  }

  return client.publish(input.relayUrl, event)
}
