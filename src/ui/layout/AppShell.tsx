import { useEffect, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { TableOfContents } from './TableOfContents'
import { TocProvider, useTocMarkdown } from './toc-context'
import { parseGroupAddress } from '../../nostr/group-address'
import { DEFAULT_RELAY_URL, useRelay } from '../../nostr/relay-status'
import { useSpace } from '../../nostr/space-store'

export function AppShell() {
  return (
    <TocProvider>
      <Shell />
    </TocProvider>
  )
}

function Shell() {
  const params = useParams<{ group?: string }>()
  const location = useLocation()
  const group = params.group ? parseGroupAddress(params.group) : null
  const relayUrl = group?.relayUrl ?? DEFAULT_RELAY_URL
  const { snapshot, info } = useRelay(relayUrl)
  const space = useSpace(relayUrl, group?.id ?? '')
  const tocMarkdown = useTocMarkdown()
  const [menuOpen, setMenuOpen] = useState(false)

  // On a phone the bar should not stay open after navigating
  useEffect(() => setMenuOpen(false), [location.pathname])

  const base = group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <Topbar groupBase={base} onToggleMenu={() => setMenuOpen((open) => !open)} />

      <div className="relative flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <Sidebar group={group} space={space} snapshot={snapshot} info={info} />
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-20 bg-black/40 md:hidden"
            />
            <div className="fixed inset-y-0 left-0 z-30 flex md:hidden">
              <Sidebar
                group={group}
                space={space}
                snapshot={snapshot}
                info={info}
                alwaysExpanded
              />
            </div>
          </>
        ) : null}

        <main className="min-w-0 flex-1 overflow-auto bg-surface-2">
          <div className="mx-auto flex w-full max-w-5xl gap-6 px-4 py-6 sm:px-6">
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
            <TableOfContents markdown={tocMarkdown} />
          </div>
        </main>
      </div>
    </div>
  )
}
