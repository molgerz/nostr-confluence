import { normalizeSlug } from '../nostr/kinds'

export type Heading = {
  level: number
  text: string
  /** Anker-ID, wie sie der Markdown-Renderer setzt */
  id: string
}

/**
 * Überschriften aus Markdown ziehen für das "Auf dieser Seite"-Verzeichnis.
 *
 * Codeblöcke werden übersprungen: `# nicht wirklich eine Überschrift` in einem
 * Shell-Beispiel darf nicht im Inhaltsverzeichnis landen.
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const used = new Map<string, number>()
  let inFence = false
  let fence = ''

  for (const line of markdown.split('\n')) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fence = fenceMatch[1][0]
      } else if (fenceMatch[1][0] === fence) {
        inFence = false
      }
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const level = match[1].length
    const text = match[2].replace(/[*_`]/g, '').trim()
    if (text.length === 0) continue

    const base = normalizeSlug(text) || `abschnitt-${headings.length + 1}`
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)

    headings.push({ level, text, id: seen === 0 ? base : `${base}-${seen + 1}` })
  }

  return headings
}
