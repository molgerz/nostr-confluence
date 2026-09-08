import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'
import { PageFrame, PageTitle } from '../ui/layout/PageFrame'

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
  const under = parent
    ? (space.pages.find((page) => page.slug === parent)?.title ?? parent)
    : null

  return (
    <PageFrame
      width="wide"
      crumbs={[{ label: spaceName, to: base }, { label: 'New page' }]}
    >
      <PageTitle
        kicker={`in ${spaceName}`}
        below={
          under ? (
            <p className="text-sm text-fg-subtle">
              Filed under <span className="font-medium text-fg-muted">{under}</span> — change it
              in the field below.
            </p>
          ) : null
        }
      >
        Create a page
      </PageTitle>
      <PageEditor
        relayUrl={group.relayUrl}
        groupId={group.id}
        defaultParentSlug={parent}
        pages={space.pages}
        onSaved={(slug) => navigate(`${base}/${slug}`)}
        onCancel={() => navigate(base)}
      />
    </PageFrame>
  )
}
