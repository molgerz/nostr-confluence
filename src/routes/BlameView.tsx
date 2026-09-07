import { Link } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { blame } from '../domain/blame'
import { shortNpub, toNpub } from '../nostr/profile'

/**
 * Who wrote which line. The attribution is computed from the revision chain,
 * so every line carries an npub.
 */
export function BlameView() {
  const { group, space, base, slug } = useSpaceRoute()

  if (!group || !base || !slug) return <p className="text-sm text-danger">Invalid address.</p>

  const page = space.pages.find((entry) => entry.slug === slug)
  if (!page) {
    return (
      <p className="text-sm text-fg-muted">{space.loading ? 'loading…' : 'Page not found.'}</p>
    )
  }

  const lines = blame(page.revisions, page.head)
  const colorOf = new Map<string, string>()
  const palette = ['text-fg-muted', 'text-accent-fg', 'text-success', 'text-warning']
  let next = 0

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">Zeilenherkunft</div>
      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      <div className="flex gap-3 text-xs">
        <Link to={`${base}/${page.slug}`} className="text-accent-fg underline">
          back to the page
        </Link>
        <Link to={`${base}/${page.slug}/history`} className="text-accent-fg underline">
          Historie
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {lines.map((line, index) => {
              const npub = toNpub(line.revision.author)
              if (!colorOf.has(line.revision.author)) {
                colorOf.set(line.revision.author, palette[next % palette.length])
                next += 1
              }
              return (
                <tr key={index} className="align-top">
                  <td
                    className={`w-32 border-r border-line px-2 py-0.5 whitespace-nowrap ${colorOf.get(line.revision.author)}`}
                    title={`${npub} · ${new Date(line.revision.createdAt * 1000).toLocaleString('de-DE')}`}
                  >
                    {shortNpub(npub)}
                  </td>
                  <td className="w-10 border-r border-line px-2 py-0.5 text-right text-fg-subtle select-none">
                    {index + 1}
                  </td>
                  <td className="px-2 py-0.5 whitespace-pre-wrap text-fg">
                    {line.text.length === 0 ? ' ' : line.text}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
