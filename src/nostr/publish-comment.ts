import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, TAGS } from './kinds'
import type { Signer } from './signer'

export type CommentInput = {
  relayUrl: string
  groupId: string
  slug: string
  content: string
  /** the comment being replied to */
  parentId?: string | null
  /** author of the comment being replied to — for mentions later */
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
  if (input.parentAuthor) tags.push([TAGS.PUBKEY, input.parentAuthor])

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
