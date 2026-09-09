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
  space: { loading: boolean; metadata: GroupMetadata | null; members: string[] },
): SpaceAccess {
  if (space.loading) return { state: 'loading' }
  // Metadata is relay-signed and arrives unasked for any group the viewer may
  // see. Its absence is therefore the one reliable signal that the relay is
  // holding this space back — the page and member lists would be empty in a
  // genuinely empty space too.
  if (space.metadata === null) return { state: 'hidden', signedIn: viewer !== null }
  if (viewer !== null && space.members.includes(viewer)) return { state: 'member' }
  return { state: 'reader' }
}
