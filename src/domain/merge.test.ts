import { describe, expect, it } from 'vitest'
import { hasConflictMarkers, mergeThreeWay } from './merge'

const base = ['# Onboarding', '', 'Willkommen im Team.', '', '## Zugänge', '', 'Bitte fragen.'].join(
  '\n',
)

describe('mergeThreeWay', () => {
  it('gibt identische Fassungen unverändert zurück', () => {
    const result = mergeThreeWay(base, base, base)
    expect(result.status).toBe('identical')
    expect(result.content).toBe(base)
  })

  it('übernimmt die fremde Fassung, wenn ich nichts geändert habe', () => {
    const theirs = base.replace('Bitte fragen.', 'Bitte bei Bob fragen.')
    const result = mergeThreeWay(base, base, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toBe(theirs)
  })

  it('führt Änderungen an verschiedenen Stellen ohne Konflikt zusammen', () => {
    const mine = base.replace('Willkommen im Team.', 'Willkommen im Team! Schön, dass du da bist.')
    const theirs = base.replace('Bitte fragen.', 'Bitte bei Bob fragen.')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.conflicts).toBe(0)
    expect(result.content).toContain('Schön, dass du da bist.')
    expect(result.content).toContain('Bitte bei Bob fragen.')
  })

  it('markiert einen Konflikt, wenn beide dieselbe Zeile ändern', () => {
    const mine = base.replace('Bitte fragen.', 'Bitte bei Alice fragen.')
    const theirs = base.replace('Bitte fragen.', 'Bitte bei Bob fragen.')
    const result = mergeThreeWay(base, mine, theirs, { mine: 'alice', theirs: 'bob' })
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toBe(1)
    expect(result.content).toContain('<<<<<<< alice')
    expect(result.content).toContain('||||||| gemeinsame Basis')
    expect(result.content).toContain('>>>>>>> bob')
    expect(result.content).toContain('Bitte bei Alice fragen.')
    expect(result.content).toContain('Bitte bei Bob fragen.')
    expect(hasConflictMarkers(result.content)).toBe(true)
  })

  it('wertet dieselbe Änderung auf beiden Seiten nicht als Konflikt', () => {
    const both = base.replace('Bitte fragen.', 'Bitte bei Bob fragen.')
    const result = mergeThreeWay(base, both, both)
    expect(result.status).toBe('identical')
    expect(result.content).toBe(both)
  })

  it('führt Anhängen am Ende und Ändern am Anfang zusammen', () => {
    const mine = `${base}\n\n## Kontakt\n\nteam@example.org`
    const theirs = base.replace('# Onboarding', '# Onboarding für neue Kolleg:innen')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toContain('# Onboarding für neue Kolleg:innen')
    expect(result.content).toContain('team@example.org')
  })

  it('erkennt zwei verschiedene Einfügungen an derselben Stelle als Konflikt', () => {
    const mine = base.replace('## Zugänge', '## Ziel\n\nSchnell startklar.\n\n## Zugänge')
    const theirs = base.replace('## Zugänge', '## Voraussetzungen\n\nLaptop.\n\n## Zugänge')
    const result = mergeThreeWay(base, mine, theirs)
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toBe(1)
  })

  it('behandelt eine leere Basis (neue Seite auf beiden Seiten)', () => {
    const result = mergeThreeWay('', 'meins', 'ihres')
    expect(result.status).toBe('conflict')
  })

  it('lässt keinen Inhalt verschwinden, wenn beide anhängen', () => {
    const mine = `${base}\n\nvon alice`
    const theirs = `${base}\n\nvon bob`
    const result = mergeThreeWay(base, mine, theirs)
    // Gleiche Stelle, unterschiedlicher Text: Konflikt, aber beide Texte sind da
    expect(result.content).toContain('von alice')
    expect(result.content).toContain('von bob')
  })
})

describe('Platzierung', () => {
  const doc = '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Kontakt\n\nBitte fragen.'

  it('setzt einen eingefügten Abschnitt an genau die richtige Stelle', () => {
    const mine =
      '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Ziel\n\nSchnell startklar werden.\n\n## Kontakt\n\nBitte fragen.'
    const theirs = '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Kontakt\n\nBitte bei Alice fragen.'
    const result = mergeThreeWay(doc, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content).toBe(
      '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Ziel\n\nSchnell startklar werden.\n\n## Kontakt\n\nBitte bei Alice fragen.',
    )
  })

  it('funktioniert auch mit vertauschten Rollen', () => {
    const a =
      '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Ziel\n\nSchnell startklar werden.\n\n## Kontakt\n\nBitte fragen.'
    const b = '# Merge-Test\n\nDiese Zeile bleibt.\n\n## Kontakt\n\nBitte bei Alice fragen.'
    expect(mergeThreeWay(doc, b, a).content).toBe(mergeThreeWay(doc, a, b).content)
  })

  it('fügt am Dateianfang vor der ersten Zeile ein', () => {
    const mine = 'Vorwort\n\n' + doc
    const theirs = doc.replace('Bitte fragen.', 'Bitte bei Bob fragen.')
    const result = mergeThreeWay(doc, mine, theirs)
    expect(result.status).toBe('clean')
    expect(result.content.startsWith('Vorwort\n\n# Merge-Test')).toBe(true)
    expect(result.content.endsWith('Bitte bei Bob fragen.')).toBe(true)
  })
})

describe('hasConflictMarkers', () => {
  it('erkennt nichts in normalem Markdown', () => {
    expect(hasConflictMarkers('# Titel\n\nText mit <b>HTML</b> und ===== Linie')).toBe(false)
  })

  it('meldet eine H1-Unterstreichung nicht als Konflikt', () => {
    // Setext-Überschrift: eine Zeile aus Gleichheitszeichen ist gültiges Markdown
    expect(hasConflictMarkers('Überschrift\n=======\n\nText')).toBe(false)
  })

  it('erkennt einen echten Marker', () => {
    expect(hasConflictMarkers('Text\n<<<<<<< deine Fassung\nmehr')).toBe(true)
    expect(hasConflictMarkers('>>>>>>> ihre Fassung')).toBe(true)
  })
})
