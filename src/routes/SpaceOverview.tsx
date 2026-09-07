import { Link } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { shortNpub, toNpub } from '../nostr/profile'
import { WriteCheck } from '../ui/WriteCheck'
import { useSession } from '../session/session'
import { KINDS } from '../nostr/kinds'

export function SpaceOverview() {
  const { group, space, base } = useSpaceRoute()
  const { session } = useSession()

  if (!group || !base) return <p className="text-sm text-danger">Ungültige Gruppen-Adresse.</p>

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
                {meta.isPublic ? 'öffentlich lesbar' : 'nur für Mitglieder'}
              </span>
              <span className="rounded bg-surface-1 px-2 py-0.5 text-fg-muted">
                {meta.isOpen ? 'offen für alle' : 'Beitritt auf Einladung'}
              </span>
              {isAdmin ? (
                <span className="rounded bg-accent-bg px-2 py-0.5 font-medium text-accent-fg">
                  du bist Admin
                </span>
              ) : isMember ? (
                <span className="rounded bg-accent-bg px-2 py-0.5 font-medium text-accent-fg">
                  du bist Mitglied
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-fg-subtle">
              {space.loading ? 'lade Gruppenzustand…' : 'keine Gruppen-Metadaten gefunden'}
            </span>
          )}
        </div>
      </div>

      {revisionKindMissing ? (
        <div className="rounded-xl border border-warning bg-warning-bg p-3 text-xs">
          <div className="font-medium text-fg">Dieser Space nimmt Kind 1818 laut Relay nicht an</div>
          <p className="mt-1 text-fg-muted">
            Die Gruppen-Metadaten listen {meta?.supportedKinds.join(', ')}. Seiten zu speichern wird
            das Relay vermutlich ablehnen.
          </p>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-fg">Seiten ({space.pages.length})</h2>
          <Link
            to={`${base}/new`}
            className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
          >
            + Seite anlegen
          </Link>
        </div>
        {space.pages.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {space.loading ? 'lade Seiten…' : 'Noch keine Seiten in diesem Space.'}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {space.pages.map((page) => (
              <li key={page.slug} className="p-3">
                <Link to={`${base}/${page.slug}`} className="text-sm text-fg hover:underline">
                  {page.title}
                </Link>
                <div className="mt-0.5 text-xs text-fg-subtle">
                  {page.revisions.length} Revision{page.revisions.length === 1 ? '' : 'en'} ·{' '}
                  <span className="font-mono">{shortNpub(toNpub(page.head.author))}</span>
                  {page.leaves.length > 1 ? ' · verzweigt' : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-fg">Mitglieder ({space.members.length})</h2>
        <ul className="space-y-1 text-xs">
          {space.members.map((pubkey) => {
            const npub = toNpub(pubkey)
            const roles = space.admins.find((admin) => admin.pubkey === pubkey)?.roles ?? []
            return (
              <li key={pubkey} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-fg-muted" title={npub}>
                  {shortNpub(npub)}
                </span>
                {roles.length > 0 ? (
                  <span className="rounded bg-surface-1 px-1.5 py-0.5 text-fg-subtle">
                    {roles.join(', ')}
                  </span>
                ) : null}
              </li>
            )
          })}
          {space.members.length === 0 ? (
            <li className="text-fg-subtle">
              {space.loading ? 'lade…' : 'Das Relay meldet keine Mitgliederliste.'}
            </li>
          ) : null}
        </ul>
      </section>

      <section className="space-y-2 rounded-xl border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-fg">Schreibzugriff prüfen</h2>
        <p className="text-xs text-fg-muted">
          Signiert ein ephemeres Event (Kind 20817) mit dem h-Tag dieser Gruppe und publisht es.
          Prüft Signer, NIP-42-AUTH und Relay-Antwort, ohne etwas zu speichern.
        </p>
        <WriteCheck relayUrl={group.relayUrl} groupId={group.id} />
      </section>
    </div>
  )
}
