import { collapseContext, countChanges, diffTexts } from '../domain/diff'
import type { DiffLine } from '../domain/diff'

const LINE_STYLE: Record<DiffLine['type'], string> = {
  added: 'bg-diff-add',
  removed: 'bg-diff-del',
  context: '',
}

const PREFIX: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '−',
  context: ' ',
}

/**
 * Zeilen-Diff zweier Revisionen. Hinzufügen und Entfernen werden zusätzlich
 * durch + und − gekennzeichnet, nicht nur durch Farbe — Rot-Grün allein wäre
 * für einen Teil der Leute unlesbar. docs/12-theming.md
 */
export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = diffTexts(before, after)
  const { added, removed } = countChanges(lines)
  const rows = collapseContext(lines)

  if (added === 0 && removed === 0) {
    return <p className="text-xs text-fg-subtle">Kein Unterschied im Text.</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-fg-subtle">
        <span className="text-success">+{added}</span>{' '}
        <span className="text-danger">−{removed}</span> Zeilen
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {rows.map((row, index) =>
              row.type === 'gap' ? (
                <tr key={`gap-${index}`}>
                  <td colSpan={3} className="bg-surface-1 px-2 py-1 text-fg-subtle">
                    … {row.hidden} unveränderte Zeile{row.hidden === 1 ? '' : 'n'}
                  </td>
                </tr>
              ) : (
                <tr key={`${row.type}-${index}`} className={LINE_STYLE[row.type]}>
                  <td className="w-10 border-r border-line px-2 py-0.5 text-right text-fg-subtle select-none">
                    {row.oldNumber ?? ''}
                  </td>
                  <td className="w-10 border-r border-line px-2 py-0.5 text-right text-fg-subtle select-none">
                    {row.newNumber ?? ''}
                  </td>
                  <td className="px-2 py-0.5 whitespace-pre-wrap text-fg">
                    <span className="mr-1 text-fg-subtle select-none">{PREFIX[row.type]}</span>
                    {row.text.length === 0 ? ' ' : row.text}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
