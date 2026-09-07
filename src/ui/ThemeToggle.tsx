import { useTheme } from '../theme/theme'
import type { ThemeMode } from '../theme/theme'

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  return (
    <div
      role="group"
      aria-label="Colour mode"
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface-2 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.mode
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            onClick={() => setMode(option.mode)}
            className={
              active
                ? 'rounded-sm bg-accent-bg px-2 py-1 text-xs font-medium text-accent-fg'
                : 'rounded-sm px-2 py-1 text-xs text-fg-muted hover:bg-surface-1'
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
