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

  if (!group || !base || !slug) return <p className="text-sm text-danger">Invalid address.</p>

  const page = space.pages.find((entry) => entry.slug === slug)
  if (!page) {
    return (
      <p className="text-sm text-fg-muted">
        {space.loading ? 'loading…' : 'This page does not exist yet.'}
      </p>
    )
  }

  // Merge mode: combine the open versions of a forked page. The base is
  // their most recent common ancestor.
  const mergeRequested = params.get('merge') === '1'
  const mergeMode = mergeRequested && page.leaves.length > 1

  // Der Editor friert seinen Anfangsinhalt beim Mounten ein, deshalb hier auf
  // the load to finish. Two leaves alone are not enough: while the common
  // base is still in flight the merge would find no ancestor and report
  // everything as a conflict.
  if (mergeRequested && space.loading) {
    return <p className="text-sm text-fg-muted">loading versions…</p>
  }
  if (mergeRequested && !mergeMode) {
    return (
      <p className="text-sm text-fg-muted">
        This page has only one version left — there is nothing to merge.
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
      mine: `version by ${shortNpub(toNpub(mine.author))}`,
      theirs: `version by ${shortNpub(toNpub(theirs.author))}`,
    })
    mergeContent = merged.content
    mergeParents = page.leaves.map((leaf) => leaf.id)
    mergeNotice =
      merged.status === 'conflict'
        ? `${page.leaves.length} versions, ${merged.conflicts} overlapping spot(s). ` +
          'Please resolve them in the text, remove the markers and save — the result will ' +
          'be a merge revision with both predecessors.'
        : ancestor
          ? 'The versions merged without any overlap. Please review and save; the result ' +
            'will be a merge revision with both predecessors.'
          : 'No common ancestor found — the versions came into being independently. ' +
            'Please assemble the text by hand.'
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-fg-subtle">{mergeMode ? 'merging' : 'editing'}</div>
      <h1 className="text-2xl font-medium text-fg">{page.title}</h1>
      {mergeMode ? null : (
        <p className="text-xs text-fg-subtle">
          Saving creates a new revision with predecessor {page.head.id.slice(0, 8)} — nothing
          is overwritten.
        </p>
      )}
      <PageEditor
        // Rebuild when switching between editing and merging: the initial
        // content is only read on mount.
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
