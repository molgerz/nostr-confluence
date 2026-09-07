import { describe, expect, it } from 'vitest'
import { extractHeadings } from './toc'

describe('extractHeadings', () => {
  it('reads headings with level and anchor', () => {
    const headings = extractHeadings('# Title\n\nText\n\n## Access\n\n### Details')
    expect(headings).toEqual([
      { level: 1, text: 'Title', id: 'title' },
      { level: 2, text: 'Access', id: 'access' },
      { level: 3, text: 'Details', id: 'details' },
    ])
  })

  it('skips code blocks', () => {
    const markdown = '# Real\n\n```bash\n# just a comment\necho hi\n```\n\n## Also real'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['Real', 'Also real'])
  })

  it('copes with tilde code blocks', () => {
    const markdown = '~~~\n# hidden\n~~~\n\n# visible'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['visible'])
  })

  it('makes duplicate headings unique', () => {
    const headings = extractHeadings('## Contact\n\n## Contact')
    expect(headings.map((h) => h.id)).toEqual(['contact', 'contact-2'])
  })

  it('strips formatting from the text', () => {
    expect(extractHeadings('## **Important** and `code`')[0].text).toBe('Important and code')
  })

  it('ignores hashes without a space and empty headings', () => {
    expect(extractHeadings('#not a heading\n\n##\n\n# But this is')).toHaveLength(1)
  })
})
