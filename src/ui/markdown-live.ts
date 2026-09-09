import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { EditorState, Range } from '@codemirror/state'
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { findMentions } from '../nostr/mentions'
import { observeProfile } from '../nostr/profile-store'
import { shortNpub, toNpub } from '../nostr/profile'

/**
 * Live formatting for the Markdown editor: what you type is drawn the way it
 * will be read.
 *
 * The document stays plain Markdown — that is not negotiable, because a
 * revision, a diff, blame and the three-way merge all work on the text itself
 * (`src/domain/`). So this is not a rich-text editor with a Markdown
 * serialiser; it is the source, decorated. Typing `# ` turns the line into a
 * heading on the spot, and the `#` is only shown while the cursor is on that
 * line.
 *
 * **Reveal is per line, not per node.** The line you are editing shows its
 * markup, every other line shows the result. That is one rule a reader can
 * hold in their head, instead of "the markers of the construct my cursor
 * happens to be inside".
 *
 * The sizes below mirror the `PAGE` scale in `src/ui/Markdown.tsx` — when one
 * of the two changes, the other has to follow, or write and read mode drift
 * apart, which is the whole point of this file.
 * docs/13-editing.md
 */

/**
 * No mention chip is drawn inside these. Code, because a mention in a code
 * sample is a quoted key and not a person. `URL`, because a link target is
 * already being hidden as markup — two replacements over the same stretch of
 * text is one too many, and `[Alice](nostr:npub1…)` reads perfectly well as
 * the link it is.
 */
const NO_MENTION = new Set([
  'InlineCode',
  'CodeText',
  'FencedCode',
  'CodeBlock',
  'HTMLBlock',
  'URL',
])

const HEADING_CLASS: Record<string, string> = {
  ATXHeading1: 'cm-md-h1',
  ATXHeading2: 'cm-md-h2',
  ATXHeading3: 'cm-md-h3',
  ATXHeading4: 'cm-md-h4',
  ATXHeading5: 'cm-md-h5',
  ATXHeading6: 'cm-md-h6',
  SetextHeading1: 'cm-md-h1',
  SetextHeading2: 'cm-md-h2',
}

const hidden = Decoration.replace({})

const line = (cls: string) => Decoration.line({ class: cls })
const mark = (cls: string) => Decoration.mark({ class: cls })

const EM = mark('cm-md-em')
const STRONG = mark('cm-md-strong')
const STRIKE = mark('cm-md-strike')
const INLINE_CODE = mark('cm-md-inline-code')
const LINK_TEXT = mark('cm-md-link')
const CODE_INFO = mark('cm-md-code-info')
const LIST_NUMBER = mark('cm-md-number')

class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }
  eq(other: BulletWidget) {
    return other.depth === this.depth
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-md-bullet'
    // Nested levels get a different shape rather than the same dot indented,
    // so depth is visible without counting pixels.
    span.textContent = this.depth >= 3 ? '▪' : this.depth === 2 ? '◦' : '•'
    return span
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-md-rule'
    return span
  }
}

class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  eq(other: TaskWidget) {
    return other.checked === this.checked
  }
  toDOM(view: EditorView) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.className = 'cm-md-task'
    box.setAttribute('aria-label', this.checked ? 'done' : 'open')
    // The position is read from the DOM at click time, not captured here: the
    // widget outlives edits above it, and a remembered offset would tick the
    // wrong box.
    box.addEventListener('mousedown', (event) => {
      event.preventDefault()
      const pos = view.posAtDOM(box)
      const text = view.state.doc.sliceString(pos, pos + 3)
      if (!/^\[[ xX]\]$/.test(text)) return
      view.dispatch({
        changes: { from: pos + 1, to: pos + 2, insert: text[1] === ' ' ? 'x' : ' ' },
      })
    })
    return box
  }
}

/** Unsubscribe handles per chip — see MentionWidget.destroy. */
const mentionCleanup = new WeakMap<HTMLElement, () => void>()

class MentionWidget extends WidgetType {
  constructor(readonly pubkey: string) {
    super()
  }
  eq(other: MentionWidget) {
    return other.pubkey === this.pubkey
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-md-mention'
    const npub = toNpub(this.pubkey)
    // The npub is what is stored and what identifies the person, so it stays
    // reachable — in the tooltip here, next to the name in the page.
    span.title = npub
    span.textContent = `@${shortNpub(npub)}`
    mentionCleanup.set(
      span,
      observeProfile(this.pubkey, (profile) => {
        const name = profile?.displayName ?? profile?.name
        span.textContent = `@${name ?? shortNpub(npub)}`
      }),
    )
    return span
  }
  destroy(dom: HTMLElement) {
    mentionCleanup.get(dom)?.()
    mentionCleanup.delete(dom)
  }
}

