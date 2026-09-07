import { extractHeadings } from '../../domain/toc'

/**
 * "Auf dieser Seite" — rechte Leiste wie in Confluence. Wird nur angezeigt,
 * wenn es überhaupt etwas zu springen gibt.
 */
export function TableOfContents({ markdown }: { markdown: string }) {
  const headings = extractHeadings(markdown).filter((heading) => heading.level <= 3)

  if (headings.length < 2) return null

  return (
    <nav className="hidden w-44 shrink-0 border-l border-line px-3 py-6 xl:block">
      <div className="text-xs font-medium text-fg-subtle">Auf dieser Seite</div>
      <ul className="mt-2 space-y-1">
        {headings.map((heading) => (
          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 1) * 8}px` }}>
            <a href={`#${heading.id}`} className="block truncate text-xs text-fg-muted hover:text-accent-fg">
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
