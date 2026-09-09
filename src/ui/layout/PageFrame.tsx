import { Link } from 'react-router-dom'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type Crumb = { label: string; to?: string; icon?: ReactNode }

/**
 * The trail above a page. Every step but the last is a link; the last one is
 * the page you are on and is plain text, because a link to here is a link that
 * does nothing.
 *
 * It truncates from the middle steps rather than the ends: the space you are
 * in and the page you are reading are the two you need, and a long chain of
 * ancestors squeezing both of them out is worse than a gap.
 *
 * Below 640px only the last step survives. A four-step trail in 375px gave
 * every title about six pixels, so the whole bar rendered as a row of page
 * icons with slashes between them — a trail that says nothing is worse than no
 * trail, and the left bar is one tap away on a phone anyway.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const shown =
    items.length > 4 ? [items[0], { label: '…' }, ...items.slice(-2)] : items

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {shown.map((crumb, index) => (
        <span
          key={`${crumb.label}-${index}`}
          className={`min-w-0 items-center gap-1 ${
            index === shown.length - 1 ? 'flex' : 'hidden sm:flex'
          }`}
        >
          {index > 0 ? (
            <span aria-hidden="true" className="hidden px-0.5 text-fg-subtle sm:inline">
              /
            </span>
          ) : null}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-fg-muted hover:bg-surface-hover hover:text-fg"
            >
              {crumb.icon}
              <span className="truncate">{crumb.label}</span>
            </Link>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 px-1 py-0.5 text-fg">
              {crumb.icon}
              <span className="truncate">{crumb.label}</span>
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

/**
 * Every view sits in this frame: a thin bar carrying the trail on the left and
 * the page's own actions on the right, then the content in a column of its own.
 *
 * The bar is **sticky** and belongs to the content area, not to the top bar.
 * Two reasons. It scrolls with nothing — where you are and what you can do here
 * stay reachable at the bottom of a long page. And it keeps the *global* bar
 * global: the search and the account do not change when you navigate, while
 * "Edit" and "History" mean nothing outside a page. Mixing the two is what
 * makes a top bar grow until it has to be redesigned.
 *
 * `width` is the only knob. A page is read line by line and gets a narrow
 * column ('doc'); a list of pages or revisions is scanned in two dimensions and
 * suffocates in one that narrow ('wide').
 * docs/06-ui-information-architecture.md
 */
const HeaderActionsTarget = createContext<HTMLDivElement | null>(null)

/**
 * Portals its children into the frame's own header bar, right of the
 * breadcrumb — so content nested deep in the page (an editor's Publish
 * button) can sit in the sticky bar above it instead of trailing at the
 * bottom of a long form. Renders nothing outside a `PageFrame`.
 */
export function HeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(HeaderActionsTarget)
  if (!target) return null
  return createPortal(children, target)
}

export function PageFrame({
  crumbs,
  actions,
  width = 'doc',
  children,
}: {
  crumbs?: Crumb[]
  actions?: ReactNode
  width?: 'doc' | 'wide'
  children: ReactNode
}) {
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null)

  return (
    <div className="flex min-h-full flex-col">
      {crumbs || actions ? (
        // The bar is translucent so text scrolling under it is blurred away
        // rather than cut off — with an opaque strip a heading disappears
        // abruptly on the pixel it reaches the edge.
        <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-2/85 px-4 backdrop-blur-sm sm:px-6">
          <div className="min-w-0 flex-1">{crumbs ? <Breadcrumbs items={crumbs} /> : null}</div>
          <div ref={setActionsEl} className="flex shrink-0 items-center gap-1.5">
            {actions}
          </div>
        </div>
      ) : null}

      <HeaderActionsTarget.Provider value={actionsEl}>
        <div
          className={`mx-auto w-full flex-1 px-5 pt-8 pb-24 sm:px-8 ${
            width === 'doc' ? 'max-w-3xl' : 'max-w-4xl'
          }`}
        >
          {children}
        </div>
      </HeaderActionsTarget.Provider>
    </div>
  )
}

/**
 * The title block of a view: an optional kicker, the title itself, and
 * whatever belongs directly under it (a byline, a subtitle).
 *
 * 30px semibold with tight tracking. A document's title is the largest thing
 * on the screen by a clear margin — if it is only two steps above the body the
 * page reads as a section of something else.
 */
export function PageTitle({
  kicker,
  children,
  below,
}: {
  kicker?: ReactNode
  children: ReactNode
  below?: ReactNode
}) {
  return (
    <header className="mb-6">
      {kicker ? <div className="mb-1.5 text-xs text-fg-subtle">{kicker}</div> : null}
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg">
        {children}
      </h1>
      {below ? <div className="mt-2.5">{below}</div> : null}
    </header>
  )
}
