# 00 — Vision & scope

## The product idea

A team wiki that feels like Confluence (left-hand navigation, pages in a tree,
an editor, version history, "last edited by …") but without a server account:
identity = npub, storage = Nostr relay, permissions = NIP-29 group.

## Required features (from the original request)

| # | Requirement | How the design covers it |
|---|---|---|
| 1 | Sign in with Nostr, NIP-07 only for now | `window.nostr` + NIP-42 relay AUTH → [03](03-auth-nip07-nip42.md) |
| 2 | A left-hand navigation bar like Confluence | Space sidebar with a page tree → [06](06-ui-information-architecture.md) |
| 3 | Create new "pages" as Markdown | Page event + revision → [02](02-data-model-events.md) |
| 4 | Anyone may edit, in principle | Any *member* may edit any page — no per-page owners, no approvals. The circle itself is closed, see below → [04](04-permissions-nip29.md) |
| 5 | Version history tied to an npub | Hash-linked revision events, Git-like → [05](05-versioning-history.md) |
| 6 | Working on pages together | Optimistic saving + three-way merge, CRDT later → [05](05-versioning-history.md) |
| 7 | Switchable between light and dark | Token-based theming, switch in the top bar → [12](12-theming.md) |

## Closed teams only

**Akasha is for closed teams.** Reading requires two things at once: a signed-in
npub *and* membership granted by an admin. There is no anonymous reading, no
public space, no read-only visitor — a space whose relay flags say otherwise is
a misconfiguration, and the overview says so rather than presenting it as a
setting.

That is what requirement 4 means in practice: "anyone may edit" is about the
absence of hierarchy *inside* the team, not about who gets in. Everyone in the
circle is equal; the circle has a door.

The flags carrying it are `private` + `closed` + `restricted`, all three
([04](04-permissions-nip29.md)), and the relay enforces them — measured, not
assumed. What it does not give is confidentiality against the relay operator,
who can read everything ([09](09-security-privacy.md)).

## Maturity

**Prototype.** A space can so far only be created with `nak` from the command
line; the app offers no way to do it. Together with the missing TLS, the
throwaway keys in the seed script and an event format that may still change,
this means: do not put anything in here whose loss would hurt. Full reasoning in
[NOSTR.md](../NOSTR.md).

## Target picture for phase 1 (MVP)

Two people with Alby in their browser open the same URL, see the same space,
create pages, edit each other's pages, and the history shows which npub signed
each version. A conflict (both editing at once) is detected instead of silently
overwritten.

## Non-goals

- **Non-goal:** character-by-character real-time collaboration in the MVP. That
  is phase 6 (CRDT over ephemeral events), not phase 1.
- **Non-goal:** end-to-end encryption of page content. A "private" NIP-29 group
  is access-restricted, not encrypted — the relay sees plaintext. See
  [09](09-security-privacy.md).
- **Non-goal:** parity with the full Confluence feature set (macros, Jira
  integration, blueprints, per-page permissions).
- **Non-goal:** signing in by pasting an nsec. Never. NIP-07 in phase 1, NIP-46
  (bunker) later.
- **Non-goal:** our own backend server with a database. The client talks to
  relays directly.

## The fundamental tension that shapes the design

Confluence has *one* canonical page. Nostr has *events per author* — an
addressable event (`30xxx`) is always unique per `(kind, pubkey, d tag)`, so it
belongs to exactly one key pair. Two people cannot replace the same addressable
event.

The resolution: a page's identity is not an event but the pair
`(group id, slug)`, and the content lives in immutable revision events that form
a chain via `parent-rev`. That makes "one page, many authors" expressible
without anyone having to overwrite someone else's event. Details in
[02](02-data-model-events.md) and [05](05-versioning-history.md).
