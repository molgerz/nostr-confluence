import { Link } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'

export function Topbar() {
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

      <button
        type="button"
        disabled
        title="Seiten anlegen kommt in Phase 3"
        className="rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg opacity-60"
      >
        + Erstellen
      </button>

      <ThemeToggle />

      <Link
        to="/login"
        className="rounded-md border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
      >
        Anmelden
      </Link>
    </header>
  )
}
