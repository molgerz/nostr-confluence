import { Outlet, useParams } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { parseGroupAddress } from '../../nostr/group-address'
import { DEFAULT_RELAY_URL, useRelay } from '../../nostr/relay-status'
import { useSpace } from '../../nostr/space-store'

export function AppShell() {
  const params = useParams<{ group?: string }>()
  const group = params.group ? parseGroupAddress(params.group) : null
  const relayUrl = group?.relayUrl ?? DEFAULT_RELAY_URL
  const { snapshot, info } = useRelay(relayUrl)
  const space = useSpace(relayUrl, group?.id ?? '')

  return (
    <div className="flex h-full flex-col bg-surface-0">
      <Topbar groupBase={group ? `/s/${encodeURIComponent(`${group.host}'${group.id}`)}` : null} />
      <div className="flex min-h-0 flex-1">
        <Sidebar group={group} space={space} snapshot={snapshot} info={info} />
        <main className="min-w-0 flex-1 overflow-auto bg-surface-2">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
