import { useParams } from 'react-router-dom'
import { parseGroupAddress } from '../nostr/group-address'
import { PhaseNote } from '../ui/Phase'
import { WriteCheck } from '../ui/WriteCheck'

export function SpaceOverview() {
  const { group: raw } = useParams<{ group: string }>()
  const group = raw ? parseGroupAddress(raw) : null

  if (!group) {
    return <p className="text-sm text-danger">Ungültige Gruppen-Adresse.</p>
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="font-mono text-xs text-fg-subtle">
          {group.host}&#39;{group.id}
        </div>
        <h1 className="mt-1 text-2xl font-medium text-fg">{group.id}</h1>
      </div>

      <section className="space-y-2 rounded-xl border border-line bg-surface-1 p-4">
        <h2 className="text-sm font-medium text-fg">Schreibzugriff</h2>
        <p className="text-xs text-fg-muted">
          Signiert ein ephemeres Event (Kind 20817) mit dem h-Tag dieser Gruppe und publisht es.
          Prüft damit Signer, NIP-42-AUTH und Relay-Antwort, ohne etwas zu speichern.
        </p>
        <WriteCheck relayUrl={group.relayUrl} groupId={group.id} />
      </section>

      <PhaseNote phase="Phase 2">
        Space-Kopf aus Event 39000, Mitglieder aus 39002, Admins aus 39001.
      </PhaseNote>
      <PhaseNote phase="Phase 3">
        Seitenbaum und Markdown-Seiten aus den Revisions-Events (Kind 1818).
      </PhaseNote>
    </div>
  )
}
