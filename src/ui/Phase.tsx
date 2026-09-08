import type { ReactNode } from 'react'

/**
 * Placeholder for features that are not built yet. It names the phase from
 * docs/10-roadmap.md explicitly, so the skeleton explains itself and nobody
 * mistakes an empty area for a bug.
 *
 * A dashed outline rather than a filled panel: it says "something goes here"
 * without looking like something that is already here.
 */
export function PhaseNote({ phase, children }: { phase: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-4">
      <div className="text-[11px] font-semibold tracking-wider text-fg-subtle uppercase">
        {phase}
      </div>
      <div className="mt-1 text-sm text-fg-muted">{children}</div>
    </div>
  )
}
