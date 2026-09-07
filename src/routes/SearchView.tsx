import { Link, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { highlightParts, searchPages } from '../domain/search'
import { shortNpub, toNpub } from '../nostr/profile'

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) =>
        part.hit ? (
          <mark key={index} className="rounded bg-accent-bg px-0.5 text-accent-fg">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

export function SearchView() {
  const { group, space, base } = useSpaceRoute()
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''

  if (!group || !base) return <p className="text-sm text-danger">Invalid address.</p>

  const hits = searchPages(space.pages, query)

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">Search in {group.id}</div>
      <h1 className="text-3xl font-semibold tracking-tight text-fg">
        {query.trim().length === 0 ? 'Search' : `“${query}”`}
      </h1>

      {query.trim().length === 0 ? (
        <p className="text-sm text-fg-muted">
          Type a search term above. Search runs locally over the loaded pages of this space —
          titles and content, and every word has to appear.
        </p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-fg-muted">
          {space.loading
            ? 'loading pages…'
            : `Nothing found in ${space.pages.length} pages.`}
        </p>
      ) : (
        <>
          <p className="text-xs text-fg-subtle">
            {hits.length} of {space.pages.length} pages
          </p>
          <ul className="space-y-3">
            {hits.map((hit) => (
              <li key={hit.page.slug} className="rounded-xl border border-line bg-surface-1 p-3">
                <Link
                  to={`${base}/${hit.page.slug}`}
                  className="text-sm font-medium text-fg hover:underline"
                >
                  <Highlighted text={hit.page.title} query={query} />
                </Link>
                <div className="mt-0.5 text-xs text-fg-subtle">
                  {hit.page.revisions.length} revision
                  {hit.page.revisions.length === 1 ? '' : 's'} ·{' '}
                  <span className="font-mono">{shortNpub(toNpub(hit.page.head.author))}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {hit.snippets.map((snippet) => (
                    <li key={snippet.line} className="flex gap-2 text-xs">
                      <span className="shrink-0 font-mono text-fg-subtle">L{snippet.line}</span>
                      <span className="text-fg-muted">
                        <Highlighted text={snippet.text} query={query} />
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
