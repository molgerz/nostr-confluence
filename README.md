# nostr confluence

A Confluence-like wiki that runs entirely on Nostr: sign in with NIP-07, spaces
are NIP-29 groups, pages are Markdown events, and the version history is a chain
of signed, hash-linked revisions — every change cryptographically bound to an
npub.

> **Prototype — not ready for production.** A space can currently only be
> created from the command line (`nak`); the app itself cannot create a group.
> Everything runs locally without TLS, and the event format may still change.
> Reasons in detail: [NOSTR.md](NOSTR.md#right-now-a-prototype-not-for-production).

**Status: phases 0 through 5 are done.** Sign-in with NIP-07, a space with
members and a page tree, creating and editing pages, three-way merge on
concurrent saves, version history with diff, line attribution and restore — all
against a real NIP-29 relay. On top of that: search, comments, moderation,
display names, a mobile layout, a CodeMirror editor and attachments via Blossom.
Still open: real-time editing and NIP-46 sign-in. The design docs live in
[`docs/`](docs/), the phase plan in [`docs/10-roadmap.md`](docs/10-roadmap.md).

## Running it locally

Three terminals, or use `just`:

```bash
./scripts/dev-relay-up.sh     # a real NIP-29 relay on ws://localhost:8080
./scripts/dev-group-seed.sh   # space, members and sample pages via nak group
npm install && npm run dev    # the app on http://localhost:5273
```

Optional, for attachments and display names (see [`.env.example`](.env.example)):

```bash
node scripts/dev-blossom.mjs  # attachments on http://localhost:3355
nak serve --port 10577        # profiles (kind 0), which a NIP-29 relay rejects
```

Groups are managed exclusively through `nak group`, never through self-signed
`39000` events — the reasoning is in [`AGENTS.md`](AGENTS.md), the relay details
in [`docs/08-relay-setup.md`](docs/08-relay-setup.md). Port 5273 instead of 5173
because 5173 is taken by a container on this machine.

## The idea in four sentences

1. A *space* is a NIP-29 group on a relay. The relay is the access authority —
   it decides who may write, not the client.
2. A *page* is not a single event but a chain of immutable revision events. That
   chain *is* the version history.
3. Every revision is signed by an npub and points at its predecessor via
   `parent-rev` — the same idea as a Git commit, expressed as a Nostr event.
4. The client never holds a private key. Signing is done by the NIP-07
   extension.

Which NIPs, event kinds and tags are involved — including where we deviate from
the specs — is documented in [NOSTR.md](NOSTR.md).

## Reading the design docs

Start here: [docs/README.md](docs/README.md)
