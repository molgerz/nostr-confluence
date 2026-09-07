/**
 * The only place in the code that holds Nostr kind numbers and tag names.
 * Components import from here — no magic numbers in the UI.
 * The reasoning behind them: docs/02-data-model-events.md
 */

export const KINDS = {
  /** NIP-01: profile metadata (display name, avatar) for bylines */
  PROFILE: 0,
  /** NIP-09: deletion request (a plea, not a guarantee) */
  DELETION_REQUEST: 5,
  /** NIP-42: Relay-AUTH */
  CLIENT_AUTH: 22242,
  /** Blossom BUD-01: authorises a file upload; not a relay event */
  BLOSSOM_AUTH: 24242,

  /** NIP-22: comment on a page */
  COMMENT: 1111,

  /**
   * Ephemeral (20000-29999), not stored by relays. Only used to answer "may I
   * write here?" without leaving traces.
   */
  DIAGNOSTIC_PING: 20817,

  /** Our own kind: an immutable page revision. The actual content. */
  PAGE_REVISION: 1818,
  /** NIP-54: wiki article, here only an interop mirror (never the truth) */
  PAGE_HEAD_MIRROR: 30818,

  /** NIP-29, produced by the relay */
  GROUP_METADATA: 39000,
  GROUP_ADMINS: 39001,
  GROUP_MEMBERS: 39002,
  GROUP_ROLES: 39003,

  /** NIP-29, sent by users */
  GROUP_ADD_USER: 9000,
  GROUP_REMOVE_USER: 9001,
  GROUP_EDIT_METADATA: 9002,
  GROUP_DELETE_EVENT: 9005,
  GROUP_SET_ROLES: 9006,
  GROUP_CREATE: 9007,
  GROUP_DELETE: 9008,
  GROUP_CREATE_INVITE: 9009,
  GROUP_JOIN_REQUEST: 9021,
  GROUP_LEAVE_REQUEST: 9022,
} as const

export type Kind = (typeof KINDS)[keyof typeof KINDS]

/** Tag names. Single-letter tags are relay-indexed and filterable. */
export const TAGS = {
  /** NIP-29 group id. The relay checks write permission against this. */
  GROUP: 'h',
  /** Normalised page slug (indexed, filterable via #d) */
  SLUG: 'd',
  /** Pubkey reference (members, admins) */
  PUBKEY: 'p',
  TITLE: 'title',
  /** Event id of the preceding revision. Two of them = a merge revision. */
  PARENT_REV: 'parent-rev',
  /** sha256 of the content; detects no-op saves and restores */
  CONTENT_HASH: 'content-hash',
  /** Slug of the parent page — the sidebar builds its tree from it */
  PAGE_PARENT: 'page-parent',
  /** Change note, the equivalent of a commit message */
  SUMMARY: 'summary',
  /** Restore: id of the revision whose content was taken over */
  RESTORE_OF: 'restore-of',
  /** Content type, always text/markdown here */
  MIME: 'm',
  /** NIP-31: fallback description for foreign clients */
  ALT: 'alt',
  /** NIP-29 timeline references, against relays withholding events */
  PREVIOUS: 'previous',
  /**
   * In 39000: the list of kinds the group accepts.
   * Underscore, not hyphen — with a hyphen the tag is ignored.
   */
  SUPPORTED_KINDS: 'supported_kinds',
} as const

export const MIME_MARKDOWN = 'text/markdown'

/**
 * Slug normalisation modelled on NIP-54: lowercase, hyphens, only a-z0-9-.
 * The same input has to produce the same slug on every client, otherwise two
 * users end up pointing at two different pages.
 */
export function normalizeSlug(input: string): string {
  return input
    .replace(/ä/g, 'ae')
    .replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe')
    .replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}
