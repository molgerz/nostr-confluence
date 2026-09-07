import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, MIME_MARKDOWN, TAGS } from './kinds'
import type { Signer } from './signer'

export type RevisionInput = {
  relayUrl: string
  groupId: string
  slug: string
  title: string
  parentSlug: string | null
  summary: string | null
  content: string
  /** Vorgänger-Revisionen: leer bei einer neuen Seite, zwei bei einem Merge */
  parentRevs: string[]
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Eine neue Revision signieren und publishen. Jede Speicherung ist ein neues,
 * unveränderliches Event — es wird nichts überschrieben.
 * docs/05-versioning-history.md
 */
export async function publishRevision(
  signer: Signer,
  input: RevisionInput,
): Promise<PublishResult> {
  const tags: string[][] = [
    [TAGS.GROUP, input.groupId],
    [TAGS.SLUG, input.slug],
    [TAGS.TITLE, input.title],
    [TAGS.MIME, MIME_MARKDOWN],
    [TAGS.CONTENT_HASH, await sha256Hex(input.content)],
    [TAGS.ALT, `Wiki-Seite "${input.title}" im Space ${input.groupId}`],
  ]
  if (input.parentSlug) tags.push([TAGS.PAGE_PARENT, input.parentSlug])
  if (input.summary) tags.push([TAGS.SUMMARY, input.summary])
  for (const parent of input.parentRevs) tags.push([TAGS.PARENT_REV, parent])

  const event = await signer.signEvent({
    kind: KINDS.PAGE_REVISION,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: input.content,
  })

  if (!verifyEvent(event)) {
    return { ok: false, reason: 'Die Signatur des Events ist ungültig' }
  }

  return client.publish(input.relayUrl, event)
}
