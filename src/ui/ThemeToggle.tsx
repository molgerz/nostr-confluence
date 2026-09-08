import { useTheme } from '../theme/theme'
import type { ThemeMode } from '../theme/theme'
import { Segmented } from './controls'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'

const OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <MonitorIcon className="size-4" /> },
  { value: 'light', label: 'Light', icon: <SunIcon className="size-4" /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon className="size-4" /> },
]

/**
 * Three states, one track: system / light / dark. Icons rather than words —
 * the switch sits in the narrowest strip of the layout, and "System / Light /
 * Dark" spelled out was the widest thing in it. Each name stays as the tooltip
 * and as the accessible name. docs/12-theming.md
 */
export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  return (
    <Segmented
      compact
      label="Colour mode"
      value={mode}
      options={OPTIONS}
      onChange={setMode}
    />
  )
}
