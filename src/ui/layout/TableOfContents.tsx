import { extractHeadings } from '../../domain/toc'
import { SectionLabel } from '../controls'
import { ListTreeIcon } from '../icons'

/**
 * "On this page" — the right-hand rail. A rail of its own, full height and
 * scrolling separately, rather than a column inside the document: the trail of
 * headings is about the page but is not part of it, and pinned to the window it
 * still says where you are two screens down.
 *
 * Each entry carries a short rule at its indent level instead of leading dots.
 * At three levels of nesting the indent alone is hard to read at 12px, and a
 * rule per level is the quietest thing that makes the depth legible.
 *
 * Only shown when there is something to jump to at all — a table of contents
 * with one entry is a heading printed twice.
 */
export function TableOfContents({ markdown }: { markdown: string }) {
  const headings = extractHeadings(markdown).filter((heading) => heading.level <= 3)

  if (headings.length < 2) return null

  return (
    <nav className="hidden w-60 shrink-0 flex-col overflow-y-auto scroll-slim border-l border-line bg-surface-1 px-4 py-5 xl:flex">
      <div className="flex items-center gap-2">
        <ListTreeIcon className="size-3.5 text-fg-subtle" />
        <SectionLabel>On this page</SectionLabel>
      </div>
      <ul className="mt-3 space-y-0.5">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className="group flex items-center gap-2 rounded py-1 text-xs text-fg-muted hover:text-accent-fg"
            >
              <span
                aria-hidden="true"
                className="h-px shrink-0 bg-line-strong group-hover:bg-accent"
                style={{ width: `${heading.level * 5}px` }}
              />
              <span className="truncate">{heading.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
