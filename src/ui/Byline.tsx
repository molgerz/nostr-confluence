import { Author } from './Author'
import type { Revision } from '../domain/revision'

function relativeTime(seconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - seconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return new Date(seconds * 1000).toLocaleDateString()
}

/**
 * Shows authorship. The npub is the identity — it is always shown, even once a
 * display name is available.
 */
export function Byline({ revision }: { revision: Revision }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
      <span>last edited</span>
      <Author pubkey={revision.author} avatar />
      <span>· {relativeTime(revision.createdAt)}</span>
      {revision.summary ? <span>· {revision.summary}</span> : null}
    </div>
  )
}
