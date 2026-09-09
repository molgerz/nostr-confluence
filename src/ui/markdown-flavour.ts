import type { Processor } from 'unified'
// pulls in remark-parse's declaration of `micromarkExtensions` on `Data`
import type {} from 'remark-parse'

/**
 * The one place where the Markdown this app reads and writes differs from
 * CommonMark — and it says so to *both* parsers, the editor's and the page's,
 * so the two cannot drift apart on it.
 *
 * ## No Setext headings
 *
 * CommonMark has two ways to write a heading. `# Title` — and `Title` with a
 * line of `-` or `=` under it, which is a Setext heading. The second one is a
 * trap in an editor that formats while you type:
 *
 * ```
 * Shopping        ← the moment the `-` below is typed, this becomes an H2
 * -
 * ```
 *
 * A `-` on the line under a paragraph is, far more often than not, the first
 * keystroke of `- milk`. And `---` under a paragraph is somebody drawing a
 * divider. Neither of them means "make the line above a heading", but that is
 * what CommonMark says — so the paragraph jumps to heading size on one
 * keystroke and back on the next, and a divider drawn under a line of text
 * silently turns that line into a heading instead.
 *
 * Drawing it differently cannot fix it: whatever the editor shows, the page
 * would still render the H2, and the two views drifting apart is the one thing
 * this editor exists to prevent. So the construct goes, in both. `- ` then
 * makes a list, `---` makes a divider — which is what was meant — and `# `,
 * the one the `Formatting` fold offers, still makes a heading.
 *
 * **The cost, stated plainly:** this is a deviation. The text stored is
 * untouched and still plain Markdown, but a document written elsewhere with a
 * Setext heading in it reads here as a paragraph followed by a divider, while
 * another Nostr client would show a heading. That is the trade: a construct
 * nobody types on purpose here, against a trap everybody falls into.
 *
 * **It is not the reason task lists once broke.** It was suspected of that and
 * taken out again; the causes turned out to be a no-break space in the task
 * marker, brackets being hidden as link markup, and hot updates never reaching
 * the running editor. `markdown-flavour.test.ts` pins GFM down against this.
 * docs/13-editing.md
 */

/**
 * For `@codemirror/lang-markdown` — pass as `extensions` so the editor's parser
 * never produces a `SetextHeading` node.
 */
export const NO_SETEXT_HEADINGS = { remove: ['SetextHeading'] }

/** the disable list micromark reads — `null` means "in every context" */
const OFF = { disable: { null: ['setextUnderline'] } }

/**
 * The same for the rendered page: a remark plugin that turns the underline off
 * in micromark, the parser underneath `remark-parse`. It reaches the parser
 * through the processor's data rather than through the syntax tree — there is
 * no tree to change here, the construct is never parsed in the first place.
 */
export function remarkNoSetextHeadings(this: Processor) {
  const data = this.data()
  data.micromarkExtensions = [...(data.micromarkExtensions ?? []), OFF]
}