/**
 * The lines the selection touches. Those show their markup; everything else is
 * formatted. An unfocused editor reveals nothing — otherwise a page that has
 * only just been opened shows a stray `#` on its first line.
 */
function revealedLines(state: EditorState, hasFocus: boolean): { from: number; to: number }[] {
  if (!hasFocus) return []
  return state.selection.ranges.map((range) => {
    const first = state.doc.lineAt(range.from)
    const last = range.to <= first.to ? first : state.doc.lineAt(range.to)
    return { from: first.from, to: last.to }
  })
}

function hasAncestor(node: SyntaxNode, name: string): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === name) return true
  }
  return false
}

/** How deeply a list item is nested, counted in enclosing lists. */
function listDepth(node: SyntaxNode): number {
  let depth = 0
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === 'BulletList' || parent.name === 'OrderedList') depth += 1
  }
  return depth
}

function build(view: EditorView): { decorations: DecorationSet; atomic: DecorationSet } {
  const state = view.state
  const decos: Range<Decoration>[] = []
  const atoms: Range<Decoration>[] = []
  const regions = revealedLines(state, view.hasFocus)
  /** true while the cursor is on this stretch — then it stays raw text */
  const raw = (from: number, to: number) =>
    regions.some((region) => from <= region.to && to >= region.from)

  const eachLine = (from: number, to: number, apply: (pos: number, index: number, last: number) => void) => {
    let pos = from
    let index = 0
    const total = state.doc.lineAt(to).number - state.doc.lineAt(from).number
    while (pos <= to) {
      const current = state.doc.lineAt(pos)
      apply(current.from, index, total)
      if (current.to >= to) break
      pos = current.to + 1
      index += 1
    }
  }

  /** hide a marker together with the spaces that separate it from the text */
  const hideWithSpaces = (from: number, to: number) => {
    let end = to
    while (end < state.doc.length && state.doc.sliceString(end, end + 1) === ' ') end += 1
    decos.push(hidden.range(from, end))
  }

  const tree = syntaxTree(state)

  for (const { from: viewFrom, to: viewTo } of view.visibleRanges) {
    tree.iterate({
      from: viewFrom,
      to: viewTo,
      enter: (node: SyntaxNodeRef) => {
        const name = node.name

        const headingClass = HEADING_CLASS[name]
        if (headingClass) {
          eachLine(node.from, node.to, (pos) => decos.push(line(headingClass).range(pos)))
          return
        }

        switch (name) {
          case 'HeaderMark': {
            // In a Setext heading the "marker" is the ===/--- underline on its
            // own line. Hiding it would leave an empty line behind, so it
            // stays visible and only the line above is sized as a heading.
            if (hasAncestor(node.node, 'SetextHeading1') || hasAncestor(node.node, 'SetextHeading2')) {
              decos.push(mark('cm-md-marker').range(node.from, node.to))
              return
            }
            if (raw(node.from, node.to)) {
              decos.push(mark('cm-md-marker').range(node.from, node.to))
            } else {
              hideWithSpaces(node.from, node.to)
            }
            return
          }

          case 'Blockquote': {
            eachLine(node.from, node.to, (pos) => decos.push(line('cm-md-quote').range(pos)))
            return
          }

          case 'QuoteMark': {
            if (raw(node.from, node.to)) {
              decos.push(mark('cm-md-marker').range(node.from, node.to))
            } else {
              hideWithSpaces(node.from, node.to)
            }
            return
          }

          case 'FencedCode':
          case 'CodeBlock': {
            eachLine(node.from, node.to, (pos, index, last) => {
              decos.push(line('cm-md-code-block').range(pos))
              if (index === 0) decos.push(line('cm-md-code-first').range(pos))
              if (index === last) decos.push(line('cm-md-code-last').range(pos))
            })
            return
          }

          case 'CodeMark': {
            // The fence of a code block and the backticks of inline code are
            // the same node; both are markup and go away off the active line.
            if (!raw(node.from, node.to)) decos.push(hidden.range(node.from, node.to))
            return
          }

          case 'CodeInfo': {
            decos.push(CODE_INFO.range(node.from, node.to))
            return
          }

          case 'InlineCode': {
            decos.push(INLINE_CODE.range(node.from, node.to))
            return
          }

          case 'Emphasis': {
            decos.push(EM.range(node.from, node.to))
            return
          }

          case 'StrongEmphasis': {
            decos.push(STRONG.range(node.from, node.to))
            return
          }

          case 'Strikethrough': {
            decos.push(STRIKE.range(node.from, node.to))
            return
          }

          case 'EmphasisMark':
          case 'StrikethroughMark': {
            if (!raw(node.from, node.to)) decos.push(hidden.range(node.from, node.to))
            return
          }

          case 'ListItem': {
            eachLine(node.from, node.to, (pos, index) => {
              if (index === 0) decos.push(line('cm-md-item').range(pos))
            })
            return
          }

          case 'ListMark': {
            const ordered = node.node.parent?.parent?.name === 'OrderedList'
            if (ordered) {
              // A number carries information — it is never replaced, only
              // toned down so the text stays the loudest thing on the line.
              decos.push(LIST_NUMBER.range(node.from, node.to))
              return
            }
            if (raw(node.from, node.to)) {
              decos.push(mark('cm-md-marker').range(node.from, node.to))
              return
            }
            decos.push(
              Decoration.replace({ widget: new BulletWidget(listDepth(node.node)) }).range(
                node.from,
                node.to,
              ),
            )
            return
          }

          case 'TaskMarker': {
            if (raw(node.from, node.to)) {
              decos.push(mark('cm-md-marker').range(node.from, node.to))
              return
            }
            const checked = state.doc.sliceString(node.from, node.to).toLowerCase() === '[x]'
            const deco = Decoration.replace({ widget: new TaskWidget(checked) })
            decos.push(deco.range(node.from, node.to))
            atoms.push(deco.range(node.from, node.to))
            return
          }

          case 'HorizontalRule': {
            if (raw(node.from, node.to)) {
              decos.push(line('cm-md-hr-raw').range(state.doc.lineAt(node.from).from))
              return
            }
            decos.push(Decoration.replace({ widget: new RuleWidget() }).range(node.from, node.to))
            return
          }

          case 'Link': {
            decos.push(LINK_TEXT.range(node.from, node.to))
            return
          }

          case 'LinkMark': {
            // An image is left as written: drawn as its alt text alone it
            // would look like a paragraph that lost its picture.
            if (hasAncestor(node.node, 'Image')) return
            if (!raw(node.from, node.to)) decos.push(hidden.range(node.from, node.to))
            return
          }

          case 'URL': {
            if (hasAncestor(node.node, 'Image')) return
            const parent = node.node.parent
            // Only the target of a `[text](url)` link is hidden. A bare or
            // <angled> URL *is* the text — hiding it would delete the link.
            const labelled =
              parent?.name === 'Link' && state.doc.sliceString(parent.from, parent.from + 1) === '['
            if (labelled && !raw(node.from, node.to)) decos.push(hidden.range(node.from, node.to))
            return
          }

          default:
            return
        }
      },
    })

    // Mentions are not a Markdown construct, so the syntax tree knows nothing
    // about them — they are found in the text and only skipped inside code.
    const text = state.doc.sliceString(viewFrom, viewTo)
    for (const span of findMentions(text)) {
      const from = viewFrom + span.from
      const to = viewFrom + span.to
      const node = tree.resolveInner(from, 1)
      if (
        NO_MENTION.has(node.name) ||
        hasAncestor(node, 'FencedCode') ||
        hasAncestor(node, 'CodeBlock')
      ) {
        continue
      }
      // Unlike every other marker a chip does not fall back to raw text on the
      // active line: a 63-character npub in the middle of a sentence is not
      // something anyone edits by hand. It is atomic instead, so one Backspace
      // removes the whole mention.
      const deco = Decoration.replace({ widget: new MentionWidget(span.pubkey) })
      decos.push(deco.range(from, to))
      atoms.push(deco.range(from, to))
    }
  }

  return { decorations: Decoration.set(decos, true), atomic: Decoration.set(atoms, true) }
}

class LivePreview {
  decorations: DecorationSet
  atomic: DecorationSet

  constructor(view: EditorView) {
    const built = build(view)
    this.decorations = built.decorations
    this.atomic = built.atomic
  }

  update(update: ViewUpdate) {
    // focusChanged matters because an unfocused editor reveals no markup at
    // all; a changed tree because the parser finishes lazily.
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.focusChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state)
    ) {
      const built = build(update.view)
      this.decorations = built.decorations
      this.atomic = built.atomic
    }
  }
}

export const liveMarkdown = ViewPlugin.fromClass(LivePreview, {
  decorations: (plugin) => plugin.decorations,
  provide: (plugin) =>
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
})
