# 11 — Open questions

Points where there is a recommendation, but the decision belongs to the project
owner.

## 1. Our own kind `1818`, or existing NIPs?

| Option | What it means |
|---|---|
| **A (recommended)** | Our own revision kind `1818`, full-text snapshots, `parent-rev` chain. Cleanly tailored to the use case |
| B | NIP-54 wiki (`30818` + merge requests `818`) as the source of truth. Interop with wiki clients, but one event per author instead of one page |
| C | NIP-34 patches (`1617`) like ngit. A real Git model, but reading requires replaying patches |

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

The working title is `nostr confluence`. "Confluence" is a registered trademark
of Atlassian — for anything published widely, an own name would be advisable.
For an internal project or prototype the working title is uncritical.

## 7. Attachments and images

Nostr does not store files. *(Answered in the meantime: attachments are
implemented via Blossom, see [02](02-data-model-events.md). A Blossom server is
therefore an additional dependency in production; a tiny one for development
ships with the repo.)*
