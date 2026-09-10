# Notes for AI agents working in this repo

Project: a Confluence-like wiki on Nostr. The full design lives in
[`docs/`](docs/README.md) — that is where the reasoning behind every decision
is. This file only contains working rules.

## Always manage groups with `nak group`

**Rule:** NIP-29 groups are created and modified exclusively through
`nak group` — `create-group`, `edit-metadata`, `put-user`, `remove-user`,
`create-invite`, `delete-event`. Never sign and publish the relay-generated
events `39000`, `39001`, `39002`, `39003` yourself.

**Why:** with NIP-29 the relay is the authority. Self-signed metadata events are
a stand-in: they look right in the client, but the relay enforces nothing,
membership and roles are fiction, and behavioural differences from a real relay
surface late.

**Consequence:** a relay that really implements NIP-29 has to be running.
`nak serve` does not (its NIP-11 lists no NIP 29, and `9007`/`9000` are only
stored raw). Therefore:

```bash
./scripts/dev-relay-up.sh     # verse-pbc/groups_relay on :8080 (natively via cargo)
./scripts/dev-group-seed.sh   # group and members via nak group
```

The build runs natively through cargo because the bundled `Dockerfile.dev` fails
at `cargo build --features console`. Without Rust the script falls back to
Docker with the production Dockerfile.

`nak serve` is only admissible for work without Docker and without group logic
(for example pure event-format checks) — and then without faked group metadata.

`nak group` is a **client**, not a relay: it does not replace a running relay.

## Addressing groups with nak

`nak group <command> <address>` accepts two forms:

- NIP-AD web address `host/group` — resolved via
  `https://<host>/.well-known/nostr.json`, so it does **not** work against
  `localhost` without TLS.
- `naddr1…` — always works:
  `nak encode naddr -d <group> -k 39000 -a <relay-pubkey> -r <relay-url>`

The relay pubkey comes from the NIP-11 document (`nak relay <url>`, field `self`
or `pubkey`).

## nak against `groups_relay`: which flags when

Measured on 2026-09-07. Without these rules commands come back empty or hang:

| Call | Flags | Reason |
|---|---|---|
| `nak req`, reading in general | `--fpa --sec <key>` | For private groups the relay **silently** filters out unauthenticated readers instead of rejecting with `auth-required`. `--auth` only reacts to a rejection and therefore never fires; `--fpa` (force-pre-auth) waits for the challenge |
| `nak event` (publishing) | `--fpa --sec <key>` | Works; `--auth` alone is often enough, `--fpa` is more reliable |
| `nak group create-group` | **only** `--sec` | With `--fpa` the command hangs: it reads metadata before publishing and waits there for a challenge that never arrives on that path |
| `nak group put-user` | `--fpa --sec` | Works |
| `nak group info`, `members`, `edit-metadata` | — | **Unusable against this relay.** They call `fetchGroupMetadata` through nak's internal pool, which knows no AUTH; `info` hangs forever. Check state with `nak req -k 39000 -k 39001 -k 39002` instead |

Two substantive consequences:

- **Opening a group needs a raw `9002`.** The relay creates groups as `private`
  + `closed`. `nak group edit-metadata` omits the `public` and `open` tags when
  those flags are false — but `apply_tags` in the relay is additive and only
  changes what is present as a tag. `private` could therefore never be cleared.
  Hence one
  `nak event -k 9002 -h <group> -t public= -t open= …`. That is still the
  intended NIP-29 path (a moderation event the relay evaluates) and **not** a
  self-signed `39000`.
- **Kind 0 is rejected.** A real NIP-29 relay requires an `h` tag on every
  event; profiles belong on the user's own relays (`VITE_PROFILE_RELAYS`).
  Locally the app therefore shows npubs instead of names.

## Ports on this machine

| Purpose | Port | Reason |
|---|---|---|
| App (Vite) | 5273 | 5173 is taken by a container |
| NIP-29 relay | 8080 | — |
| `nak serve` (emergencies only) | 10577 | 10547 is taken by a relay container |
| Blossom dev server | 3355 | — |

## Small things that cost time

- **zsh:** `GID` is a reserved variable. `GID=engineering` fails with "failed to
  change group ID". Use `GROUP_ID` in scripts.
- **Every** nak call in a script needs `</dev/null` — including
  `nak key public`. Otherwise they block on stdin when the script runs from a
  pipe. `nak event` without `-c` waits on stdin as well.
- nak exits with 1 for expected states (for example "Group already exists").
  With `set -e` a script dies silently at that point — add `|| true` and check
  the output yourself.
- Ephemeral events (20000–29999) are rejected by `nak serve` with
  `mute: no one was listening for this` when nobody has subscribed. That is not
  a permission problem.

## Traps in the Nostr layer

- **Do not overwrite `relay.onclose`.** `SimplePool.ensureRelay` installs its
  own handler there which removes the dead connection from the registry.
  Replacing it means the next `ensureRelay` hands back the same dead object.
  Chain onto it instead of replacing it.
- **Subscriptions die with their connection.** After a reconnect or a signer
  change (AUTH is per connection) all subscriptions have to be set up again. The
  client counts an `epoch` per relay for exactly this.
- **`pool.get` has no `onauth` hook.** On a relay with enforced NIP-42 it
  silently returns empty results. Read through `subscribeEose` with `onauth`.
- **`subscribeEose` closes on EOSE.** That is too early for the echo of an
  ephemeral event — use `pool.subscribe` there.
- **`useSyncExternalStore` needs a memoised `subscribe` function.** A new
  function identity per render resubscribes; if the store starts something while
  doing so, the loop never ends.

## Conventions

- Documentation, code comments and commit messages in English.
- Tickets, PR descriptions and other write-ups about this project are always in English.
- Kind numbers and tag names only in `src/nostr/kinds.ts`.
- Before every commit: `npm run typecheck && npm run build && npm test`.
- Placeholders in the UI name their phase from `docs/10-roadmap.md`.
