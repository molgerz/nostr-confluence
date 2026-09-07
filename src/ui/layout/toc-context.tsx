import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Kleiner Umweg, damit das Inhaltsverzeichnis in der rechten Leiste stehen
 * kann, obwohl nur die Seitenansicht weiss, welcher Text gerade angezeigt
 * wird. Die Route meldet ihren Markdown-Text an, die Hülle rendert daraus.
 */
type TocValue = { markdown: string; setMarkdown: (markdown: string) => void }

const TocContext = createContext<TocValue | null>(null)

export function TocProvider({ children }: { children: ReactNode }) {
  const [markdown, setMarkdown] = useState('')
  const value = useMemo(() => ({ markdown, setMarkdown }), [markdown])
  return <TocContext.Provider value={value}>{children}</TocContext.Provider>
}

/** Von der Route aufzurufen: meldet den aktuellen Text an und räumt wieder auf. */
export function useTocSource(markdown: string): void {
  const ctx = useContext(TocContext)
  const setMarkdown = ctx?.setMarkdown
  useEffect(() => {
    setMarkdown?.(markdown)
    return () => setMarkdown?.('')
  }, [markdown, setMarkdown])
}

export function useTocMarkdown(): string {
  return useContext(TocContext)?.markdown ?? ''
}
