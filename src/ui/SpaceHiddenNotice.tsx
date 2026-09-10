import { Callout } from './controls'
import { SignInButton } from './SignInButton'
import { useSession } from '../session/session'
import { PageFrame, PageTitle } from './layout/PageFrame'
import type { GroupAddress } from '../nostr/group-address'

/**
 * The whole page for a space the relay is withholding, for the views that have
 * nothing else to show: the editor, the history, the line origin, a new page.
 *
 * They each used to explain the silence in their own words — "this page does
 * not exist yet", "no revisions for this slug", "page not found" — and every
 * one of those blames the slug for a question of access. An account switch
 * lands here too: the identity that just became active cannot see the space,
 * so its pages are gone from the store.
 * docs/04-permissions-nip29.md
 */
export function SpaceHiddenPage({
  group,
  base,
  crumb,
}: {
  group: GroupAddress
  base: string
  crumb: string
}) {
  return (
    <PageFrame crumbs={[{ label: group.id, to: base }, { label: crumb }]}>
      <PageTitle
        kicker={
          <span className="font-mono">
            {group.host}&#39;{group.id}
          </span>
        }
      >
        Nothing to see here
      </PageTitle>
      <SpaceHiddenNotice />
    </PageFrame>
  )
}

/**
 * What to say when the relay served nothing at all for a space.
 *
 * It says the same thing wherever it appears — the overview, a page URL
 * somebody was sent, the search — because the reader's situation is the same
 * in all three and a different wording per view would read as three different
 * problems.
 *
 * The one thing it must not do is guess. "You are not a member" and "this
 * space does not exist" are the same silence from the relay, and no check on
 * this side can separate them; the relay withholds it on purpose, because an
 * answer would already confirm the space is there. So the text names both
 * possibilities instead of picking the likelier one and being confidently
 * wrong at somebody who mistyped a group id.
 * docs/04-permissions-nip29.md
 */
export function SpaceHiddenNotice() {
  const { session } = useSession()

  if (session.status === 'signed-in') {
    return (
      <Callout tone="info" title="This space is not showing you anything">
        <p>
          The relay answered every request empty — so either you are not a member of this space,
          or it does not exist. It deliberately does not say which: answering would already
          confirm that the space is there.
        </p>
        <p className="mt-2">
          If you expect to have access, send an admin the npub you are signed in with and ask
          them to add you:
        </p>
        {/* Selectable and wrapped rather than truncated: the whole point of
            showing it is that somebody copies it into a message. */}
        <p className="mt-2 font-mono text-xs break-all text-fg">{session.npub}</p>
      </Callout>
    )
  }

  return (
    <Callout
      tone="info"
      title="This space is private"
      actions={<SignInButton>Sign in</SignInButton>}
    >
      Its content is readable by members only, and the relay checks that against the npub you
      sign in with. Without signing in there is nothing to show — not even the name of the space.
    </Callout>
  )
}
