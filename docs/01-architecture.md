# 01 — Architecture

## The parties involved

```
Browser tab                     Browser extension            Relay
┌──────────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│ UI layer             │        │ NIP-07 signer    │        │ NIP-29 relay      │
│ Nostr data layer     │◄──────►│ (Alby, nos2x)    │        │ group authority   │
│ Local cache          │◄───────┴──────────────────┘        │ event storage     │
└──────────┬───────────┘   signEvent / getPublicKey         └─────────┬─────────┘
           └──────────────────── WebSocket (REQ / EVENT / AUTH) ──────┘
```

There is no backend of our own. Everything a classic wiki does server-side
(permissions, storage, history) is handled by the relay plus the event design.

## Layers in the client

1. **UI layer** — React components: sidebar, page view, editor, history, diff.
   Knows nothing about relays, only domain objects (`Space`, `Page`,
   `Revision`, `Member`).
2. **Domain layer** — translates between Nostr events and domain objects:
   building the page tree from revision events, head resolution, computing
   diffs, detecting conflicts.
3. **Nostr data layer** — relay connections, subscriptions, signing, NIP-42
   AUTH, retries. The only layer that knows `kind` numbers.
4. **Cache layer** — *not built yet.* IndexedDB is planned, for instant
   rendering on reload and offline reading. For now the space store keeps
   everything in memory; after a reload it loads from the relay again, and
   full-text search runs over exactly those loaded pages.

**Decision:** kind numbers and tag names exist in exactly one place in the code
(`src/nostr/kinds.ts`). No magic numbers in components.

## Data flow: opening a page

1. The route `/s/:group/:slug` is opened.
2. *(planned: render a cache hit immediately — see above)*
3. Subscription: all revision events with `#h=<group>` and `#d=<slug>`.
4. The domain layer builds the revision chain and determines the head.
5. The UI renders the head's Markdown plus a byline (npub, time) and a conflict
   banner if the chain has forked.

## Data flow: saving a page

1. The editor knows the base revision it was opened on.
2. Before publishing, the current head is checked again.
3. `head == base` → sign and publish a revision with `parent-rev = base`.
4. `head != base` → three-way merge. The result goes straight into the editor
   with an explanation; nothing is published until a human has looked at it
   ([05](05-versioning-history.md)).
5. After the relay answers `OK`, the UI switches back to reading view.

## Relay strategy

- **One group relay per space** is the authority. A NIP-29 group is identified
  as `<relay-host>'<group-id>` — the relay is part of the identity.
- Additional relays are optional as read replicas or backups (events are signed,
  so they are verifiable even from relays that have no say), but the permission
  check only happens on the group relay.
- **Decided (2026-09-09): no second write path for now.** Mirror relays are not
  written to in the MVP — the permission check only happens on the group
  relay anyway, so a mirror would be a pure read replica or backup, and while
  there is only a local dev environment it protects nothing that loss would
  matter for. It would also actively hurt the invite-only decision if it does
  not enforce group membership, since events are signed and therefore
  verifiable from any relay, including ones with no say over group access.
  To be revisited once a production relay runs on its own domain and holds
  real content — at that point the question shifts from "redundancy?" to
  "what happens on data loss on the one server?".

## Why no backend?

Because any backend only moves the trust question somewhere else. Signatures
plus `parent-rev` provide traceability without having to trust a server, and the
relay stays replaceable because the history lives in the events themselves.
