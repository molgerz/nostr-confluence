import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../ThemeToggle'
import { UserChip } from '../UserChip'

/**
 * Three columns rather than a row: the two outer ones share the remaining width
 * equally, so the middle sits on the centre line of the window no matter how
 * wide the logo or the account chip happen to be. A plain flex row would push
 * search and "create" off centre as soon as one side grew — and a display name
 * or a space title is exactly the kind of thing that grows.
 */
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
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line bg-surface-1 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Show sidebar"
          className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 md:hidden"
        >
          ☰
        </button>

        <Link to="/" className="truncate text-sm font-medium text-fg">
          <span className="hidden sm:inline">nostr confluence</span>
          <span className="sm:hidden">nc</span>
        </Link>
      </div>

      {/* Search and create belong together: one finds a page, the other makes
          the one that was not found. */}
      <div className="flex items-center gap-2">
        <form
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
            placeholder={groupBase ? 'Search pages' : 'open a space first'}
            aria-label="Search pages"
            className="w-36 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-fg placeholder:text-fg-subtle disabled:opacity-60 sm:w-64 md:w-80 lg:w-96"
          />
        </form>

        {groupBase ? (
          <Link
            to={`${groupBase}/new`}
            className="shrink-0 rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg"
          >
            <span className="hidden sm:inline">+ Create</span>
            <span className="sm:hidden">+</span>
          </Link>
        ) : (
          <span
            title="Open a space first"
            className="shrink-0 rounded-md bg-accent-bg px-3 py-1.5 text-xs font-medium text-accent-fg opacity-60"
          >
            <span className="hidden sm:inline">+ Create</span>
            <span className="sm:hidden">+</span>
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>
        <UserChip />
      </div>
    </header>
  )
}
