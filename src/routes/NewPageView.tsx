import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'

export function NewPageView() {
  const { group, space, base } = useSpaceRoute()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  if (!group || !base) return <p className="text-sm text-danger">Ungültige Adresse.</p>

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">neue Seite in {group.id}</div>
      <h1 className="text-2xl font-medium text-fg">Seite anlegen</h1>
      <PageEditor
        relayUrl={group.relayUrl}
        groupId={group.id}
        defaultParentSlug={params.get('parent')}
        existingSlugs={space.pages.map((entry) => entry.slug)}
        onSaved={(slug) => navigate(`${base}/${slug}`)}
        onCancel={() => navigate(base)}
      />
    </div>
  )
}
