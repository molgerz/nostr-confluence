import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, TAGS } from './kinds'
import { collectMentions } from './mentions'
import type { Signer } from './signer'

export type CommentInput = {
  relayUrl: string
  groupId: string
  slug: string
  content: string
  /** the comment being replied to */
  parentId?: string | null
  /** author of the comment being replied to — tagged so they are notified */
  parentAuthor?: string | null
}

export async function publishComment(
  signer: Signer,
  input: CommentInput,
): Promise<PublishResult> {
  const tags: string[][] = [
    [TAGS.GROUP, input.groupId],
    [TAGS.SLUG, input.slug],
    // NIP-22: K names the kind of the root object, here our page revision
    ['K', String(KINDS.PAGE_REVISION)],
    ['k', String(input.parentId ? KINDS.COMMENT : KINDS.PAGE_REVISION)],
    [TAGS.ALT, `Comment on page ${input.slug} in space ${input.groupId}`],
  ]
  if (input.parentId) tags.push(['e', input.parentId])
  // NIP-27, and the same set as on a revision: the person replied to plus
  // everybody the text mentions, each key only once.
  const people = new Set<string>(collectMentions(input.content))
  if (input.parentAuthor) people.add(input.parentAuthor)
  for (const pubkey of people) tags.push([TAGS.PUBKEY, pubkey])

  const event = await signer.signEvent({
    kind: KINDS.COMMENT,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: input.content.trim(),
  })

  if (!verifyEvent(event)) {
    return { ok: false, reason: 'the comment signature is invalid' }
  }

  return client.publish(input.relayUrl, event)
}
