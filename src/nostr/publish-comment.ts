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
  /** Kommentar, auf den geantwortet wird */
  parentId?: string | null
  /** Autor des Kommentars, auf den geantwortet wird — für spätere Erwähnungen */
  parentAuthor?: string | null
}

export async function publishComment(
  signer: Signer,
  input: CommentInput,
): Promise<PublishResult> {
  const tags: string[][] = [
    [TAGS.GROUP, input.groupId],
    [TAGS.SLUG, input.slug],
    // NIP-22: K nennt die Art des Wurzelobjekts, hier unsere Seiten-Revision
    ['K', String(KINDS.PAGE_REVISION)],
    ['k', String(input.parentId ? KINDS.COMMENT : KINDS.PAGE_REVISION)],
    [TAGS.ALT, `Kommentar zur Seite ${input.slug} im Space ${input.groupId}`],
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
    return { ok: false, reason: 'Die Signatur des Kommentars ist ungültig' }
  }

  return client.publish(input.relayUrl, event)
}
