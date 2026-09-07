import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { UserChip } from '../UserChip'

export function Topbar({
  groupBase,
  onToggleMenu,
}: {
  groupBase: string | null
  onToggleMenu: () => void
}) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-4">
      <button
        type="button"
        onClick={onToggleMenu}
        aria-label="Seitenleiste anzeigen"
        className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 md:hidden"
      >
        ☰
      </button>

      <Link to="/" className="shrink-0 text-sm font-medium text-fg">
        <span className="hidden sm:inline">nostr confluence</span>
        <span className="sm:hidden">nc</span>
      </Link>

      <form
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault()
          if (groupBase && query.trim().length > 0) {
            navigate(`${groupBase}/search?q=${encodeURIComponent(query.trim())}`)
          }
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!groupBase}
          placeholder={groupBase ? 'Seiten durchsuchen' : 'erst einen Space öffnen'}
          aria-label="Seiten durchsuchen"
          className="w-full max-w-md rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-fg placeholder:text-fg-subtle disabled:opacity-60"
        />
      </form>

      {groupBase ? (
        <Link
          to={`${groupBase}/new`}
          className="shrink-0 rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
        >
          <span className="hidden sm:inline">+ Erstellen</span>
          <span className="sm:hidden">+</span>
        </Link>
      ) : (
        <span
          title="Erst einen Space öffnen"
          className="hidden shrink-0 rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg opacity-60 sm:inline"
        >
          + Erstellen
        </span>
      )}

      <div className="hidden sm:block">
        <ThemeToggle />
      </div>
      <UserChip />
    </header>
  )
}
