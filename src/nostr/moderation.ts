import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, TAGS } from './kinds'
import type { Signer } from './signer'

/**
 * Moderation events per NIP-29. These events are **requests** to the relay, not
 * commands: the relay checks whether the sender is an admin and rejects
 * otherwise. The member list (39002) is then produced by the relay itself — it
 * is never written directly here. docs/04-permissions-nip29.md
 */
type Base = { relayUrl: string; groupId: string }

async function publishModeration(
  signer: Signer,
  { relayUrl, groupId }: Base,
  kind: number,
  tags: string[][],
): Promise<PublishResult> {
  const event = await signer.signEvent({
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [[TAGS.GROUP, groupId], ...tags],
    content: '',
  })
  if (!verifyEvent(event)) return { ok: false, reason: 'invalid signature' }
  return client.publish(relayUrl, event)
}

export function addMember(
  signer: Signer,
  base: Base & { pubkey: string; roles?: string[] },
): Promise<PublishResult> {
  const tag = [TAGS.PUBKEY, base.pubkey, ...(base.roles ?? [])]
  return publishModeration(signer, base, KINDS.GROUP_ADD_USER, [tag])
}

export function removeMember(
  signer: Signer,
  base: Base & { pubkey: string },
): Promise<PublishResult> {
  return publishModeration(signer, base, KINDS.GROUP_REMOVE_USER, [[TAGS.PUBKEY, base.pubkey]])
}

/**
 * Removes an event from the group. Unlike a NIP-09 deletion request the relay
 * enforces this deletion — but it only applies to this relay; copies elsewhere
 * remain. docs/09-security-privacy.md
 */
export function deleteGroupEvent(
  signer: Signer,
  base: Base & { eventId: string },
): Promise<PublishResult> {
  return publishModeration(signer, base, KINDS.GROUP_DELETE_EVENT, [['e', base.eventId]])
}
