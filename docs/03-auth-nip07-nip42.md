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

The session is implemented as **just the pubkey** in `localStorage`
(`nc-pubkey`) — the originally planned timestamp was dropped because there is no
expiry for it to drive: a session is valid as long as the extension reports the
same account, and exactly that is checked before every write.

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

## Later: NIP-46

NIP-46 (bunker / remote signer) allows signing in without an extension, for
example on a phone. The interface is the same (`getPublicKey`, `signEvent`),
which is why the signer sits behind a `Signer` interface — NIP-46 then becomes a
second implementation rather than a rewrite.
