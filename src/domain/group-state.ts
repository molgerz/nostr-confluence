import { KINDS } from '../nostr/kinds'
import type { Event } from 'nostr-tools'

/**
 * Group state produced by the relay (39000/39001/39002). These events are
 * signed by the relay, not by users — a basis for display, not proof.
 * docs/04-permissions-nip29.md
 */
export type GroupMetadata = {
  name: string
  about: string | null
  picture: string | null
  /** without a private tag the content is publicly readable */
  isPublic: boolean
  /** without a closed tag anyone may join */
  isOpen: boolean
  /** kinds the group accepts according to the relay. Empty = unspecified */
  supportedKinds: number[]
}

export type Admin = { pubkey: string; roles: string[] }

function hasTag(event: Event, name: string): boolean {
  return event.tags.some((tag) => tag[0] === name)
}

function tagValue(event: Event, name: string): string | null {
  const tag = event.tags.find((entry) => entry[0] === name)
  return tag && typeof tag[1] === 'string' && tag[1].length > 0 ? tag[1] : null
}

export function parseGroupMetadata(event: Event, groupId: string): GroupMetadata {
  const kinds = event.tags.find((tag) => tag[0] === 'supported_kinds')
  return {
    name: tagValue(event, 'name') ?? groupId,
    about: tagValue(event, 'about'),
    picture: tagValue(event, 'picture'),
    isPublic: !hasTag(event, 'private'),
    isOpen: !hasTag(event, 'closed'),
    supportedKinds: kinds
      ? kinds
          .slice(1)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value))
      : [],
  }
}

export function parseAdmins(event: Event): Admin[] {
  return event.tags
    .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string')
    .map((tag) => ({ pubkey: tag[1], roles: tag.slice(2) }))
}

export function parseMembers(event: Event): string[] {
  return event.tags
    .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string')
    .map((tag) => tag[1])
}

export const GROUP_STATE_KINDS = [
  KINDS.GROUP_METADATA,
  KINDS.GROUP_ADMINS,
  KINDS.GROUP_MEMBERS,
] as const
