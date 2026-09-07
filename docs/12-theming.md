# 12 — Theming: light and dark

**Requirement:** switchable between light and dark mode.

## Decision

Three states, not two: **system / light / dark**. "System" is the default and
follows `prefers-color-scheme`; a manual choice overrides it and is kept in
`localStorage`. The switch sits in the top bar next to the account chip.

Implementation: a `data-theme="light|dark"` attribute on the `<html>` element,
set by JavaScript. Tailwind's `dark` variant is bound to that attribute (not to
the media query), otherwise the mode cannot be forced manually. Additionally
`color-scheme`, so that scrollbars, selection colour and form controls are
rendered appropriately by the browser.

**Solved slightly differently than written above:** not `color-scheme: light dark`
on `:root`, but `light` there and `dark` under `[data-theme='dark']`. The
two-value form hands the choice back to `prefers-color-scheme` — which is
exactly the manual override this design went to the trouble of building. A
checkbox in a page would then stay light on a dark page whenever the system was
set to light.

## Token layers

Components **never** use raw colours, only semantic tokens. Exactly one file
defines both palettes:

| Token | Meaning |
|---|---|
| `--surface-0/1/2` | Page background, sidebar/cards, foreground surfaces |
| `--text-primary/secondary/muted` | Body text, secondary text, hints |
| `--border`, `--border-strong` | Dividers, hover borders |
| `--accent`, `--bg-accent`, `--text-accent` | Actions, active sidebar row, buttons |
| `--danger`, `--warning`, `--success` (+ `bg-`/`text-`) | Conflict banner, publish errors, "saved" |
| `--diff-add-bg`, `--diff-del-bg` | Diff view: added and removed lines |
| `--diff-word-add-bg`, `--diff-word-del-bg` | Word-level highlighting inside a changed line (instead of a single `--diff-word-bg`: added and removed need different colours) |
| `--code-bg`, `--code-line` | Code blocks in Markdown |

Rule: if a component needs a colour that does not exist as a token, add the
token — do not write the colour inline. That is the only way the second mode
stays maintainable at all.

In dark mode, no pure black as a surface (too harsh a contrast, halation around
text) and no pure white as text. Contrast at least 4.5:1 for body text
everywhere.

## The four places this usually breaks

1. **Code blocks in Markdown** — syntax highlighting needs two themes. With
   Shiki, dual themes work through CSS variables in a single rendering; with
   highlight.js two stylesheets have to be swapped. Suggestion: Shiki, so that
   no stylesheet swap is needed at runtime. *(Still open — code blocks currently
   render without colour.)*
2. **The editor** — CodeMirror 6 brings its own theme. The switch has to happen
   through a `Compartment` with `reconfigure`, not by rebuilding the editor,
   otherwise cursor and undo history are lost when switching.
3. **The diff view** — the red/green from light mode is either unreadable or
   shouting in dark mode. Separate, desaturated tokens for both modes, and mark
   additions and removals with `+`/`−` as well, not by colour alone
   (red-green colour blindness).
5. **Task-list checkboxes in Markdown** — the sanitiser's default schema drops
   `checked` from a checkbox, so a ticked box would render as unticked and the
   list would quietly lie about its state. The schema is extended by that one
   attribute. The control itself stays native rather than being restyled:
   `color-scheme` already makes the browser draw it correctly in both modes,
   and a hand-built box would mean maintaining two more sets of colours.
4. **Foreign content** — avatars and embedded images from `kind 0` or from pages
   arrive with arbitrary backgrounds. Make no transparency assumptions; in dark
   mode images get a neutral border rather than a filter.

## No flash on load

A tiny blocking inline script in `index.html` reads `localStorage` and sets
`data-theme` **before** the bundle loads. Without that step, every reload
briefly flashes light mode.

## Timing

**Decision:** tokens and the switch land in **phase 0**, not later. Retrofitting
dark mode means touching every component a second time; working with tokens from
the start costs almost nothing.

Verification: **open.** Playwright screenshots of the four core views (reading a
page, editor, history, diff) in both modes are planned as a regression test. For
now testing is done by hand in the browser.
