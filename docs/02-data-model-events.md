# 02 — Data model & events

## Terminology

| Confluence | Here | Nostr equivalent |
|---|---|---|
| Instance | App | Static web app in the browser |
| Space | Space | NIP-29 group on a relay |
| Page | Page | `(group id, slug)` + chain of revisions |
| Version | Revision | Immutable, signed event |
| User | npub | Pubkey from NIP-07 |
| Permission | Membership | Enforced by the relay (NIP-29) |

## Event kinds at a glance

| Kind | Origin | Role |
|---|---|---|
| `0` | User | Profile (name, avatar) for bylines |
| `22242` | User | NIP-42 relay AUTH |
| `39000` | **Relay** | Group metadata: name, picture, `public`/`private`, `open`/`closed` |
| `39001` | **Relay** | The group's admin list |
| `39002` | **Relay** | The group's member list |
| `39003` | **Relay** | Role definitions |
| `9000`–`9009` | User (admin) | Moderation: add/remove member, edit metadata, delete event |
| `9021` / `9022` | User | Join / leave request |
| `9` / `11` / `12` | User | Group chat and threads (space discussion, phase 6) |
| **`1818`** | User | **Page revision — the actual content** |
| `1111` | User | Comment (NIP-22) on a page |
| `5` / `9005` | User / admin | Deletion request, or moderated deletion |

## Attachments

Nostr does not store files. An attachment is uploaded to a **Blossom** server
(BUD-01/02), lives there under its sha256 and appears in the Markdown only as a
URL — the file itself is never inside the event. The upload is authorised with a
kind `24242` event: the server verifies a signature, not a password. Configured
via `VITE_BLOSSOM_SERVER`; without it the attachment button is disabled rather
than failing silently.

A tiny server for local development ships with the repo:
`node scripts/dev-blossom.mjs`.

Before the first publish the app checks the `supported_kinds` tag in `39000`: if
the group lists kinds and `1818` is missing, it warns instead of publishing
blindly ([04](04-permissions-nip29.md)).

**Decision:** `1818` is an application-specific kind in the regular range (so
immutable, not replaceable). NIP-54 uses `818` for merge requests in a wiki
context; `1818` deliberately echoes that but stands on its own.
**Open:** whether to use NIP-34 patches (`1617`) instead — see
[11](11-open-questions.md).

## The core event: page revision (`1818`)

```json
{
  "kind": 1818,
  "pubkey": "<author's npub, hex>",
  "created_at": 1757250000,
  "content": "# Onboarding\n\nWelcome to the team …",
  "tags": [
    ["h", "engineering"],
    ["d", "onboarding"],
    ["title", "Onboarding"],
    ["parent-rev", "<event id of the preceding revision>"],
    ["content-hash", "<sha256 of content>"],
    ["page-parent", "handbook"],
    ["m", "text/markdown"],
    ["summary", "fixed a typo"],
    ["alt", "Wiki page 'Onboarding' in space engineering"],
    ["previous", "a1b2c3d4", "e5f6a7b8"]
  ],
  "id": "…", "sig": "…"
}
```

What the tags mean:

- **`h`** — group id. Mandatory in NIP-29; the relay uses this tag to check
  whether the author may write. This is our entire permission mechanism.
- **`d`** — the page's normalised slug. Single-letter tags are indexed by
  relays, so they can be filtered with `#d`. Normalised exactly as NIP-54
  prescribes for a wiki article's `d` tag, because the same title has to yield
  the same slug in every client — otherwise two people editing "Möbel für das
  Büro" end up on two different pages. See below.
- **`parent-rev`** — event id of the preceding revision. Absent = first
  revision. Present twice = merge revision.
- **`content-hash`** — lets us recognise identical content (restore, no-op save)
  without comparing full text.
- **`page-parent`** — slug of the parent page. The sidebar builds its tree from
  this.
- **`previous`** — NIP-29 timeline references: short ids of recently seen group
  events. Prevents a relay from forging events or re-parenting them into a
  different group history. **Not implemented yet:** the app does not write the
  tag, and `groups_relay` does not verify it anyway
  ([09](09-security-privacy.md)).

**Decision: full-text snapshot instead of a diff.** Every revision carries the
complete Markdown text, not just the change. The reasoning: reading a page then
needs exactly one event instead of replaying a chain, diffs can be computed
client-side from two snapshots, and text pages are small. The `parent-rev` chain
provides the Git semantics, the snapshot provides the convenience. A
patch-based variant can be added later if needed.

