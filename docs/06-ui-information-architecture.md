# 06 — UI & information architecture

## Layout (modelled on Confluence)

```
┌───────────────────────────────────────────────────────────────────┐
│ Logo        Search…  [+ Create]              Theme   Account     │  top bar 48px
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
   ([02](02-data-model-events.md)). Every row carries a page icon; the active
   row is highlighted.

   A branch with children folds away behind a triangle, a leaf shows a dot in
   that same slot. Both occupy it, so titles stay on one vertical line instead
   of stepping in and out depending on whether a sibling happens to have
   children. A forked page keeps its own marker, but amber and *after* the
   title — otherwise it would read as the leaf dot.

   Which branches are folded is kept in `localStorage`. Deliberately the
   *folded* ones rather than the open ones, otherwise a page created later would
   stay hidden until somebody expanded its parent. The branch leading to the
   page being read is always drawn open, so a fold can never hide the very page
   you are on.
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

Three columns, not a row: the two outer ones share the remaining width equally,
so **search and "+ create" sit on the centre line of the window** whatever the
logo or the account chip happen to be doing. In a plain flex row they would
drift off centre the moment one side grew — and a display name is exactly the
kind of thing that grows. The two belong next to each other because one finds a
page and the other makes the one that was not found.

Logo, search, "+ create", the **theme switch (system/light/dark,
[12](12-theming.md))** and, when signed out, a **sign-in button that calls the
extension directly** — there is no sign-in page. Signed in it becomes the
account chip: the picture alone at the very edge, with name and npub in the
tooltip. The whole chip is one link to `/settings/profile`. Signing out is
**not** in the bar but at the bottom of that page — the outermost corner of the
layout should not put a destructive action right next to a navigation target.

## The reading surface

A page is a document, not a dialogue box, and is sized like one: 16px body text
in `--text-primary` (not the muted grey the surrounding UI uses), a heading
scale that steps down visibly, and a line length capped at 70 characters.
The cap matters because the content column is far wider than that — without it
a line runs to about 100 characters and the eye loses the start of the next one.
Tables and code blocks are exempt: they may exceed the measure and scroll
instead of squeezing.

The same renderer serves comments, but at a second density: a comment sits
inside somebody else's page and stays at the 14px of the surrounding UI rather
than competing with the page it hangs under.

## Page states

| State | What is shown |
|---|---|
| Reading | Rendered Markdown, table of contents on the right, byline, action bar |
| Editing | Editor with a preview toggle, save/cancel, a "what did you change?" field → `summary` |
| Conflict | Banner "this page has N open versions" plus a "merge versions" button; the merge itself happens in the editor, not in a dialog |
| Signed out | Write actions replaced by "sign in with Nostr to edit"; reading works. The button signs in **where it stands** — you never leave the page |
| Sign-in failed | A strip under the top bar with the reason. If no `window.nostr` exists it also says which extensions are common and that the app stores no key. Only after an attempt, never unprompted |
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

The dividing line is **verification, not presence**.

Where somebody is checking who did what — **history, blame, the member list** —
the row carries avatar + display name + shortened npub (`npub1qz…7k4f`,
monospace). Display names are freely chosen and not unique, so a name alone
could be somebody impersonating somebody else, and these are exactly the screens
somebody opens to decide whether to trust a change or a member.

Everywhere else the name stands alone, because the key would be noise:

- **One's own account chip in the top bar.** Nobody has to tell themselves
  apart from an impostor, and the bar is the narrowest strip in the layout.
- **The byline of a page** ("last edited by …"). It says who touched the page,
  not who signed which revision; the history is one click away and answers that.
- **Comments.** A comment is somebody speaking, not a claim about authorship of
  the page. Whoever wants the key hovers the name or opens the history.

In both the npub stays in the tooltip and appears in full under
`/settings/profile`. And where a key has no `kind 0` at all, the shortened npub
is shown regardless — there is no name to fall back to, and an unattributed
byline would be worse than a key.

## Profile

`/settings/profile` edits one's own `kind 0`: the three fields NIP-01 names —
`name`, `about`, `picture`. Three things make this more than a form:

- **Kind 0 is replaceable.** A save replaces the whole profile, so serialising
  only the fields we know would delete what another client has set (`nip05`,
  `lud16`, `banner`). The editor reads the existing event, writes into it and
  names the preserved keys in the UI, so that "I only see three fields" does not
  read as "the rest is gone".
- **It cannot be published to the space relay.** A NIP-29 relay demands an `h`
  tag on every event and rejects `kind 0`. The target is `VITE_PROFILE_RELAYS`;
  with none configured, saving is disabled and the reason is stated.
- **Several relays mean "saved" is not one boolean.** Every relay is listed with
  the reason it gave, literally — the same rule as for publishing a page.

The page also carries what used to be the sign-in page: **Connection** (signer,
space relay, NIP-42 state, profile relays) — the things that matter when a save
fails — and **sign out** at the bottom, with what it does spelled out: it only
forgets which npub is signed in here. The key stays in the extension, published
events stay on the relay.

### Why there is no `/login`

Signing in is one dialog in the extension. A page for it meant leaving whatever
you were reading, and then a `?next=` mechanism to get back. Both are gone:
`SignInButton` calls `login()` wherever it sits, and `SessionNotice` shows the
one thing the page was genuinely needed for — the reason it did not work. A
click that visibly does nothing, for somebody without an extension, is the worst
of the possible states.

## Routing

```
/                          space selection
/s/:group                  space overview (metadata, members, page list)
/s/:group/new              create a page  (?parent=<slug> for a subpage)
/s/:group/search           search         (?q=…)
/s/:group/:slug            read a page
/s/:group/:slug/edit       edit           (?merge=1 to merge versions)
/s/:group/:slug/history    history with comparison
/s/:group/:slug/blame      line origin
/settings/profile          edit one's own kind 0
```

`:group` includes the relay host (URL-encoded) so that a link is
self-contained: `/s/relay.example.com'engineering/onboarding`.
