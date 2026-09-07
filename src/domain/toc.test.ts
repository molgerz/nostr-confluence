import { describe, expect, it } from 'vitest'
import { extractHeadings } from './toc'

describe('extractHeadings', () => {
  it('liest Überschriften mit Ebene und Anker', () => {
    const headings = extractHeadings('# Titel\n\nText\n\n## Zugänge\n\n### Details')
    expect(headings).toEqual([
      { level: 1, text: 'Titel', id: 'titel' },
      { level: 2, text: 'Zugänge', id: 'zugaenge' },
      { level: 3, text: 'Details', id: 'details' },
    ])
  })

  it('überspringt Codeblöcke', () => {
    const markdown = '# Echt\n\n```bash\n# nur ein Kommentar\necho hi\n```\n\n## Auch echt'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['Echt', 'Auch echt'])
  })

  it('kommt mit Tilde-Codeblöcken zurecht', () => {
    const markdown = '~~~\n# versteckt\n~~~\n\n# sichtbar'
    expect(extractHeadings(markdown).map((h) => h.text)).toEqual(['sichtbar'])
  })

  it('macht doppelte Überschriften eindeutig', () => {
    const headings = extractHeadings('## Kontakt\n\n## Kontakt')
    expect(headings.map((h) => h.id)).toEqual(['kontakt', 'kontakt-2'])
  })

  it('entfernt Auszeichnungen aus dem Text', () => {
    expect(extractHeadings('## **Wichtig** und `Code`')[0].text).toBe('Wichtig und Code')
  })

  it('ignoriert Rauten ohne Leerzeichen und leere Überschriften', () => {
    expect(extractHeadings('#kein Heading\n\n##\n\n# Doch')).toHaveLength(1)
  })
})
