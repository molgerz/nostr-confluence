import { describe, expect, it } from 'vitest'
import { nip19 } from 'nostr-tools'
import { remarkMentions } from './markdown-mentions'

const ALICE = '1'.repeat(64)
const NPUB = nip19.npubEncode(ALICE)

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] }

const run = (tree: MdNode) => {
  remarkMentions()(tree)
  return tree
}

const text = (value: string): MdNode => ({ type: 'text', value })

describe('remarkMentions', () => {
  it('splits a paragraph around the mention and keeps the surrounding text', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [text(`Ask nostr:${NPUB} please`)] }],
    })
    expect(tree.children?.[0].children).toEqual([
      { type: 'text', value: 'Ask ' },
      { type: 'link', url: `nostr:${NPUB}`, children: [{ type: 'text', value: NPUB }] },
      { type: 'text', value: ' please' },
    ])
  })

  it('reaches mentions nested inside emphasis', () => {
    const tree = run({
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'strong', children: [text(`nostr:${NPUB}`)] }] },
      ],
    })
    const strong = tree.children?.[0].children?.[0]
    expect(strong?.children?.[0].type).toBe('link')
  })

  it('leaves code and existing links untouched', () => {
    const value = `nostr:${NPUB}`
    const tree = run({
      type: 'root',
      children: [
        { type: 'inlineCode', value },
        { type: 'link', url: 'https://example.com', children: [text(value)] },
      ],
    })
    expect(tree.children?.[0]).toEqual({ type: 'inlineCode', value })
    expect(tree.children?.[1].children).toEqual([{ type: 'text', value }])
  })

  it('changes nothing when there is no mention', () => {
    const tree = run({ type: 'root', children: [{ type: 'paragraph', children: [text('plain')] }] })
    expect(tree.children?.[0].children).toEqual([{ type: 'text', value: 'plain' }])
  })

  it('drops a mention that is the whole text without leaving an empty node behind', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [text(`nostr:${NPUB}`)] }],
    })
    expect(tree.children?.[0].children).toHaveLength(1)
  })
})
