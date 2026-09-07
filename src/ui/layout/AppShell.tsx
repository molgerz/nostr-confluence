import { Outlet, useParams } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { parseGroupAddress } from '../../nostr/group-address'
import { DEFAULT_RELAY_URL, useRelay } from '../../nostr/relay-status'

export function AppShell() {
  const params = useParams<{ group?: string }>()
  const group = params.group ? parseGroupAddress(params.group) : null
  const relayUrl = group?.relayUrl ?? DEFAULT_RELAY_URL
  const { snapshot, info } = useRelay(relayUrl)

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <Topbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar group={group} snapshot={snapshot} info={info} />
        <main className="min-w-0 flex-1 overflow-auto bg-surface-2">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <Outlet />
          </div>
        </main>
        <aside className="hidden w-40 shrink-0 border-l border-line px-3 py-6 lg:block">
          <div className="text-xs font-medium text-fg-subtle">Auf dieser Seite</div>
          <div className="mt-2 text-xs text-fg-subtle">Inhaltsverzeichnis ab Phase 3</div>
        </aside>
      </div>
    </div>
  )
}
