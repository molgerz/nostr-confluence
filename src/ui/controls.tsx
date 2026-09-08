import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The control vocabulary: one definition per kind of button, one per kind of
 * notice. Before this file every view spelled its own Tailwind string, and the
 * same button was 1.5px taller in the editor than on the page — which is
 * exactly the sort of drift that makes an app look assembled rather than
 * designed.
 *
 * Rules the set follows:
 *
 * - **One accent per view.** `primary` is a solid accent fill and there is
 *   normally one of it on screen; everything else is `default` (a bordered
 *   surface) or `subtle` (no border until hovered). A screen where five
 *   buttons all shout leaves the reader nothing to follow.
 * - **Neutral for state, accent for action.** A selected row, a pressed
 *   segment and a hovered menu item are grey (`--surface-hover` /
 *   `--surface-selected`); blue means "this does something".
 * - **One radius, one height.** 6px and 32px for controls, 8px for cards.
 */

export type Variant = 'primary' | 'default' | 'subtle' | 'danger'
export type Size = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:brightness-95',
  default:
    'border border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
  subtle: 'text-fg-muted hover:bg-surface-hover hover:text-fg',
  danger: 'border border-line text-danger hover:bg-danger-bg',
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-sm',
}

type Common = {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** The same shapes as `Button`, for the ones that navigate instead of act. */
export function ButtonLink({
  to,
  variant = 'default',
  size = 'md',
  className = '',
  children,
  title,
}: Common & { to: string; title?: string }) {
  return (
    <Link
      to={to}
      title={title}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {children}
    </Link>
  )
}

/**
 * A square button holding nothing but an icon. It **must** carry a label:
 * without one the action is invisible to a screen reader and unguessable to
 * everyone hovering it, and an icon row is only tidier than a row of words if
 * the words are still reachable.
 */
export function IconButton({
  label,
  variant = 'subtle',
  className = '',
  children,
  ...props
}: Omit<Common, 'size'> &
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${BASE} ${VARIANT[variant]} size-8 p-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButtonLink({
  to,
  label,
  variant = 'subtle',
  className = '',
  children,
}: Omit<Common, 'size'> & { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={`${BASE} ${VARIANT[variant]} size-8 p-0 ${className}`}
    >
      {children}
    </Link>
  )
}

/**
 * A switch between two or three states of the *same* thing — reading against
 * editing, one colour mode against another. The selected segment is a raised
 * surface inside a sunken track, which is what says "one of these is on"
 * without either of them looking like a button that would do something else.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  compact = false,
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
  label: string
  /** icons only — the label stays as the tooltip and the accessible name */
  compact?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center gap-0.5 rounded-md bg-surface-0 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={compact ? option.label : undefined}
            onClick={() => onChange(option.value)}
            title={option.label}
            className={`inline-flex h-7 items-center gap-1.5 rounded-[5px] text-xs font-medium transition-colors ${
              compact ? 'w-7 justify-center' : 'px-2.5'
            } ${active ? 'bg-surface-2 text-fg shadow-sm' : 'text-fg-subtle hover:text-fg-muted'}`}
          >
            {option.icon}
            {compact ? null : option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The tiny muted heading over a group — "Pages", "Members". Small, spaced and
 * grey rather than bold and black: it labels a region, and a region label that
 * competes with the page title makes the page read as a list of headings.
 */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`text-[11px] font-semibold tracking-wider text-fg-subtle uppercase ${className}`}
    >
      {children}
    </div>
  )
}

export type Tone = 'info' | 'warning' | 'danger' | 'success'

const TONE: Record<Tone, { box: string; title: string }> = {
  info: { box: 'bg-accent-bg', title: 'text-accent-fg' },
  warning: { box: 'bg-warning-bg', title: 'text-warning' },
  danger: { box: 'bg-danger-bg', title: 'text-danger' },
  success: { box: 'bg-success-bg', title: 'text-success' },
}

/**
 * A tinted block for a state the reader has to be told about: a forked page, a
 * relay that will refuse the next save. Filled and **borderless** — a coloured
 * outline around a coloured fill reads as an alert box from a settings dialog,
 * and these sit inside a document.
 */
export function Callout({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  const style = TONE[tone]
  return (
    <div className={`rounded-lg p-3.5 text-sm ${style.box}`}>
      {title ? <div className={`font-semibold ${style.title}`}>{title}</div> : null}
      {children ? <div className="mt-1 text-fg-muted">{children}</div> : null}
      {actions ? <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

/**
 * A panel that groups a form or a table — the member list, the write check.
 * Bordered on the canvas rather than filled, so a page can hold several
 * without turning into a patchwork of greys.
 */
export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-line bg-surface-2 ${className}`}>{children}</div>
  )
}

/**
 * A form field's label and its control, stacked. Every input in the app is
 * 32px tall with the same border and radius as a `default` button, so a form
 * and the buttons under it sit on one grid.
 */
export const INPUT =
  'h-8 w-full rounded-md border border-line bg-surface-2 px-2.5 text-sm text-fg ' +
  'placeholder:text-fg-subtle disabled:opacity-60'

export const TEXTAREA =
  'w-full rounded-md border border-line bg-surface-2 p-2.5 text-sm text-fg ' +
  'placeholder:text-fg-subtle disabled:opacity-60'

/**
 * The initials disc that stands in for a space or a person without a picture.
 * The colour is derived from the name, so the same space is the same colour on
 * every machine without anybody storing one — and two spaces in a list are
 * told apart at a glance rather than by reading.
 */
const DISC_COLOURS = [
  'bg-[#4c6ef5]',
  'bg-[#7950f2]',
  'bg-[#e64980]',
  'bg-[#f76707]',
  'bg-[#0ca678]',
  'bg-[#1098ad]',
  'bg-[#ae3ec9]',
  'bg-[#2f9e44]',
]

export function InitialsDisc({
  name,
  className = 'size-6 text-[11px]',
}: {
  name: string
  className?: string
}) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 100000
  const colour = DISC_COLOURS[hash % DISC_COLOURS.length]
  const initials = name
    .split(/[\s._/-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${colour} ${className}`}
    >
      {initials || '?'}
    </span>
  )
}
