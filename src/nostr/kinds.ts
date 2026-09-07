/**
 * Einzige Stelle im Code, an der Nostr-Kind-Nummern und Tag-Namen stehen.
 * Komponenten importieren von hier — keine magischen Zahlen in der UI.
 * Fachliche Herleitung: docs/02-data-model-events.md
 */

export const KINDS = {
  /** NIP-01: Profil-Metadaten (Anzeigename, Avatar) für Bylines */
  PROFILE: 0,
  /** NIP-09: Löschanfrage (Bitte, keine Garantie) */
  DELETION_REQUEST: 5,
  /** NIP-42: Relay-AUTH */
  CLIENT_AUTH: 22242,

  /** NIP-22: Kommentar auf eine Seite (Phase 6) */
  COMMENT: 1111,

  /** Eigener Kind: unveränderliche Seiten-Revision. Der eigentliche Inhalt. */
  PAGE_REVISION: 1818,
  /** NIP-54: Wiki-Artikel, bei uns nur Interop-Spiegel (nie die Wahrheit) */
  PAGE_HEAD_MIRROR: 30818,

  /** NIP-29, vom Relay erzeugt */
  GROUP_METADATA: 39000,
  GROUP_ADMINS: 39001,
  GROUP_MEMBERS: 39002,
  GROUP_ROLES: 39003,

  /** NIP-29, von Nutzern gesendet */
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

/** Tag-Namen. Einbuchstabige Tags sind relay-indexiert und filterbar. */
export const TAGS = {
  /** NIP-29 Gruppen-ID. Daran prüft das Relay die Schreibberechtigung. */
  GROUP: 'h',
  /** Normalisierter Seiten-Slug (indexiert, filterbar via #d) */
  SLUG: 'd',
  /** Pubkey-Referenz (Mitglieder, Admins) */
  PUBKEY: 'p',
  TITLE: 'title',
  /** Event-ID der Vorgänger-Revision. Zwei Vorkommen = Merge-Revision. */
  PARENT_REV: 'parent-rev',
  /** sha256 über den Inhalt, erkennt No-Op-Speichern und Restores */
  CONTENT_HASH: 'content-hash',
  /** Slug der Elternseite — daraus baut die Sidebar den Baum */
  PAGE_PARENT: 'page-parent',
  /** Änderungsnotiz, entspricht der Commit-Message */
  SUMMARY: 'summary',
  /** Wiederherstellung: ID der Revision, deren Inhalt übernommen wurde */
  RESTORE_OF: 'restore-of',
  /** Inhaltstyp, bei uns immer text/markdown */
  MIME: 'm',
  /** NIP-31: Fallback-Beschreibung für fremde Clients */
  ALT: 'alt',
  /** NIP-29 Timeline-Referenzen gegen Verschweigen von Events */
  PREVIOUS: 'previous',
  /**
   * In 39000: Liste der Kinds, die die Gruppe akzeptiert.
   * Unterstrich, nicht Bindestrich — mit Bindestrich wird der Tag ignoriert.
   */
  SUPPORTED_KINDS: 'supported_kinds',
} as const

export const MIME_MARKDOWN = 'text/markdown'

/**
 * Slug-Normalisierung nach NIP-54-Vorbild: Kleinbuchstaben, Bindestriche,
 * nur a-z0-9-. Gleiche Eingabe muss auf allen Clients denselben Slug ergeben,
 * sonst zeigen zwei Nutzer auf zwei verschiedene Seiten.
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
