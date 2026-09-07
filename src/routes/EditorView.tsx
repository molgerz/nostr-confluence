import { useNavigate } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'

export function EditorView() {
  const { group, space, base, slug } = useSpaceRoute()
  const navigate = useNavigate()

  if (!group || !base || !slug) return <p className="text-sm text-danger">Ungültige Adresse.</p>

  const page = space.pages.find((entry) => entry.slug === slug)
  if (!page) {
    return (
      <p className="text-sm text-fg-muted">
        {space.loading ? 'lade…' : 'Diese Seite gibt es noch nicht.'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">bearbeiten</div>
      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      <p className="text-xs text-fg-subtle">
        Speichern erzeugt eine neue Revision mit Vorgänger {page.head.id.slice(0, 8)} — nichts wird
        überschrieben.
      </p>
      <PageEditor
        relayUrl={group.relayUrl}
        groupId={group.id}
        page={page}
        existingSlugs={space.pages.map((entry) => entry.slug)}
        onSaved={(saved) => navigate(`${base}/${saved}`)}
        onCancel={() => navigate(`${base}/${page.slug}`)}
      />
    </div>
  )
}
