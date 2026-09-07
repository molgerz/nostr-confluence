# 04 — Permissions: NIP-29 groups

## The basic principle

With NIP-29 **the relay is the authority**. It knows the members, checks every
incoming event carrying an `h` tag to see whether the sender may write, and
otherwise rejects it with `OK false`. The client enforces nothing — it only
displays what it knows and expects to be rejected.

A group is identified as `<relay-host>'<group-id>`, for example
`relay.example.com'engineering`. The relay is part of the space's identity.

## Relay-generated state events (read only)

| Kind | Contents | Use in the UI |
|---|---|---|
| `39000` | Name, picture, `about`, flags, `supported_kinds` | Space header in the sidebar, visibility badge |
| `39001` | Admins with roles | Moderation controls shown only to admins |
| `39002` | Members | Member list, "member" badge on revision authors |
| `39003` | Available roles | Role selection when inviting |

These events are signed by the relay, not by users. They are a basis for display
and filtering, not proof.

## User events for administration

| Kind | Action | Who |
|---|---|---|
| `9007` | Create group | whoever is allowed (relay-dependent) |
| `9002` | Edit metadata (name, picture, flags) | admin |
| `9000` | Add member / set role | admin |
| `9001` | Remove member | admin |
| `9005` | Delete event (moderation) | admin |
| `9009` | Create invite code | admin |
| `9021` | Request to join (optionally with a code) | anyone |
| `9022` | Leave | member |

### Flags in `39000` (as of the current NIP-29 implementation)

Checked against `fiatjaf.com/nostr/nip29` (2026-09-07): the metadata knows the
tags `private`, `restricted`, `closed`, `hidden`, `livekit`, `supported_kinds`
as well as `parent`/`child` for nested groups.

| Tag | Effect when present | When the tag is missing |
|---|---|---|
| `restricted` | Only members may publish | **Non-members may publish** |
| `closed` | Joining requires an invite or approval | Anyone may join |
| `private` | Content readable by members only | Content publicly readable |
| `hidden` | Group not listed by the relay | Group is discoverable |
| `supported_kinds` | List of accepted kinds | Unspecified |

Measured against a running `groups_relay` on 2026-09-07:

- A newly created group is **`private` + `closed`** — not open. Opening it is a
  separate step.
- `apply_tags` in the relay is **additive**: a flag only changes when the
  corresponding tag is present in the `9002`. So `public` and `open` have to be
  sent explicitly, otherwise the group stays private.
- While a group is `private`, the relay does **not** serve its metadata to
  unauthenticated readers at all (log: "User is not authenticated, cannot see
  event … kind 39000") — no error, simply empty.
- Once it is `public`, the relay code says "Public groups are always visible":
  reading without signing in works. That keeps the promise from
  [06](06-ui-information-architecture.md) that reading needs no login — but only
  for public spaces.

The important part for us: **leaving a flag out** is the open variant. So for
requirement 4 we set neither `restricted` nor `closed` nor `private`. And
`supported_kinds` should contain `1818` — the app reads the tag and warns
otherwise.

`parent`/`child` allow nested groups. That is a possible alternative to our
page-based tree should spaces ever need sub-spaces. **Open**, deliberately not
in the MVP.

## Requirement 4: "anyone may edit, in principle"

In the NIP-29 model this is a combination of flags:

- **`open`** — join requests (`9021`) are accepted automatically. Whoever knows
  the group becomes a member and may therefore write.
- **`public`** — the group's content is readable without membership.

**MVP decision:** the space is `public` + `open`. The effect: anyone with an
npub can read, and can write after a single click ("join this space"). No admin
has to approve anything.

**Checked against the source of `verse-pbc/groups_relay` (2026-09-07):** in an
`open` group the author is added as a member when posting ("Open groups
auto-join the author when posting"), and `39002` is updated in the process. An
explicit `9021` join is therefore unnecessary there — writing is enough.

Only the auto-join case is implemented so far: the app publishes directly, and
in an open group the relay adds the author while doing so. A rejection is shown
with the relay's own reason.

**Open** for relays without auto-join: on a rejection citing membership, send a
`9021`, wait for the new `39002` and publish again — including the UI states
"joining" and "join rejected".

## What is implemented in the app

The space overview shows the member list from `39002` with the roles from
`39001`. Admins additionally get a field to add someone by npub or hex (`9000`)
and a remove button per member (`9001`). In the history and in comments, admins
can remove individual events (`9005`), with a confirmation prompt because the
relay really enforces that deletion.

All of these actions are **requests**: the relay checks who is an admin and
rejects otherwise. That is why the app never corrects the member list locally —
it shows whatever the relay sends back as the new `39002`.

## The permission levels we model

| Level | How it is enforced |
|---|---|
| Reading | Relay: for `private`, members only (after NIP-42 AUTH) |
| Writing / editing | Relay: the sender must be a member (`h` tag check) |
| Moderating (delete, members) | Relay: the sender must be an admin (`39001`) |
| Locking a page ("only admins may change this page") | **not** enforceable by the relay |

The last row is a genuine limit: NIP-29 knows permissions per group, not per
page. A "locked page" would only be a UI convention that another client can
ignore. **Decision:** we do not build page locking and say so openly instead of
displaying fake security. Anyone who needs pages with tighter permissions gets
their own space.

## What a malicious relay can do

- Withhold events (show an incomplete history). NIP-29 timeline references
  (`previous`) would make gaps detectable, but we do not write that tag yet and
  `groups_relay` does not verify it — so this is currently only mitigated by the
  client noticing missing links in the `parent-rev` chain
  ([09](09-security-privacy.md)).
- Forge member lists → affects display only; authorship of revisions stays
  unassailable because of the signature.
- Not possible: writing content in someone else's name. Without their private
  key there is no valid signature.
