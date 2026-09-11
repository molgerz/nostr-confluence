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

/**
 * `9007`: create a group. No tags beyond the `h` id — the relay decides who
 * may do this and creates the group as `private` + `closed` by default.
 * docs/04-permissions-nip29.md
 */
export function createGroup(signer: Signer, base: Base): Promise<PublishResult> {
  return publishModeration(signer, base, KINDS.GROUP_CREATE, [])
}

/**
 * The relay's own indexing of a just-created group's `39000` lags its `OK` for
 * the `9007` — measured on 2026-09-11: an `edit-metadata` sent right after
 * `create-group` is accepted (`OK true`) but the group then has no queryable
 * state at all, as if the create had never landed. Waiting for `39000` to
 * become readable first avoids the race. Only relevant right after creating a
 * group — an established one has long since settled.
 */
async function waitForGroupMetadata(
  relayUrl: string,
  groupId: string,
  timeoutMs = 4000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const event = await client.getOne([relayUrl], {
      kinds: [KINDS.GROUP_METADATA],
      '#d': [groupId],
    })
    if (event) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

/**
 * `9007`: create a group, then wait for the relay to actually make it
 * queryable. Combines both steps because sending `9002` before the group has
 * settled loses its state entirely — see `waitForGroupMetadata`.
 */
export async function createGroupAndWait(
  signer: Signer,
  base: Base,
): Promise<PublishResult> {
  const created = await createGroup(signer, base)
  if (!created.ok) return created
  const settled = await waitForGroupMetadata(base.relayUrl, base.groupId)
  if (!settled) {
    return { ok: false, reason: 'the relay accepted the group but never made it readable' }
  }
  return created
}

/**
 * `9002`: replace the group's metadata. `apply_tags` on the relay is
 * additive, so every flag that should hold has to be sent explicitly —
 * leaving one out silently opens that dimension. docs/04-permissions-nip29.md
 */
export function editMetadata(
  signer: Signer,
  base: Base & { name: string; about?: string; supportedKinds?: number[] },
): Promise<PublishResult> {
  const tags: string[][] = [
    ['name', base.name],
    ...(base.about ? [['about', base.about]] : []),
    // Requirement 4: the space is invite-only. docs/04-permissions-nip29.md
    ['private', ''],
    ['closed', ''],
    ['restricted', ''],
    // One array element per kind, not a joined string: `parseGroupMetadata`
    // (src/domain/group-state.ts) reads every element after the tag name, and
    // a semicolon-joined single value would parseInt down to just the first
    // number.
    ...(base.supportedKinds && base.supportedKinds.length > 0
      ? [[TAGS.SUPPORTED_KINDS, ...base.supportedKinds.map(String)]]
      : []),
  ]
  return publishModeration(signer, base, KINDS.GROUP_EDIT_METADATA, tags)
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
