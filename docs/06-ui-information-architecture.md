# 06 — UI & information architecture

## Layout (modelled on Confluence)

```
┌───────────────────────────────────────────────────────────────────┐
│ Logo   Search…                    [+ Create]   Theme   Account   │  top bar 48px
├──────────────┬────────────────────────────────────┬───────────────┤
│ Space header │ Breadcrumb: Handbook / Onboarding  │ On this page  │
│ Engineering  │                                    │               │
│ public       │ # Onboarding                       │  · Goal       │
│              │                                    │  · Access     │
│ Overview     │ last edited by carol · 11:40       │  · Contact    │
│ Search       │ [Edit][History][Line origin]       │               │
│              │                                    │               │
│ ▾ Handbook   │ Markdown content …                 │               │
│   · Onboard. │                                    │               │
│   · Tooling  │                                    │               │
│ ▸ Processes  │                                    │               │
│              │                                    │               │
│ + New page   │                                    │               │
└──────────────┴────────────────────────────────────┴───────────────┘
   224px                 flexible, max 5xl              176px
```

## The left bar — requirement 2 in detail

Four zones, top to bottom:

1. **Space header** — name and picture from `39000`, a `public`/`private`
   badge. **Open:** a space switcher and a "join" button for non-members.
2. **Fixed entries** — *Overview* and *Search* are implemented. The member list
   and moderation live on the overview page rather than in the bar.
   **Open:** dedicated entries for "all pages", "recently changed" and "space
   settings".
3. **Page tree** — projected from `page-parent`
   ([02](02-data-model-events.md)). The active page is highlighted; forked pages
   are marked with a dot.
4. **Footer** — "+ new page" and the relay status (connected / AUTH / offline) —
   important, because nothing can be published without a relay.

Behaviour: collapsible to 40px, state kept in `localStorage`. Below 768px width
the bar disappears entirely and is shown as an overlay via a menu in the top
bar; after navigating it closes again.

The right-hand bar ("on this page") is derived from the headings of the
displayed Markdown and appears from 1280px width once there are at least two
headings. Headings inside code blocks do not count — a `# comment` in a shell
example is not a heading.

## Top bar

Logo, search, "+ create", the **theme switch (system/light/dark,
[12](12-theming.md))** and the account chip with display name, npub and sign-out.

## Page states

| State | What is shown |
|---|---|
| Reading | Rendered Markdown, table of contents on the right, byline, action bar |
| Editing | Editor with a preview toggle, save/cancel, a "what did you change?" field → `summary` |
| Conflict | Banner "this page has N open versions" plus a "merge versions" button; the merge itself happens in the editor, not in a dialog |
| Signed out | Write actions replaced by "sign in with Nostr to edit"; reading works |
| Publish failed | Error message in the editor with the **literal relay reason**, classified by cause (AUTH needed, permissions, other). The text stays in the editor, nothing is lost |

The last state is mandatory, not a nicety: with distributed storage, "saved"
must never be claimed before the relay has sent `OK true`.

**Solved differently than planned:** instead of a yellow "saved locally only"
strip, the editor simply stays open and shows the relay's reason. A draft that
lives only in the browser would be a second storage location with its own
questions (where? for how long? what on account switch?) — that would need the
local cache that has not been built yet.

## Editor

- **Implemented**: CodeMirror 6 with Markdown highlighting and a preview
  toggle, a field for the change note, an automatically derived slug and a
  selectable parent page. The colour mode is swapped through a `Compartment` so
  that cursor and undo history survive the switch.
- **Planned**: a toolbar for headings/lists/links/code blocks. Images can
  already be attached via button or drag & drop (Blossom).
- **Later**: WYSIWYG (TipTap) producing Markdown. Deliberately not first,
  because WYSIWYG plus merge conflicts at the same time is too much risk.

## How identity is displayed

Everywhere a person appears: avatar + display name + shortened npub
(`npub1qz…7k4f`, monospace). Display names are freely chosen and not unique —
the npub is the identity, and the UI shows that consistently instead of hiding
it.

## Routing

```
/                          space selection
/login                     NIP-07 sign-in
/s/:group                  space overview (metadata, members, page list)
/s/:group/new              create a page  (?parent=<slug> for a subpage)
/s/:group/search           search         (?q=…)
/s/:group/:slug            read a page
/s/:group/:slug/edit       edit           (?merge=1 to merge versions)
/s/:group/:slug/history    history with comparison
/s/:group/:slug/blame      line origin
```

`:group` includes the relay host (URL-encoded) so that a link is
self-contained: `/s/relay.example.com'engineering/onboarding`.
