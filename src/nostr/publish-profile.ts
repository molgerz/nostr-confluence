import { verifyEvent } from 'nostr-tools'
import type { Event } from 'nostr-tools'
import { client } from './client'
import type { PublishResult } from './client'
import { KINDS } from './kinds'
import { DEFAULT_RELAY_URL, PROFILE_RELAYS } from './relay-status'
import type { Signer } from './signer'

/** The three fields NIP-01 defines for kind 0. Everything else is passed through. */
export type ProfileDraft = {
  name: string
  about: string
  picture: string
}

/** The fields this editor writes. Every other key of an existing profile survives. */
export const OWNED_FIELDS: readonly (keyof ProfileDraft)[] = ['name', 'about', 'picture']

export type RelayOutcome = { url: string; result: PublishResult }

export type ProfilePublishResult = {
  /** true as soon as one relay has stored the event */
  ok: boolean
  /** the JSON that was signed — the caller updates its cache from it */
  content: string
  relays: RelayOutcome[]
  /** set when nothing was even attempted (no relay, bad signature) */
  reason?: string
}

function parseObject(content: string | null): Record<string, unknown> {
  if (!content) return {}
  try {
    const raw: unknown = JSON.parse(content)
    // An array is an object as well, but a profile is neither array nor scalar.
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return { ...(raw as Record<string, unknown>) }
  } catch {
    return {}
  }
}

/**
 * Merges a draft into the content of an existing kind 0 event.
 *
 * Kind 0 is replaceable: publishing does not extend a profile, it replaces it.
 * Serialising only the fields we know would therefore delete everything another
 * client has set — nip05, lud16, banner. So the existing object is kept and
 * only the NIP-01 fields are written. An emptied field is removed rather than
 * stored as an empty string, because "" and absent mean the same to a reader
 * and the shorter form is the honest one.
 */
export function mergeProfileContent(existingContent: string | null, draft: ProfileDraft): string {
  const merged = parseObject(existingContent)
  for (const field of OWNED_FIELDS) {
    const value = draft[field].trim()
    if (value) merged[field] = value
    else delete merged[field]
  }
  return JSON.stringify(merged)
}

/**
 * The keys of an existing profile that this editor does not touch. Shown in the
 * UI so that "I only see three fields" does not read as "the rest is gone".
 */
export function preservedFields(existingContent: string | null): string[] {
  const owned: readonly string[] = OWNED_FIELDS
  return Object.keys(parseObject(existingContent)).filter((key) => !owned.includes(key))
}

/**
 * Where kind 0 may be written. Deliberately not the space relay: a NIP-29 relay
 * demands an h tag on every event and rejects kind 0. Profiles belong to the
 * person, not to a space. docs/08-relay-setup.md
 */
export function profileWriteRelays(): string[] {
  return [...new Set(PROFILE_RELAYS)]
}

/** Reading may include the space relay — it simply returns nothing for kind 0. */
export function profileReadRelays(): string[] {
  return [...new Set([DEFAULT_RELAY_URL, ...PROFILE_RELAYS])]
}

export async function loadOwnProfileEvent(pubkey: string): Promise<Event | null> {
  return client.getOne(profileReadRelays(), { kinds: [KINDS.PROFILE], authors: [pubkey] })
}

/**
 * Signs and publishes the profile. Every relay is reported separately: with
 * several targets "saved" is not a single boolean, and the UI has to be able to
 * name which relay refused and why. docs/06-ui-information-architecture.md
 */
export async function publishProfile(
  signer: Signer,
  existingContent: string | null,
  draft: ProfileDraft,
): Promise<ProfilePublishResult> {
  const content = mergeProfileContent(existingContent, draft)
  const relays = profileWriteRelays()
  if (relays.length === 0) {
    return { ok: false, content, relays: [], reason: 'no relay configured for kind 0' }
  }

  const event = await signer.signEvent({
    kind: KINDS.PROFILE,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  })

  if (!verifyEvent(event)) {
    return { ok: false, content, relays: [], reason: 'the event signature is invalid' }
  }

  const outcomes = await Promise.all(
    relays.map(async (url) => ({ url, result: await client.publish(url, event) })),
  )
  return { ok: outcomes.some((outcome) => outcome.result.ok), content, relays: outcomes }
}
