import { describe, expect, it } from 'vitest'
import { attachmentMarkdown } from './blossom'

describe('attachmentMarkdown', () => {
  it('bettet Bilder ein', () => {
    expect(
      attachmentMarkdown({ url: 'http://x/abc', type: 'image/png' }, 'screenshot.png'),
    ).toBe('![screenshot.png](http://x/abc)')
  })

  it('verlinkt alles andere, statt es als Bild einzubetten', () => {
    expect(attachmentMarkdown({ url: 'http://x/abc', type: 'application/pdf' }, 'vertrag.pdf')).toBe(
      '[vertrag.pdf](http://x/abc)',
    )
    expect(attachmentMarkdown({ url: 'http://x/abc', type: '' }, 'daten.bin')).toBe(
      '[daten.bin](http://x/abc)',
    )
  })
})
