import { collapseContext, countChanges, diffTexts, wordDiffsForPairs } from '../domain/diff'
import type { DiffLine, WordPart } from '../domain/diff'

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
 * Highlights the changed word inside a replaced line. Without it you have to
 * compare two nearly identical lines by eye.
 */
function LineText({ text, parts }: { text: string; parts?: WordPart[] }) {
  if (!parts || parts.length === 0) return <>{text.length === 0 ? ' ' : text}</>
  return (
    <>
      {parts.map((part, index) =>
        part.kind === 'same' ? (
          <span key={index}>{part.text}</span>
        ) : (
          <span
            key={index}
            className={`rounded-sm ${part.kind === 'added' ? 'bg-diff-word-add' : 'bg-diff-word-del'}`}
          >
            {part.text}
          </span>
        ),
      )}
    </>
  )
}

/**
 * Line diff of two revisions. Additions and removals are marked with + and −
 * as well, not by colour alone — red/green on its own would be unreadable for
 * some people. docs/12-theming.md
 */
export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = diffTexts(before, after)
  const { added, removed } = countChanges(lines)
  const wordDiffs = wordDiffsForPairs(lines)
  // collapseContext drops lines, so attach the word markers to the line up
  // front instead of looking them up by index later
  const rows = collapseContext(lines.map((line, index) => ({ ...line, index })))

  if (added === 0 && removed === 0) {
    return <p className="text-xs text-fg-subtle">No difference in the text.</p>
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-fg-subtle">
        <span className="text-success">+{added}</span>{' '}
        <span className="text-danger">−{removed}</span> lines
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {rows.map((row, index) =>
              row.type === 'gap' ? (
                <tr key={`gap-${index}`}>
                  <td colSpan={3} className="bg-surface-1 px-2 py-1 text-fg-subtle">
                    … {row.hidden} unchanged line{row.hidden === 1 ? '' : 's'}
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
                    <LineText text={row.text} parts={wordDiffs.get(row.index)} />
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
