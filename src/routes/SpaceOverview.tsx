import { Link } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { Author } from '../ui/Author'
import { WriteCheck } from '../ui/WriteCheck'
import { MemberAdmin } from '../ui/MemberAdmin'
import { useSession } from '../session/session'
import { KINDS } from '../nostr/kinds'

export function SpaceOverview() {
  const { group, space, base } = useSpaceRoute()
  const { session } = useSession()

  if (!group || !base) return <p className="text-sm text-danger">Invalid group address.</p>

  const meta = space.metadata
  const isMember = session.status === 'signed-in' && space.members.includes(session.pubkey)
  const isAdmin =
    session.status === 'signed-in' &&
    space.admins.some((admin) => admin.pubkey === session.pubkey)
  const revisionKindMissing =
    meta !== null && meta.supportedKinds.length > 0 && !meta.supportedKinds.includes(KINDS.PAGE_REVISION)

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs text-fg-subtle">
          {group.host}&#39;{group.id}
        </div>
        <h1 className="mt-1 text-2xl font-medium text-fg">{meta?.name ?? group.id}</h1>
        {meta?.about ? <p className="mt-1 text-sm text-fg-muted">{meta.about}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {meta ? (
            <>
              <span className="rounded bg-surface-1 px-2 py-0.5 text-fg-muted">
                {meta.isPublic ? 'publicly readable' : 'members only'}
              </span>
              <span className="rounded bg-surface-1 px-2 py-0.5 text-fg-muted">
                {meta.isOpen ? 'open to everyone' : 'joining by invitation'}
              </span>
              {isAdmin ? (
                <span className="rounded bg-accent-bg px-2 py-0.5 font-medium text-accent-fg">
                  you are an admin
                </span>
              ) : isMember ? (
                <span className="rounded bg-accent-bg px-2 py-0.5 font-medium text-accent-fg">
                  you are a member
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-fg-subtle">
              {space.loading ? 'loading group state…' : 'no group metadata found'}
            </span>
          )}
        </div>
      </div>

      {revisionKindMissing ? (
        <div className="rounded-xl border border-warning bg-warning-bg p-3 text-xs">
          <div className="font-medium text-fg">
            According to the relay this space does not accept kind 1818
          </div>
          <p className="mt-1 text-fg-muted">
            The group metadata lists {meta?.supportedKinds.join(', ')}. Saving pages will most
            likely be rejected by the relay.
          </p>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-fg">Pages ({space.pages.length})</h2>
          <Link
            to={`${base}/new`}
            className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
          >
            + New page
          </Link>
        </div>
        {space.pages.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {space.loading ? 'loading pages…' : 'No pages in this space yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {space.pages.map((page) => (
              <li key={page.slug} className="p-3">
                <Link to={`${base}/${page.slug}`} className="text-sm text-fg hover:underline">
                  {page.title}
                </Link>
                <div className="mt-0.5 text-xs text-fg-subtle">
                  {page.revisions.length} revision{page.revisions.length === 1 ? '' : 's'} ·{' '}
                  <Author pubkey={page.head.author} />
                  {page.leaves.length > 1 ? ' · forked' : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MemberAdmin
        relayUrl={group.relayUrl}
        groupId={group.id}
        members={space.members}
        admins={space.admins}
        loading={space.loading}
      />

      <section className="space-y-2 rounded-xl border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-fg">Check write access</h2>
        <p className="text-xs text-fg-muted">
          Signs an ephemeral event (kind 20817) carrying this group's h tag and publishes it.
          Exercises signer, NIP-42 AUTH and the relay's answer without storing anything.
        </p>
        <WriteCheck relayUrl={group.relayUrl} groupId={group.id} />
      </section>
    </div>
  )
}
