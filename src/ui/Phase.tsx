import type { ReactNode } from 'react'

/**
 * Placeholder for features that are not built yet. It names the phase from
 * docs/10-roadmap.md explicitly, so the skeleton explains itself and nobody
 * mistakes an empty area for a bug.
 */
export function PhaseNote({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4">
      <div className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{phase}</div>
      <div className="mt-1 text-sm text-fg-muted">{children}</div>
    </div>
  )
}
