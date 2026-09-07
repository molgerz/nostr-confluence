import type { ReactNode } from 'react'

/**
 * Platzhalter für noch nicht gebaute Funktionen. Benennt ausdrücklich die
 * Phase aus docs/10-roadmap.md, damit das Skelett selbsterklärend bleibt und
 * niemand einen leeren Bereich für einen Bug hält.
 */
export function PhaseNote({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{phase}</div>
      <div className="mt-1 text-sm text-fg-muted">{children}</div>
    </div>
  )
}
