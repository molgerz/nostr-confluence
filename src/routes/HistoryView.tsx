import { PhaseNote } from '../ui/Phase'

export function HistoryView() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-fg">Versionshistorie</h1>
      <PhaseNote phase="Phase 5">
        Zeitachse der Revisionen mit npub und Signaturprüfung, Diff zwischen beliebigen
        Versionen, Blame pro Zeile, Wiederherstellen als neue Revision.
      </PhaseNote>
    </div>
  )
}
