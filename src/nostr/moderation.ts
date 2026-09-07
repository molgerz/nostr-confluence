import { verifyEvent } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS, TAGS } from './kinds'
import type { Signer } from './signer'

/**
 * Moderations-Events nach NIP-29. Diese Events sind **Anträge** an das Relay,
 * keine Befehle: das Relay prüft, ob die Absenderin Admin ist, und lehnt sonst
 * ab. Die Mitgliederliste (39002) erzeugt danach das Relay selbst — sie wird
 * hier nie direkt geschrieben. docs/04-permissions-nip29.md
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
  if (!verifyEvent(event)) return { ok: false, reason: 'Signatur ungültig' }
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
 * Ein Event aus der Gruppe entfernen. Anders als eine NIP-09-Löschanfrage
 * setzt das Relay diese Löschung durch — sie gilt aber nur auf diesem Relay,
 * Kopien anderswo bleiben. docs/09-security-privacy.md
 */
export function deleteGroupEvent(
  signer: Signer,
  base: Base & { eventId: string },
): Promise<PublishResult> {
  return publishModeration(signer, base, KINDS.GROUP_DELETE_EVENT, [['e', base.eventId]])
}
