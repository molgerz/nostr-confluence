import { useParams } from 'react-router-dom'
import { parseGroupAddress } from '../nostr/group-address'
import { PhaseNote } from '../ui/Phase'

export function SpaceOverview() {
  const { group: raw } = useParams<{ group: string }>()
  const group = raw ? parseGroupAddress(raw) : null

  if (!group) {
    return <p className="text-sm text-danger">Ungültige Gruppen-Adresse.</p>
  }

  return (
    <div className="space-y-4">
      <div className="font-mono text-xs text-fg-subtle">
        {group.host}&#39;{group.id}
      </div>
      <h1 className="text-2xl font-medium text-fg">{group.id}</h1>
      <PhaseNote phase="Phase 2">
        Space-Kopf aus Event 39000, Mitglieder aus 39002, Admins aus 39001.
      </PhaseNote>
      <PhaseNote phase="Phase 3">
        Seitenbaum und Markdown-Seiten aus den Revisions-Events (Kind 1818).
      </PhaseNote>
    </div>
  )
}
