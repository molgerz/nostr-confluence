import { describe, expect, it } from 'vitest'
import { hasConflictMarkers, mergeThreeWay } from './merge'

const base = ['# Onboarding', '', 'Welcome to the team.', '', '## Access', '', 'Please ask.'].join(
  '\n',
)

describe('mergeThreeWay', () => {
  it('returns identical versions unchanged', () => {
    const result = mergeThreeWay(base, base, base)
    expect(result.status).toBe('identical')
    expect(result.content).toBe(base)
  })

  it('takes their version when I changed nothing', () => {
    const theirs = base.replace('Please ask.', 'Please ask Bob.')
    const result = mergeThreeWay(base, base, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toBe(theirs)
  })

  it('merges changes in different places without a conflict', () => {
    const mine = base.replace('Welcome to the team.', 'Welcome to the team! Glad you are here.')
    const theirs = base.replace('Please ask.', 'Please ask Bob.')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.conflicts).toBe(0)
    expect(result.content).toContain('Glad you are here.')
    expect(result.content).toContain('Please ask Bob.')
  })

  it('marks a conflict when both change the same line', () => {
    const mine = base.replace('Please ask.', 'Please ask Alice.')
    const theirs = base.replace('Please ask.', 'Please ask Bob.')
    const result = mergeThreeWay(base, mine, theirs, { mine: 'alice', theirs: 'bob' })
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toBe(1)
    expect(result.content).toContain('<<<<<<< alice')
    expect(result.content).toContain('||||||| common base')
    expect(result.content).toContain('>>>>>>> bob')
    expect(result.content).toContain('Please ask Alice.')
    expect(result.content).toContain('Please ask Bob.')
    expect(hasConflictMarkers(result.content)).toBe(true)
  })

  it('does not treat the same change on both sides as a conflict', () => {
    const both = base.replace('Please ask.', 'Please ask Bob.')
    const result = mergeThreeWay(base, both, both)
    expect(result.status).toBe('identical')
    expect(result.content).toBe(both)
  })

  it('merges an append at the end with a change at the start', () => {
    const mine = `${base}\n\n## Kontakt\n\nteam@example.org`
    const theirs = base.replace('# Onboarding', '# Onboarding for new colleagues')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toContain('# Onboarding for new colleagues')
    expect(result.content).toContain('team@example.org')
  })

  it('treats two different insertions at the same spot as a conflict', () => {
    const mine = base.replace('## Access', '## Goal\n\nGet started quickly.\n\n## Access')
    const theirs = base.replace('## Access', '## Requirements\n\nLaptop.\n\n## Access')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toBe(1)
  })

  it('handles an empty base (a new page on both sides)', () => {
    const result = mergeThreeWay('', 'mine', 'theirs')
    expect(result.status).toBe('conflict')
  })

  it('loses no content when both append', () => {
    const mine = `${base}\n\nfrom alice`
    const theirs = `${base}\n\nfrom bob`
    const result = mergeThreeWay(base, mine, theirs)
    // Gleiche Stelle, unterschiedlicher Text: Konflikt, aber beide Texte sind da
    expect(result.content).toContain('from alice')
    expect(result.content).toContain('from bob')
  })
})

describe('placement', () => {
  const doc = '# Merge test\n\nThis line stays.\n\n## Contact\n\nPlease ask.'

  it('puts an inserted section in exactly the right place', () => {
    const mine =
      '# Merge test\n\nThis line stays.\n\n## Goal\n\nGet started quickly.\n\n## Contact\n\nPlease ask.'
    const theirs = '# Merge test\n\nThis line stays.\n\n## Contact\n\nPlease ask Alice.'
    const result = mergeThreeWay(doc, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toBe(
      '# Merge test\n\nThis line stays.\n\n## Goal\n\nGet started quickly.\n\n## Contact\n\nPlease ask Alice.',
    )
  })

  it('works with the roles swapped as well', () => {
    const a =
      '# Merge test\n\nThis line stays.\n\n## Goal\n\nGet started quickly.\n\n## Contact\n\nPlease ask.'
    const b = '# Merge test\n\nThis line stays.\n\n## Contact\n\nPlease ask Alice.'
    expect(mergeThreeWay(doc, b, a).content).toBe(mergeThreeWay(doc, a, b).content)
  })

  it('inserts before the first line at the top of the file', () => {
    const mine = 'Foreword\n\n' + doc
    const theirs = doc.replace('Please ask.', 'Please ask Bob.')
    const result = mergeThreeWay(doc, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content.startsWith('Foreword\n\n# Merge test')).toBe(true)
    expect(result.content.endsWith('Please ask Bob.')).toBe(true)
  })
})

describe('hasConflictMarkers', () => {
  it('finds nothing in ordinary Markdown', () => {
    expect(hasConflictMarkers('# Title\n\nText with <b>HTML</b> and ===== line')).toBe(false)
  })

  it('does not report a setext H1 underline as a conflict', () => {
    // setext heading: a line of equals signs is valid Markdown
    expect(hasConflictMarkers('Heading\n=======\n\nText')).toBe(false)
  })

  it('recognises a real marker', () => {
    expect(hasConflictMarkers('Text\n<<<<<<< your version\nmore')).toBe(true)
    expect(hasConflictMarkers('>>>>>>> their version')).toBe(true)
  })
})
