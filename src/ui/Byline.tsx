import { Author } from './Author'
import type { Revision } from '../domain/revision'

function relativeTime(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
  return new Date(seconds * 1000).toLocaleDateString('de-DE')
}

/**
 * Autorschaft anzeigen. Der npub ist die Identität — er steht immer dabei,
 * auch wenn später ein Anzeigename dazukommt.
 */
export function Byline({ revision }: { revision: Revision }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
      <span>zuletzt geändert</span>
      <Author pubkey={revision.author} avatar />
      <span>· {relativeTime(revision.createdAt)}</span>
      {revision.summary ? <span>· {revision.summary}</span> : null}
    </div>
  )
}
