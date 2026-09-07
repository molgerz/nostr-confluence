import { PhaseNote } from '../ui/Phase'

export function EditorView() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-fg">Bearbeiten</h1>
      <PhaseNote phase="Phase 3">
        CodeMirror mit Markdown-Vorschau, Feld für die Änderungsnotiz (Tag summary).
      </PhaseNote>
      <PhaseNote phase="Phase 4">
        Head-Prüfung vor dem Publish, 3-Wege-Merge bei Konflikt statt stillem Überschreiben.
      </PhaseNote>
    </div>
  )
}
