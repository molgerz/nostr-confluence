# 07 — Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Build | Vite + TypeScript | Statisches Bundle, kein Server nötig; deploybar auf jedem Static Host |
| UI | React | Größtes Ökosystem für Editor/Diff-Komponenten |
| Nostr | **`nostr-tools`** (entschieden in Phase 1) | `pool.automaticallyAuth` signiert NIP-42-Challenges automatisch, `pool.publish` wiederholt nach `auth-required` — genau die Haken, die [03](03-auth-nip07-nip42.md) verlangt. Dazu `nip19` für npub und `verifyEvent` |
| Verworfen | NDK (`@nostr-dev-kit/ndk`) | Cache- und Event-Abstraktionen stehen unserem eigenen Revisions-DAG im Weg; die AUTH-Haken sind bei nostr-tools direkter zugänglich |
| Cache | **noch keiner** | Geplant war IndexedDB für Sofort-Rendern und Offline-Lesen. Bisher lebt alles im Speicher und wird bei jedem Laden neu vom Relay geholt → offen |
| State | **eigene Stores** (`useSyncExternalStore`) | Zustand war geplant, wurde aber nicht gebraucht: der Space-Zustand hängt an Relay-Abos, die ohnehin ein eigener Store sind. Eine Bibliothek hätte nur eine Schicht dazwischen gelegt |
| Markdown rendern | `react-markdown` + `remark-gfm` + **`rehype-sanitize`** | Inhalte kommen von beliebigen npubs → Sanitizing ist Pflicht, nicht Option |
| Editor | CodeMirror 6 (`@codemirror/lang-markdown`) | Robust, große Dokumente, gute Selektions-API für Inline-Kommentare später |
| Diff | `diff` (jsdiff), `diffArrays` auf Zeilen-Arrays | Zeilen- und Wort-Diff, Basis für Blame und 3-Wege-Merge |
| 3-Wege-Merge | **selbst geschrieben** (`src/domain/merge.ts`) | jsdiff v8 hat kein `merge` mehr. Der eigene Merge ist knapp 100 Zeilen, vollständig getestet und wir bestimmen die Konfliktdarstellung selbst |
| Styling | Tailwind, `dark`-Variante an `data-theme` gekoppelt | Atlassian-artige Dichte in Tokens; manuelle Hell/Dunkel-Umschaltung nötig → [12](12-theming.md) |
| Syntax-Highlighting im Editor | CodeMirror (`@codemirror/lang-markdown`) | Deckt den Editor ab |
| Syntax-Highlighting in der Anzeige | **noch keins** | Codeblöcke werden ungefärbt gerendert. Shiki mit Dual-Theme war geplant → offen |
| Suche | **selbst geschrieben** (`src/domain/search.ts`) | MiniSearch war geplant; für die Titel- und Zeilensuche über die geladenen Seiten reichen 60 Zeilen ohne Abhängigkeit und ohne Index, der veralten kann |
| Unit-Tests | Vitest | Kettenlogik (Head, Merge, Blame, Suche) ist reine Funktionslogik → 73 Tests |
| End-to-End-Tests | **noch keine** | Playwright war geplant, auch für die Farbmodus-Regression aus [12](12-theming.md). Bisher wird von Hand im Browser geprüft → offen |

## Konfiguration

`.env.example` zeigt die beiden Schalter: `VITE_RELAY_URL` für das
Gruppen-Relay und `VITE_PROFILE_RELAYS` für die Relays, von denen Profile
(Kind 0) geholt werden. Zweiteres ist nötig, weil ein NIP-29-Relay Kind 0 gar
nicht annimmt — dort braucht jedes Event einen `h`-Tag. Ohne Konfiguration
zeigt die App npubs statt Namen, und das ist ehrlicher als ein erfundener Name.

## Struktur des Codes

So sieht sie tatsächlich aus:

```
src/
  nostr/     kinds.ts (alle Kinds und Tags), client.ts (Relay, NIP-42),
             signer.ts, space-store.ts, profile-store.ts, publish-page.ts,
             publish-comment.ts, moderation.ts, blossom.ts, relay-status.ts
  domain/    revision.ts, pages.ts, merge.ts, blame.ts, diff.ts, search.ts,
             comment.ts, toc.ts, group-state.ts   — reine Funktionen, getestet
  session/   session.tsx   (Anmeldung, Sitzung, Account-Wechsel)
  theme/     theme.tsx     (System/Hell/Dunkel)
  ui/        layout/ und Bausteine (Markdown, DiffView, PageEditor, …)
  routes/
  dev/       fake-nip07.ts (nur im Entwicklungsmodus)
```

Abweichungen vom ursprünglichen Plan, jeweils mit Grund:

- **Kein `data/`-Ordner.** Die geplante Cache-Schicht ist nicht gebaut; was
  von ihr gebraucht wurde (Abos, Zustand pro Space), liegt in
  `nostr/space-store.ts`.
- **Andere Dateinamen in `domain/`.** Statt `revision-graph.ts` und `tree.ts`
  gibt es `pages.ts` (Head-Auflösung, Baum, gemeinsamer Vorfahre) und
  `revision.ts` (Event → Revision). Dazu kamen `diff.ts`, `search.ts`,
  `comment.ts` und `toc.ts`.
- **`session/` und `theme/` als eigene Ordner**, weil beides
  React-Kontext ist und weder Domäne noch Nostr-Schicht.

Unverändert gilt: alles in `domain/` ist netzwerkfrei und getestet — das ist
der Kern der Anwendung.
