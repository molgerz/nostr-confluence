/**
 * rehype plugin: keeps the empty lines a writer left between two blocks.
 *
 * Markdown collapses them — `a`, three empty lines, `b` is the same document as
 * `a`, one empty line, `b`, and CommonMark has no way to say otherwise. But the
 * editor draws the source, so there the three lines are three lines, and a page
 * that swallows two of them does not look like what was written. So the gap is
 * read back off the positions the parser recorded and put in as height.
 *
 * The rule is one line: **the first empty line separates the paragraphs — that
 * separation is the page's own rhythm and not a line. Every further empty line
 * is one the writer put there on purpose and is kept.** Before the first block
 * there is nothing to separate, so every empty line counts. After the last one
 * they are dropped: trailing empty lines are where the cursor was left, not
 * something anybody typed on purpose.
 *
 * It runs *after* the sanitiser, on purpose. The spacer carries a `style` and
 * that is exactly the kind of attribute the schema strips — running afterwards
 * keeps the check on the content strict while this, which is ours and not the
 * author's, gets through. docs/13-editing.md
 *
 * Only the top level. A blockquote or a list item is a block of its own with
 * its own spacing, and an empty line inside one is not a paragraph break.
 */
type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  position?: { start: { line: number }; end: { line: number } }
}

function spacer(lines: number, blank: string): HastNode {
  return {
    type: 'element',
    tagName: 'div',
    // Empty and announced as nothing: it is space, not content.
    properties: { 'aria-hidden': 'true', style: `height:calc(${lines} * ${blank})` },
    children: [],
  }
}

export function rehypeBlankLines({ blank }: { blank: string }) {
  return (tree: HastNode) => {
    const out: HastNode[] = []
    /** the last line of the block before this one; 0 = the start of the text */
    let end = 0
    let first = true

    for (const child of tree.children ?? []) {
      // The `\n` between two blocks — it carries no position and says nothing
      // about the gap, which is read off the blocks themselves.
      if (child.type !== 'element' || !child.position) {
        out.push(child)
        continue
      }

      const empty = child.position.start.line - end - 1
      const kept = first ? empty : empty - 1
      if (kept > 0) out.push(spacer(kept, blank))

      out.push(child)
      end = child.position.end.line
      first = false
    }

    tree.children = out
  }
}
