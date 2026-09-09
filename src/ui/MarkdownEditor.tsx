import { useEffect, useRef } from 'react'
import { EditorState, EditorSelection, Compartment, Prec } from '@codemirror/state'
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
  placeholder as cmPlaceholder,
} from '@codemirror/view'
import type { Command } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentMore, indentLess } from '@codemirror/commands'
import { autocompletion } from '@codemirror/autocomplete'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxTree, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { useTheme } from '../theme/theme'
import { liveMarkdown } from './markdown-live'
import { emojiCompletion, mentionCompletion } from './editor-complete'

/**
 * The Markdown editor: one mode, not two.
 *
 * There is no Write/Preview switch, because there is nothing to switch — the
 * text is drawn as it will be read while it is being typed. Typing `# ` sizes
 * the line as a heading, `- ` turns into a bullet, `**bold**` goes bold. The
 * markup is only visible on the line the cursor is on, so it can still be
 * edited. `src/ui/markdown-live.ts` does the drawing; this file assembles the
 * editor and its keys.
 *
 * The colour mode is swapped through a `Compartment` rather than by rebuilding
 * the editor — otherwise cursor and undo history would be lost on every switch.
 * docs/12-theming.md, docs/13-editing.md
 */
const themeCompartment = new Compartment()

/**
 * The reading scale, as CSS. These numbers mirror `PAGE` in
 * `src/ui/Markdown.tsx`: if the two drift apart, writing and reading stop
 * looking alike, which is the one thing this editor is for.
 */
function editorTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': {
        color: 'var(--fg)',
        backgroundColor: 'transparent',
        fontSize: '17px',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-content': {
        fontFamily: 'var(--font-sans)',
        padding: '0',
        caretColor: 'var(--fg)',
        // The same measure as the rendered page — a line of text stays
        // readable, however wide the window is.
        maxWidth: '70ch',
        // A floor, not the height: the room under the text comes from the host
        // growing inside the frame's flex column, so that whatever follows the
        // editor sits at the bottom of the page. See the host div below.
        minHeight: '6rem',
      },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--fg)' },
      // highlightActiveLine() ships its own default background; override it
      // rather than just omitting a rule, or that default shows through.
      '.cm-activeLine': { backgroundColor: 'transparent' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--accent-bg)',
      },
      // The editor grows with the text instead of scrolling inside a box: a
      // page is a document, and a document does not have a 60vh window in it.
      '.cm-scroller': { overflow: 'visible', lineHeight: '1.75' },
      '.cm-placeholder': { color: 'var(--fg-subtle)' },

      // — headings —
      '.cm-md-h1': {
        fontSize: '26px',
        fontWeight: '600',
        letterSpacing: '-0.02em',
        lineHeight: '1.3',
        paddingTop: '1.4rem',
      },
      '.cm-md-h2': {
        fontSize: '21px',
        fontWeight: '600',
        letterSpacing: '-0.015em',
        lineHeight: '1.35',
        paddingTop: '1.2rem',
      },
      '.cm-md-h3': { fontSize: '18px', fontWeight: '600', lineHeight: '1.4', paddingTop: '1rem' },
      '.cm-md-h4': { fontSize: '17px', fontWeight: '600', lineHeight: '1.45', paddingTop: '0.8rem' },
      '.cm-md-h5, .cm-md-h6': {
        fontSize: '14px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--fg-muted)',
        paddingTop: '0.7rem',
      },

      // — inline —
      '.cm-md-strong': { fontWeight: '600' },
      '.cm-md-em': { fontStyle: 'italic' },
      '.cm-md-strike': { textDecoration: 'line-through', color: 'var(--fg-subtle)' },
      '.cm-md-link': { color: 'var(--accent-fg)', textDecoration: 'underline', textUnderlineOffset: '2px' },
      '.cm-md-inline-code': {
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        backgroundColor: 'var(--code-bg)',
        borderRadius: '3px',
        padding: '0.1em 0.3em',
      },
      // The markup itself, on the line being edited. Recessed, not hidden: it
      // has to be visible enough to delete and quiet enough to read past.
      '.cm-md-marker': { color: 'var(--fg-subtle)', fontWeight: '400' },

      // — blocks —
      '.cm-md-quote': {
        borderLeft: '3px solid var(--line-strong)',
        paddingLeft: '1rem',
        color: 'var(--fg-muted)',
      },
      '.cm-md-code-block': {
        fontFamily: 'var(--font-mono)',
        fontSize: '14px',
        lineHeight: '1.6',
        backgroundColor: 'var(--code-bg)',
        borderLeft: '1px solid var(--code-line)',
        borderRight: '1px solid var(--code-line)',
        padding: '0 1rem',
      },
      '.cm-md-code-first': {
        borderTop: '1px solid var(--code-line)',
        borderRadius: '8px 8px 0 0',
        paddingTop: '0.6rem',
        marginTop: '0.6rem',
      },
      '.cm-md-code-last': {
        borderBottom: '1px solid var(--code-line)',
        borderRadius: '0 0 8px 8px',
        paddingBottom: '0.6rem',
        marginBottom: '0.6rem',
      },
      '.cm-md-code-info': { color: 'var(--fg-subtle)', fontSize: '12px' },

      // — lists —
      // Hanging indent: the marker sits in the gutter the padding opens up, so
      // a wrapped line lines up under the text and not under the bullet.
      '.cm-md-item': { paddingLeft: '1.6em', textIndent: '-1.6em' },
      '.cm-md-bullet': {
        display: 'inline-block',
        width: '1ch',
        color: 'var(--fg-subtle)',
      },
      '.cm-md-number': { color: 'var(--fg-subtle)' },
      '.cm-md-task': {
        marginRight: '0.4em',
        width: '0.9em',
        height: '0.9em',
        accentColor: 'var(--accent)',
        verticalAlign: 'baseline',
        cursor: 'pointer',
      },

      // — divider —
      '.cm-md-rule': {
        display: 'inline-block',
        width: '100%',
        verticalAlign: 'middle',
        borderTop: '1px solid var(--line)',
      },
      '.cm-md-hr-raw': { color: 'var(--fg-subtle)' },

      // — mentions —
      // A chip, not a link: it names a person, and clicking it in the editor
      // should place the cursor rather than navigate.
      '.cm-md-mention': {
        backgroundColor: 'var(--accent-bg)',
        color: 'var(--accent-fg)',
        borderRadius: '4px',
        padding: '0.05em 0.3em',
        whiteSpace: 'nowrap',
        fontSize: '0.95em',
      },

      // — the @ and : dropdowns —
      // CodeMirror's default popup is styled for a code editor and stays light
      // in dark mode. It gets the app's tokens instead. docs/12-theming.md
      '.cm-tooltip.cm-tooltip-autocomplete': {
        border: '1px solid var(--line-strong)',
        borderRadius: '8px',
        backgroundColor: 'var(--surface-2)',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
      },
      '.cm-tooltip-autocomplete > ul': { maxHeight: '17em' },
      '.cm-tooltip-autocomplete > ul > li': {
        padding: '0.35em 0.6em',
        color: 'var(--fg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5em',
      },
      '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--surface-selected)',
        color: 'var(--fg)',
      },
      '.cm-completionLabel': { flex: '1 1 auto' },
      '.cm-completionDetail': {
        fontStyle: 'normal',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--fg-subtle)',
      },
    },
    { dark },
  )
}

/**
 * Colour inside fenced code blocks only. Prose is formatted by
 * `liveMarkdown`, so the structural Markdown tags are deliberately absent
 * here — a blue heading on top of a heading-sized line is two answers to the
 * same question.
 */
const codeHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.operatorKeyword], color: 'var(--accent-fg)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--success)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--warning)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--fg-subtle)', fontStyle: 'italic' },
  { tag: [tags.typeName, tags.className, tags.tagName], color: 'var(--accent)' },
  { tag: [tags.function(tags.variableName), tags.propertyName], color: 'var(--fg)' },
  { tag: [tags.variableName, tags.attributeName], color: 'var(--fg-muted)' },
])

/**
 * Wrap or unwrap the selection — Cmd-B, Cmd-I and friends. Pressing the key
 * again on already wrapped text removes the markers instead of nesting a
 * second pair, which is what every other editor does.
 */
