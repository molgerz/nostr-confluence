import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSpaceRoute } from './space-route'
import { PageEditor } from '../ui/PageEditor'
import { findCommonAncestor } from '../domain/pages'
import { mergeThreeWay } from '../domain/merge'
import { shortNpub, toNpub } from '../nostr/profile'

export function EditorView() {
  const { group, space, base, slug } = useSpaceRoute()
  const [params] = useSearchParams()
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

  // Merge-Modus: die offenen Fassungen einer verzweigten Seite zusammenführen.
  // Basis ist ihr jüngster gemeinsamer Vorfahre.
  const mergeRequested = params.get('merge') === '1'
  const mergeMode = mergeRequested && page.leaves.length > 1

  // Der Editor friert seinen Anfangsinhalt beim Mounten ein, deshalb hier auf
  // den vollständigen Ladevorgang warten. Zwei Blätter allein genügen nicht:
  // solange die gemeinsame Basis noch unterwegs ist, fände der Merge keinen
  // Vorfahren und würde alles als Konflikt melden.
  if (mergeRequested && space.loading) {
    return <p className="text-sm text-fg-muted">lade Fassungen…</p>
  }
  if (mergeRequested && !mergeMode) {
    return (
      <p className="text-sm text-fg-muted">
        Diese Seite hat nur noch eine Fassung — es gibt nichts zusammenzuführen.
      </p>
    )
  }
  let mergeContent: string | undefined
  let mergeNotice: string | undefined
  let mergeParents: string[] | undefined

  if (mergeMode) {
    const [mine, theirs] = page.leaves
    const ancestor = findCommonAncestor(page.revisions, mine, theirs)
    const merged = mergeThreeWay(ancestor?.content ?? '', mine.content, theirs.content, {
      mine: `Fassung von ${shortNpub(toNpub(mine.author))}`,
      theirs: `Fassung von ${shortNpub(toNpub(theirs.author))}`,
    })
    mergeContent = merged.content
    mergeParents = page.leaves.map((leaf) => leaf.id)
    mergeNotice =
      merged.status === 'conflict'
        ? `${page.leaves.length} Fassungen, ${merged.conflicts} überschneidende Stelle(n). ` +
          'Bitte im Text auflösen, die Marker entfernen und speichern — das Ergebnis wird eine ' +
          'Merge-Revision mit beiden Vorgängern.'
        : ancestor
          ? 'Die Fassungen liessen sich ohne Überschneidung zusammenführen. Bitte prüfen und ' +
            'speichern; das Ergebnis wird eine Merge-Revision mit beiden Vorgängern.'
          : 'Kein gemeinsamer Vorfahre gefunden — die Fassungen sind unabhängig entstanden. ' +
            'Bitte den Text von Hand zusammenstellen.'
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">{mergeMode ? 'zusammenführen' : 'bearbeiten'}</div>
      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      {mergeMode ? null : (
        <p className="text-xs text-fg-subtle">
          Speichern erzeugt eine neue Revision mit Vorgänger {page.head.id.slice(0, 8)} — nichts
          wird überschrieben.
        </p>
      )}
      <PageEditor
        // Neu aufbauen, wenn zwischen Bearbeiten und Zusammenführen gewechselt
        // wird: der Anfangsinhalt wird nur beim Mounten gelesen.
        key={mergeMode ? `merge-${page.leaves.map((leaf) => leaf.id).join('-')}` : 'edit'}
        relayUrl={group.relayUrl}
        groupId={group.id}
        page={page}
        pages={space.pages}
        initialContent={mergeContent}
        initialNotice={mergeNotice}
        overrideParents={mergeParents}
        onSaved={(saved) => navigate(`${base}/${saved}`)}
        onCancel={() => navigate(`${base}/${page.slug}`)}
      />
    </div>
  )
}
