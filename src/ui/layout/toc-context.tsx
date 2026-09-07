import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A small detour that lets the table of contents live in the right-hand rail
 * even though only the page view knows which text is being displayed. The route
 * registers its Markdown, the shell renders from it.
 */
type TocValue = { markdown: string; setMarkdown: (markdown: string) => void }

const TocContext = createContext<TocValue | null>(null)

export function TocProvider({ children }: { children: ReactNode }) {
  const [markdown, setMarkdown] = useState('')
  const value = useMemo(() => ({ markdown, setMarkdown }), [markdown])
  return <TocContext.Provider value={value}>{children}</TocContext.Provider>
}

/** Called by a route: registers the current text and cleans up afterwards. */
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