function toggleWrap(marker: string): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const width = marker.length
        const before = view.state.sliceDoc(range.from - width, range.from)
        const after = view.state.sliceDoc(range.to, range.to + width)
        if (before === marker && after === marker) {
          return {
            changes: [
              { from: range.from - width, to: range.from },
              { from: range.to, to: range.to + width },
            ],
            range: EditorSelection.range(range.from - width, range.to - width),
          }
        }
        return {
          changes: [
            { from: range.from, insert: marker },
            { from: range.to, insert: marker },
          ],
          // With nothing selected the cursor lands between the markers, ready
          // to type the emphasised word.
          range: range.empty
            ? EditorSelection.cursor(range.from + width)
            : EditorSelection.range(range.from + width, range.to + width),
        }
      }),
    )
    return true
  }
}

function inList(view: EditorView): boolean {
  const node = syntaxTree(view.state).resolveInner(view.state.selection.main.head, -1)
  for (let parent: typeof node | null = node; parent; parent = parent.parent) {
    if (parent.name === 'ListItem') return true
  }
  return false
}

/**
 * Tab indents — but only inside a list. Everywhere else it has to keep moving
 * focus out of the editor, otherwise the page cannot be operated by keyboard
 * at all.
 */
const indentInList: Command = (view) => (inList(view) ? indentMore(view) : false)
const outdentInList: Command = (view) => (inList(view) ? indentLess(view) : false)

export type EditorHandle = {
  /** insert text at the cursor position */
  insert: (text: string) => void
}

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  /** people the `@` dropdown offers — the members of the space */
  members?: string[]
  placeholder?: string
  /** filled with a small API so attachments land at the cursor */
  handleRef?: { current: EditorHandle | null }
  /** files dropped onto the editor */
  onDropFiles?: (files: File[]) => void
}

export function MarkdownEditor({
  value,
  onChange,
  ariaLabel,
  members,
  placeholder = 'Start writing. “# ” makes a heading, “- ” a list, “@” mentions somebody.',
  handleRef,
  onDropFiles,
}: Props) {
  const host = useRef<HTMLDivElement | null>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onDropRef = useRef(onDropFiles)
  onDropRef.current = onDropFiles
  // Read through a ref, so members arriving from the relay after mount are
  // offered without rebuilding the editor.
  const membersRef = useRef(members ?? [])
  membersRef.current = members ?? []
  const { resolved } = useTheme()

  useEffect(() => {
    if (!host.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        drawSelection(),
        highlightActiveLine(),
        // Above the default keymap, so Mod-i is emphasis and not whatever the
        // default binds it to.
        Prec.high(
          keymap.of([
            { key: 'Mod-b', run: toggleWrap('**') },
            { key: 'Mod-i', run: toggleWrap('*') },
            { key: 'Mod-Shift-x', run: toggleWrap('~~') },
            { key: 'Mod-e', run: toggleWrap('`') },
            { key: 'Tab', run: indentInList },
            { key: 'Shift-Tab', run: outdentInList },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        // markdownLanguage, not the commonmark default: task lists, tables and
        // ~~strikethrough~~ are GFM, and the Enter key only continues a task
        // list if the parser knows what one is.
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          // A wiki page is Markdown, not HTML — completing `<div` would be an
          // invitation to write something the renderer strips again.
          completeHTMLTags: false,
        }),
        syntaxHighlighting(codeHighlight),
        liveMarkdown,
        autocompletion({
          override: [mentionCompletion(() => membersRef.current), emojiCompletion],
          icons: false,
          activateOnTyping: true,
        }),
        cmPlaceholder(placeholder),
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

  return (
    <div
      ref={host}
      // Takes the space left over in the frame's flex column, so the row after
      // the editor ends up flush with the bottom of a short page — the same
      // place the comment composer sits when reading. `flex-1` keeps
      // `min-height: auto`, so a document longer than the space still grows
      // the column instead of being clipped.
      // src/ui/layout/PageFrame.tsx, the `stretch` prop
      className="flex-1"
      onMouseDown={(event) => {
        // A click in the empty space below the last line puts the cursor at
        // the end, the way clicking under the last paragraph of a document
        // does. Without this the grown-out area is dead to the touch.
        if (event.target !== event.currentTarget) return
        const instance = view.current
        if (!instance) return
        event.preventDefault()
        instance.dispatch({ selection: { anchor: instance.state.doc.length } })
        instance.focus()
      }}
    />
  )
}
