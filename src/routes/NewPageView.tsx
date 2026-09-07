import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'

export function NewPageView() {
  const { group, space, base } = useSpaceRoute()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  if (!group || !base) return <p className="text-sm text-danger">Invalid address.</p>

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">new page in {group.id}</div>
      <h1 className="text-3xl font-semibold tracking-tight text-fg">Create a page</h1>
      <PageEditor
        relayUrl={group.relayUrl}
        groupId={group.id}
        defaultParentSlug={params.get('parent')}
        pages={space.pages}
        onSaved={(slug) => navigate(`${base}/${slug}`)}
        onCancel={() => navigate(base)}
      />
    </div>
  )
}
