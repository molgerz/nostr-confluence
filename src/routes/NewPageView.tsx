import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'
import { PageFrame } from '../ui/layout/PageFrame'
import { spacePeople } from '../domain/group-state'

export function NewPageView() {
  const { group, space, base } = useSpaceRoute()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  if (!group || !base) {
    return (
      <PageFrame>
        <p className="text-sm text-danger">Invalid address.</p>
      </PageFrame>
    )
  }

  const spaceName = space.metadata?.name ?? group.id
  const parent = params.get('parent')

  return (
    <PageFrame
      width="wide"
      stretch
      crumbs={[{ label: spaceName, to: base }, { label: 'New page' }]}
    >
      <PageEditor
        relayUrl={group.relayUrl}
        groupId={group.id}
        defaultParentSlug={parent}
        pages={space.pages}
        members={spacePeople(space)}
        onSaved={(slug) => navigate(`${base}/${slug}`)}
        onCancel={() => navigate(base)}
      />
    </PageFrame>
  )
}
