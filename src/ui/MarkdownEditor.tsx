import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { useTheme } from '../theme/theme'

/**
 * Markdown-Editor auf CodeMirror 6.
 *
 * Der Farbmodus wird über ein `Compartment` umkonfiguriert und nicht durch
 * Neuaufbau des Editors — sonst gingen Cursor und Undo-Historie beim
 * Umschalten verloren. docs/12-theming.md
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
  /** Text an der Cursorposition einfügen */
  insert: (text: string) => void
}

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  /** wird mit einer kleinen API befüllt, damit Anhänge am Cursor landen */
  handleRef?: { current: EditorHandle | null }
  /** Dateien, die in den Editor gezogen wurden */
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
    // Absichtlich nur einmal aufbauen: der Inhalt wird unten synchronisiert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ariaLabel])

  // Farbmodus umschalten, ohne den Editor neu aufzubauen
  useEffect(() => {
    view.current?.dispatch({
      effects: themeCompartment.reconfigure(editorTheme(resolved === 'dark')),
    })
  }, [resolved])

  // Änderungen von aussen übernehmen (z. B. Ergebnis eines Merges), ohne den
  // Cursor bei jeder eigenen Eingabe zurückzusetzen
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
