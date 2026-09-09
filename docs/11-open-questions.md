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

*Decided (2026-09-09): invite-only.*

`public` + `open` would mean any npub in the world can join and write — for an
internal team wiki, a spam risk. The space is therefore `private` + `closed` +
`restricted`: only npubs an admin has added can read, write, or even see that
the space exists. Requirement 4 holds inside that circle — every member edits
every page.

Joining is an admin adding the npub (`9000`), not an invite code: `9009` is
specified but thinly implemented in practice (in `block/buzz` its handler is a
deferred no-op), and `9021` join requests are rejected in private groups anyway.

Measured against the running relay, including the case of a stranger who
authenticates correctly but is not a member — see
[04](04-permissions-nip29.md). Unchanged: the relay operator can read along,
and attachments sit outside this boundary
([09](09-security-privacy.md)).

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
