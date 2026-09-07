import { Link } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { UserChip } from '../UserChip'

export function Topbar({ groupBase }: { groupBase: string | null }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-4">
      <Link to="/" className="text-sm font-medium text-fg">
        nostr confluence
      </Link>

      <div className="flex-1" />

      <span
        className="hidden rounded-md border border-line px-3 py-1.5 text-xs text-fg-subtle sm:block"
        title="Volltextsuche kommt in Phase 6"
      >
        Seiten durchsuchen
      </span>

      {groupBase ? (
        <Link
          to={`${groupBase}/new`}
          className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
        >
          + Erstellen
        </Link>
      ) : (
        <span
          title="Erst einen Space öffnen"
          className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg opacity-60"
        >
          + Erstellen
        </span>
      )}

      <ThemeToggle />
      <UserChip />
    </header>
  )
}