## Page identity and head resolution

A page is `(h, d)`. Its current content is the **head** of the revision chain:

1. Load all `1818` events with `#h=<group>` and `#d=<slug>`.
2. Verify signatures, discard events with a foreign `h`.
3. Build a directed graph over `parent-rev`.
4. Determine the leaves (events no other revision points at).
5. One leaf → that is the head. Several leaves → a fork; the UI shows a conflict
   banner and offers to merge ([05](05-versioning-history.md)).

With several leaves the *displayed* one is the newest (`created_at`, ties broken
by the lexicographically smaller `id` — deterministic across clients). The fork
is never hidden.

## The page tree for the sidebar

For each `d` value the head is determined from all `1818` events in the group;
its `title` and `page-parent` produce the tree. No separate index event is
needed — the tree is a projection of the revisions.

- Upside: no inconsistency between index and content.
- Cost: loading a space for the first time means loading many events.
  Mitigation: an IndexedDB cache plus subscribing only from the last known
  `created_at`.
- **Open:** manual sorting of the sidebar (Confluence allows drag & drop).
  Suggestion: an addressable admin event `30820` holding the order, not before
  phase 5.

## The slug — NIP-54's rules

A page is `(group, slug)`, so the slug is its identity and every client has to
derive it from a title the same way. Rather than invent that, we take NIP-54's
normalisation for the `d` tag of a wiki article (`normalizeSlug` in
`src/nostr/kinds.ts`):

- letters with case variants become lowercase,
- whitespace becomes `-`, consecutive `-` collapse, leading and trailing `-` go,
- punctuation and symbols are removed — *removed*, not replaced, so "What's Up?"
  is `whats-up` and not `what-s-up`,
- numbers are kept,
- letters of every script are kept as UTF-8: `Москва` is `москва`, `日本語
  Article` is `日本語-article`, `Möbel` is `möbel`.

The last rule is the one that costs something. Slugs carry umlauts now, in the
`d` tag and in the URL. The alternative — transliterating `ö` to `oe`, which
this app used to do — is friendlier to a German eye but is a rule only we would
apply: no other client would ever arrive at `moebel`, and a page whose slug
nobody else can compute is a page nobody else can link to.

Two deviations, both deliberate:

- **Letters outside the basic multilingual plane are dropped** — historic
  scripts, and the styled pseudo-fonts people paste out of the web. Each of them
  is two UTF-16 units, and nothing in a slug is worth that. A title made only of
  those normalises to nothing, and the editor then refuses to save and says why
  (`src/ui/PageEditor.tsx`).
- **The result is capped at 96 characters.** A slug is also a URL segment.

## No NIP-54 mirror (`30818`) — decided against

The idea was to write a NIP-54 wiki article alongside every revision, with
`d = slug` and `rev = <revision id>`, so that other Nostr wiki clients could
read a page. It is not going to happen, and not because of the effort.

`30818` is addressable, and an addressable event is identified by
`(kind, pubkey, d)`. The author is part of its identity, so a mirror exists once
**per author**: on a page that two people edit there would be two events
claiming to be the same page, and nothing but `created_at` to say which is
current — a mirror written by somebody who has not edited in months looks just
as authoritative as today's. The mirror would be structurally incapable of
saying what the page *is*.

That is the same reason `30818` cannot be the source of truth either
([11](11-open-questions.md)): "one page, many editors" is not expressible as a
replaceable event on Nostr at all, because every replaceable event's identity
contains its author. Hence `(group, slug)` plus a revision chain.

A wiki client that wants to read our pages can read this document instead. What
we do take from NIP-54 is its slug normalisation, rule for rule
(`src/nostr/kinds.ts`).

## Comments (`1111`) — implemented

A NIP-22 comment, anchored to `h` (group) and `d` (slug), with `K = 1818` for
the kind of the root object, `k` for the kind of the direct parent and `e`
pointing at the parent comment in replies.

**Deviation from the letter of the NIP:** NIP-22 points at a single root event
via `A`/`E`. Our page *is* not a single event but the pair `(group, slug)` — a
reference to one revision would dangle after the next edit and orphan the
thread. Hence the same anchoring the revisions use.

**Open:** inline comments on a text selection (quote anchors). Needs a selection
API in the editor, and therefore CodeMirror.
