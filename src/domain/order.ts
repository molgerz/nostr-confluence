import { normalizeSlug } from '../nostr/kinds'

/**
 * Sibling order in the page tree.
 *
 * A page may carry an order key in its `page-order` tag; a page without one is
 * ordered by its title. Both live in the **same** key space — an implicit key
 * is the normalised title — and that is what makes filing a page between two
 * siblings possible without touching their events: the new key is just a
 * string that sorts between its two neighbours.
 * docs/02-data-model-events.md
 *
 * Keys are compared as plain strings, and two properties of that comparison
 * carry the whole scheme: every proper prefix of a key sorts *before* it, and
 * every extension sorts *after* it. A gap can therefore always be filled,
 * however often it is subdivided.
 */

/** Sits in the middle of the alphabet, so there is room on either side. */
const MIDDLE = 'm'

/** Below this no printable character is worth generating. */
const FLOOR = 33

/**
 * The key a page without a `page-order` tag is sorted by. The slug stands in
 * when a title normalises to nothing (say "???"), because an empty key would
 * have nothing below it.
 */
export function implicitOrderKey(title: string, slug: string): string {
  const key = normalizeSlug(title)
  return key.length > 0 ? key : slug
}

/** The key a page is actually sorted by: its own, or the one from its title. */
export function effectiveOrderKey(
  order: string | null,
  title: string,
  slug: string,
): string {
  return order && order.length > 0 ? order : implicitOrderKey(title, slug)
}

/**
 * A key that sorts strictly between `before` and `after`. `null` means "no
 * neighbour on that side" — the start or the end of the level.
 */
export function keyBetween(before: string | null, after: string | null): string {
  if (before === null && after === null) return MIDDLE
  if (after === null || after.length === 0) return keyAfter(before!)
  if (before === null || before.length === 0) return keyBefore(after)
  if (before >= after) {
    // Equal or inverted bounds: two titles that normalise to the same key.
    // Landing behind the pair is off by at most one row and stays
    // deterministic — refusing the drop would be the worse answer.
    return keyAfter(after)
  }
  return keyWithin(before, after)
}

/** Raising the last character keeps the key as short as its predecessor. */
function keyAfter(before: string): string {
  const code = before.charCodeAt(before.length - 1)
  if (code >= 97 && code < 122) return before.slice(0, -1) + String.fromCharCode(code + 1)
  return before + MIDDLE
}

function keyBefore(after: string): string {
  const code = after.charCodeAt(after.length - 1)
  // Lowering the last character keeps the length. With no room below, the
  // shorter prefix does it — a prefix always sorts first.
  if (code > FLOOR) return after.slice(0, -1) + String.fromCharCode(code - 1)
  return after.length > 1 ? after.slice(0, -1) : MIDDLE
}

function keyWithin(before: string, after: string): string {
  if (after.startsWith(before)) {
    // `after` continues where `before` ends, so the gap can only be filled
    // below its next character.
    const next = after.slice(before.length)
    if (next.length > 1) return before + next[0]
    const code = next.charCodeAt(0)
    if (code > FLOOR) return before + String.fromCharCode(code - 1)
    // Nothing fits between them at all. Unreachable with keys from titles,
    // which never end that low; behind `after` is then the honest answer.
    return after + MIDDLE
  }

  // They already differ, so *any* extension of `before` stays below `after`.
  let index = 0
  while (before[index] === after[index]) index += 1
  const low = before.charCodeAt(index)
  const high = after.charCodeAt(index)
  if (high - low >= 2) {
    return before.slice(0, index) + String.fromCharCode(Math.floor((low + high) / 2))
  }
  return before + MIDDLE
}
