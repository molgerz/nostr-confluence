import { PageFrame, PageTitle } from '../ui/layout/PageFrame'
import { ButtonLink } from '../ui/controls'

export function NotFound() {
  return (
    <PageFrame crumbs={[{ label: 'Not found' }]}>
      <PageTitle below={<p className="text-base text-fg-muted">This address leads nowhere.</p>}>
        Not found
      </PageTitle>
      <ButtonLink to="/">Back to the space list</ButtonLink>
    </PageFrame>
  )
}
