// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { liveMarkdown } from './markdown-live'
import { NO_SETEXT_HEADINGS } from './markdown-flavour'
import { normaliseTaskMarker } from './MarkdownEditor'

/**
 * `- [<no-break space>] milk` is not a task list item — GFM asks for U+0020 —
 * so it is drawn as an ordinary bullet followed by two brackets, and nothing
 * on screen says why, because the character is invisible. Option-Space on a
 * Mac produces exactly that. src/ui/MarkdownEditor.tsx
 */
const NBSP = ' '

function type(text: string, into = '') {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    state: EditorState.create({
      doc: into,
      extensions: [markdown({ base: markdownLanguage, extensions: NO_SETEXT_HEADINGS }), normaliseTaskMarker, liveMarkdown],
    }),
    parent,
  })
  view.dispatch({ changes: { from: into.length, insert: text } })
  const doc = view.state.doc.toString()
  const boxes = view.contentDOM.querySelectorAll('input.cm-md-task').length
  view.destroy()
  return { doc, boxes }
}

describe('normaliseTaskMarker', () => {
  it('puts a plain space back into the box', () => {
    const { doc, boxes } = type(`- [${NBSP}] milk`)
    expect(doc).toBe('- [ ] milk')
    expect(boxes).toBe(1)
  })

  it('does the same for the space that separates the box from the words', () => {
    expect(type(`- [ ]${NBSP}milk`).doc).toBe('- [ ] milk')
  })

  it('fixes both at once, and any other unicode space too', () => {
    expect(type(`- [ ] milk`).doc).toBe('- [ ] milk')
  })

  it('leaves a ticked box alone', () => {
    expect(type('- [x] milk').doc).toBe('- [x] milk')
    expect(type('- [X] milk').doc).toBe('- [X] milk')
  })

  it('leaves brackets that are not a box alone — those really are brackets', () => {
    expect(type('- [y] milk').doc).toBe('- [y] milk')
    expect(type('- [] milk').doc).toBe('- [] milk')
  })

  it('works in a numbered list and behind indentation', () => {
    expect(type(`1. [${NBSP}] milk`).doc).toBe('1. [ ] milk')
    expect(type(`  - [${NBSP}] milk`).doc).toBe('  - [ ] milk')
  })

  it('leaves a line that is not a list item alone', () => {
    expect(type(`[${NBSP}] milk`).doc).toBe(`[${NBSP}] milk`)
  })

  it('fixes a line that is edited later, not only as it is typed', () => {
    // the second line is the one being touched
    const { doc } = type(`\n- [${NBSP}] milk`, 'Intro')
    expect(doc).toBe('Intro\n- [ ] milk')
  })
})
