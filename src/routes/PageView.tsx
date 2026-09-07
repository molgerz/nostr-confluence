import { Link, useParams } from 'react-router-dom'
import { PhaseNote } from '../ui/Phase'

export function PageView() {
  const { group, slug } = useParams<{ group: string; slug: string }>()
  const base = `/s/${encodeURIComponent(group ?? '')}/${slug ?? ''}`

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">Slug: {slug}</div>
      <h1 className="text-2xl font-medium text-fg">{slug}</h1>
      <div className="flex gap-2">
        <Link
          to={`${base}/edit`}
          className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
        >
          Bearbeiten
        </Link>
        <Link
          to={`${base}/history`}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
        >
          Historie
        </Link>
      </div>
      <PhaseNote phase="Phase 3">
        Head der Revisionskette laden, Markdown mit Sanitizing rendern, Byline mit npub.
      </PhaseNote>
    </div>
  )
}
