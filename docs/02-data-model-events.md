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
| `30818` | User | Page head as a NIP-54 wiki article (interop mirror, optional) |
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
- **`d`** — the page's normalised slug (`lowercase-with-hyphens`). Single-letter
  tags are indexed by relays, so they can be filtered with `#d`.
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

## Page head (`30818`) — deliberately only a mirror

Every save may additionally write a NIP-54 wiki article `30818` with
`d = slug`, `h = group` and `rev = <revision id>`. The benefit: other Nostr wiki
clients can read the page, and lists load quickly.

**Important:** `30818` is unique per `(kind, pubkey, d)`, so it exists once *per
author*. It is therefore never the truth about a page's content, only a hint.
The truth is the revision chain. That separation is the reason "anyone may edit"
works at all.

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
