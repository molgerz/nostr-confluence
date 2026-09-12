# 03 — Sign-in: NIP-07 and NIP-42

## What NIP-07 is

A browser extension (Alby, nos2x, Nostr Connect …) provides `window.nostr`. The
app calls into it:

| Call | Purpose |
|---|---|
| `getPublicKey()` | Pubkey in hex → identity, rendered as `npub…` via NIP-19 |
| `signEvent(event)` | Signs an event. The private key never leaves the extension |
| `getRelays()` | The user's suggested relay list (optional) |
| `nip44.encrypt/decrypt` | Only relevant once we encrypt private content (not in the MVP) |

**Decision:** the app never stores a private key and offers no field for one.
All signing goes through the extension.

The session is implemented as **the pubkey** in `localStorage` (`nc-pubkey`) —
the originally planned timestamp was dropped because there is no expiry for it
to drive: a session is valid as long as the extension reports the same account,
and exactly that is checked before every write. A NIP-46 session adds
`nc-nip46` beside it; `nc-pubkey` stays the single statement of which identity
is signed in.

## The flow

1. **Detect** — after mounting, wait briefly for `window.nostr` (extensions
   inject asynchronously; poll for ~500 ms). If it is missing, show a hint page
   linking to Alby/nos2x instead of a login button that does nothing.
2. **Identity** — `getPublicKey()`. This opens the extension's dialog, so it
   must come from a user action (a click), not from page load.
3. **Profile** — load the user's `kind 0` for name and avatar. Falls back to a
   shortened `npub1abc…xyz` when no profile exists.
4. **Relay AUTH (NIP-42)** — on connect the NIP-29 relay sends
   `["AUTH", "<challenge>"]`. The client signs a `kind 22242` event carrying
   `relay` and `challenge` tags and answers with `["AUTH", <event>]`. Only then
   may it write to groups and read private ones.
5. **Session active** — load the group list (`39002`, filtered by the user's own
   pubkey → "my spaces") and render the sidebar.

## Practical pitfalls

- **A second signing dialog**: `getPublicKey()` and AUTH are two dialogs. Alby
  remembers permissions per domain, but the UI should still explain why it asks
  twice.
- **Repeating AUTH**: a reconnect brings a new challenge. The data layer has to
  perform AUTH again automatically, otherwise the next publish fails silently.
  Publish failures (`OK false` with reason `auth-required`) must run into a
  retry after AUTH.
- **Multiple accounts**: if the extension switches accounts mid-session, the
  pubkey must be fetched again before every publish and compared with the
  session. On a mismatch, restart the session rather than sign as someone else.
- **No anonymous reading**: signing in is not a step that unlocks writing on top
  of reading — it is the entry itself. Akasha is for closed teams, so a space is
  readable only by npubs an admin has added, and the membership check needs an
  authenticated pubkey. Signed out, there is nothing to show at all: the relay
  withholds even the group's name ([04](04-permissions-nip29.md)). An earlier
  draft of this document had reading work anonymously in public spaces; there
  are no public spaces.

## NIP-46 (bunker / remote signer)

Without an extension there is no way in — and on a phone there is usually no
extension to install. NIP-46 closes that gap: the identity key lives in a
remote signer ("bunker", for example Amber or nsec.app) and the app asks it to
sign over a relay. It is a second `Signer` implementation
(`src/nostr/nip46.ts`), not a rewrite.

### The two ways to connect

| Entry | What happens |
|---|---|
| `bunker://…` URI or a NIP-05 address (`you@example.com`) | The pointer names the signer's pubkey and its relays. The app sends `connect` and then `get_public_key`, both bounded. |
| `nostrconnect://…` | The app generates a throwaway client key plus a secret, shows the URI (copyable; no QR code yet), and waits until the signer answers it. The wait is abortable — cancel or unmount ends it. |

Both are offered in `src/ui/ConnectSignerDialog.tsx`, which the sign-in button
opens. The dialog shows them as equals, so a desktop user with an extension is
not forced through the remote flow and vice versa.

### The client key and the session

The app holds **no identity key**. It does hold a throwaway NIP-46 *client*
key — its side of the encrypted channel. That key, the bunker pointer and the
identity pubkey are persisted under `nc-nip46`
(`src/session/nip46-store.ts`), so a reload rebuilds the channel from disk
without asking the phone again. `nc-pubkey` stays the single statement of
*which npub is signed in*; `nc-nip46` only says how to reach the signer.
Sign-out clears both, and a NIP-07 sign-in clears `nc-nip46` as well.

The stored client key is a **communication** key, never the identity key: it
can request signatures from the bunker, and losing it costs one new
connection. An XSS that reads it can ask the signer to sign — no better or
worse than an extension's session. That is why the security document's "No
handling of nsec" is qualified: no *identity* secret is handled.

### Timeouts and slowness

Remote signing is a network round trip plus, usually, a confirmation on a
phone, so it is visibly slower than an extension. `BunkerSigner.sendRequest`
has no timeout of its own, so the adapter bounds every request:

- 60 s per `signEvent`, 120 s per `connect` / `get_public_key`, both
  overridable per call. A timeout surfaces verbatim in the existing error
  surfaces ("the remote signer did not answer within 60s").
- The NIP-42 AUTH budget in `src/nostr/client.ts` grows with the signer kind:
  5 s for an extension, 65 s for NIP-46, so the phone prompt is never declared
  a failure while it is still open.
- Before an event leaves the adapter it is verified; a bunker that returns a
  bad signature is rejected like a bad extension answer.

### What NIP-46 does not have

`BunkerSigner.getPublicKey` caches its answer, so the NIP-07 safety net "the
user switched accounts in the extension" has no NIP-46 equivalent: the bunker
decides which key signs. A remote signer that starts answering as another
identity is only visible at the next write.

The `24133` RPC event and its `p` tag are constructed inside
`nostr-tools/nip46`; the app never writes that kind itself, which is why
`src/nostr/kinds.ts` has no entry for it.
