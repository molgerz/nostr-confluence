import { describe, expect, it } from 'vitest'
import { attachmentMarkdown } from './blossom'

describe('attachmentMarkdown', () => {
  it('embeds images', () => {
    expect(
      attachmentMarkdown({ url: 'http://x/abc', type: 'image/png' }, 'screenshot.png'),
    ).toBe('![screenshot.png](http://x/abc)')
  })

  it('links everything else instead of embedding it as an image', () => {
    expect(attachmentMarkdown({ url: 'http://x/abc', type: 'application/pdf' }, 'contract.pdf')).toBe(
      '[contract.pdf](http://x/abc)',
    )
    expect(attachmentMarkdown({ url: 'http://x/abc', type: '' }, 'data.bin')).toBe(
      '[data.bin](http://x/abc)',
    )
  })
})
