import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { UserChip } from '../UserChip'

export function Topbar({ groupBase }: { groupBase: string | null }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-1 px-4">
      <Link to="/" className="text-sm font-medium text-fg">
        nostr confluence
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
