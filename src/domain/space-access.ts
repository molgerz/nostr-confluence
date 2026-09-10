import type { GroupMetadata } from './group-state'

/**
 * What the viewer may actually see of a space.
 *
 * A private NIP-29 group does not turn a stranger away — it answers with
 * **nothing**. No error, no "forbidden", just an empty result, the group
 * metadata included: the relay log says "User is not authenticated, cannot see
 * event … kind 39000" while the client sees a perfectly normal, empty response
 * ([04](../../docs/04-permissions-nip29.md)).
 *
 * So an empty answer carries three quite different meanings, and an app that
 * does not tell them apart shows the same blank page for all three: nobody is
 * signed in and the relay could not even check; somebody is signed in who is
 * not a member; or the space really is empty.
 *
 * The absence of metadata carries that meaning only while nothing else has
 * arrived. A relay that serves the pages but not the group state is telling us
 * about its own AUTH handling, not about the viewer.
 *
 * **What cannot be told apart** is "you are not a member" from "no such space".
 * Both are silence from the relay, and no check on this side can separate them
 * — the relay deliberately does not say which it is, because saying so would
 * confirm the space exists. Wording built on `hidden` has to stay honest about
 * that instead of guessing.
 */
export type SpaceAccess =
  /** The subscriptions have not settled yet — say nothing, an answer this early is a guess. */
  | { state: 'loading' }
  /** The relay served nothing at all. Not a member, or the space does not exist. */
  | { state: 'hidden'; signedIn: boolean }
  /** The space is readable, but the viewer is not a member: reading yes, writing no. */
  | { state: 'reader' }
  /** In the member list, so writing is expected to be accepted. */
  | { state: 'member' }

export function spaceAccess(
  /** The signed-in pubkey, or `null` when nobody is signed in. */
  viewer: string | null,
  space: {
    loading: boolean
    metadata: GroupMetadata | null
    members: string[]
    /** Only the count is read: anything served is proof of access. */
    pages: unknown[]
  },
): SpaceAccess {
  if (space.loading) return { state: 'loading' }
  // Metadata is relay-signed and arrives unasked for any group the viewer may
  // see, so its absence is the signal that the relay is holding this space
  // back — the page and member lists would be empty in a genuinely empty space
  // too, which is why they cannot carry that signal themselves.
  //
  // They can refute it though. Anything the relay served is proof that it is
  // not withholding this space, and missing metadata then says something about
  // the request rather than about the viewer: ws://localhost:8081 answers the
  // group-state request from a not-yet-authenticated reader with silence while
  // rejecting the page request with `auth-required`, so pages arrive and
  // metadata does not (src/nostr/client.ts). Whatever the cause, "you cannot
  // see in" next to a sidebar full of pages is the one answer that is
  // certainly wrong.
  if (space.metadata === null && space.pages.length === 0 && space.members.length === 0) {
    return { state: 'hidden', signedIn: viewer !== null }
  }
  if (viewer !== null && space.members.includes(viewer)) return { state: 'member' }
  return { state: 'reader' }
}
