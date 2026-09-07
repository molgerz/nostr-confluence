import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { useTheme } from '../theme/theme'

/**
 * Markdown editor built on CodeMirror 6.
 *
 * The colour mode is swapped through a `Compartment` rather than by rebuilding
 * the editor — otherwise cursor and undo history would be lost on every switch.
 * docs/12-theming.md
 */
const themeCompartment = new Compartment()

function editorTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': {
        color: 'var(--fg)',
        backgroundColor: 'var(--surface-2)',
        fontSize: '13px',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius, 8px)',
      },
      '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-1px' },
      '.cm-content': {
        fontFamily: 'var(--font-mono)',
        padding: '12px',
        caretColor: 'var(--fg)',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
      '.cm-activeLine': { backgroundColor: 'var(--surface-1)' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--accent-bg)',
      },
      '.cm-scroller': { overflow: 'auto', maxHeight: '60vh', lineHeight: '1.6' },
    },
    { dark },
  )
}

export type EditorHandle = {
  /** insert text at the cursor position */
  insert: (text: string) => void
}

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  /** filled with a small API so attachments land at the cursor */
  handleRef?: { current: EditorHandle | null }
  /** files dropped onto the editor */
  onDropFiles?: (files: File[]) => void
}

export function MarkdownEditor({ value, onChange, ariaLabel, handleRef, onDropFiles }: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onDropRef = useRef(onDropFiles)
  onDropRef.current = onDropFiles
  const { resolved } = useTheme()

  useEffect(() => {
    if (!host.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
        themeCompartment.of(editorTheme(false)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          drop: (event) => {
            const files = [...(event.dataTransfer?.files ?? [])]
            if (files.length === 0 || !onDropRef.current) return false
            event.preventDefault()
            onDropRef.current(files)
            return true
          },
        }),
      ],
    })

    const instance = new EditorView({ state, parent: host.current })
    view.current = instance

    if (handleRef) {
      handleRef.current = {
        insert: (text: string) => {
          const range = instance.state.selection.main
          instance.dispatch({
            changes: { from: range.from, to: range.to, insert: text },
            selection: { anchor: range.from + text.length },
          })
          instance.focus()
        },
      }
    }

    return () => {
      instance.destroy()
      view.current = null
      if (handleRef) handleRef.current = null
    }
    // Deliberately built once: the content is synchronised below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ariaLabel])

  // Switch the colour mode without rebuilding the editor
  useEffect(() => {
    view.current?.dispatch({
      effects: themeCompartment.reconfigure(editorTheme(resolved === 'dark')),
    })
  }, [resolved])

  // Adopt changes from outside (e.g. the result of a merge) without resetting
  // the cursor on every keystroke of our own
  useEffect(() => {
    const instance = view.current
    if (!instance) return
    const current = instance.state.doc.toString()
    if (current === value) return
    instance.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    })
  }, [value])

  return <div ref={host} />
}
