import { describe, expect, it } from 'vitest'
import { rehypeBlankLines } from './markdown-blank-lines'

type HastNode = {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  position?: { start: { line: number }; end: { line: number } }
}

/** a block that occupies the lines `from` … `to` of the source */
const block = (from: number, to = from): HastNode => ({
  type: 'element',
  tagName: 'p',
  children: [],
  position: { start: { line: from }, end: { line: to } },
})

const gap = '1rem'

function run(children: HastNode[]): HastNode[] {
  const tree: HastNode = { type: 'root', children }
  rehypeBlankLines({ blank: gap })(tree)
  return tree.children ?? []
}

/** the heights of the spacers that were put in, in order */
const heights = (nodes: HastNode[]) =>
  nodes.filter((n) => n.tagName === 'div').map((n) => n.properties?.style)

describe('rehypeBlankLines', () => {
  it('leaves paragraphs separated by a single empty line alone', () => {
    // line 1 = text, line 2 = empty, line 3 = text
    expect(heights(run([block(1), block(3)]))).toEqual([])
  })

  it('keeps every empty line beyond the one that separates the paragraphs', () => {
    // three empty lines between them: one separates, two are kept
    expect(heights(run([block(1), block(5)]))).toEqual([`height:calc(2 * ${gap})`])
  })

  it('keeps the empty lines before the first block — there is nothing to separate', () => {
    expect(heights(run([block(3)]))).toEqual([`height:calc(2 * ${gap})`])
  })

  it('puts the spacer in front of the block it belongs to', () => {
    const out = run([block(1), block(4)])
    expect(out.map((n) => n.tagName)).toEqual(['p', 'div', 'p'])
  })

  it('measures from the end of a block, not from where it started', () => {
    // a block over lines 1–3, one empty line, then the next: nothing kept
    expect(heights(run([block(1, 3), block(5)]))).toEqual([])
  })

  it('drops the empty lines at the end — that is where the cursor was left', () => {
    const out = run([block(1), block(3)])
    expect(out).toHaveLength(2)
  })

  it('passes the newlines between blocks through untouched', () => {
    const newline: HastNode = { type: 'text' }
    const out = run([block(1), newline, block(5)])
    expect(out.map((n) => n.tagName ?? n.type)).toEqual(['p', 'text', 'div', 'p'])
  })
})
