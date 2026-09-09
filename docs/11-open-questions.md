# 11 — Open questions

Points where there is a recommendation, but the decision belongs to the project
owner.

## 1. Our own kind `1818`, or existing NIPs?

*Decided: A.*

| Option | What it means |
|---|---|
| **A (chosen)** | Our own revision kind `1818`, full-text snapshots, `parent-rev` chain. Cleanly tailored to the use case |
| B (rejected) | NIP-54 wiki (`30818` + merge requests `818`) as the source of truth. Interop with wiki clients, but one event per author instead of one page |
| C | NIP-34 patches (`1617`) like ngit. A real Git model, but reading requires replaying patches |

B fails on two counts, and both are structural rather than a matter of effort.
`30818` is addressable, so a save **overwrites** — no history, and with it no
diff, no blame, no restore, which is most of why anyone trusts an open wiki. And
its identity `(kind, pubkey, d)` contains the author, so there is no shared page:
A's and B's edits are two different articles. NIP-54's own answer to that is
fork plus a `818` merge request — a fork-based wiki where readers pick an author
to trust. A sound model, a different product than a team space where everyone
works on *one* page.

Taken from NIP-54 anyway: the slug normalisation for the `d` tag
([02](02-data-model-events.md)).

## 2. Snapshot or diff per revision?

Recommendation: snapshot (see [02](02-data-model-events.md)). The alternative
would be storing patches — smaller for large pages, but more expensive to read.
Only relevant for pages beyond roughly 100 kB.

## 3. How open should "open" be?

*Partly decided: running our own relay is settled, and the relay operator may
read along.*

`public` + `open` means any npub in the world can join and write. For an
internal team wiki that is a spam risk. The alternative: `public` (anyone can
read) + `closed` (joining only via invite code `9009`). Requirement 4 sounds
like `open`; the recommendation would be `open` for the prototype and `closed`
plus an invite link once it is used for real.

## 4. Which relay is the authority?

**Decided:** our own relay. Implementation in [08](08-relay-setup.md) —
`nak serve` for phases 0–3, `verse-pbc/groups_relay` from phase 4 onwards.
Remaining question: Rust (`groups_relay`) or Go (`max21dev/groups-relay`), should
we want to patch the relay ourselves.

## 5. Several spaces, or just one in the MVP?

A single space makes phase 2 considerably smaller. Recommendation: make the data
model and routing multi-space capable from the start (costs almost nothing) and
leave the space switcher in the UI for phase 6.

## 6. Name and domain

*Decided (2026-09-09): the working title is `Akasha`.*

"Confluence" is a registered trademark of Atlassian, and it is held for
collaboration software — the very category this project sits in. The old working
title therefore had to go, along with any near variant of it.

*Akasha* is the Sanskrit word for the all-pervading ether; the *akashic record*
is the idea of a register in which every event is kept permanently. That is what
a chain of signed revisions is — nothing overwritten, everything attributable
([05](05-versioning-history.md)).

Known and accepted: [AKASHA](https://akasha.org) is an existing decentralised
social network by Mihai Alisie, a co-founder of Ethereum — the same category
rather than a distant one — and `akasha.org`, `.wiki` and `.dev` are all taken.
Acceptable for a working title; to be revisited before anything is published
widely, together with a real trademark search and the domain question.

## 7. Attachments and images

Nostr does not store files. *(Answered in the meantime: attachments are
implemented via Blossom, see [02](02-data-model-events.md). A Blossom server is
therefore an additional dependency in production; a tiny one for development
ships with the repo.)*
