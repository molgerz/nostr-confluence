# 07 — Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Build | Vite + TypeScript | Statisches Bundle, kein Server nötig; deploybar auf jedem Static Host |
| UI | React | Größtes Ökosystem für Editor/Diff-Komponenten |
| Nostr | **NDK** (`@nostr-dev-kit/ndk`) | Bringt NIP-07-Signer, NIP-42-AUTH-Handling, Relay-Pools und Caching mit — genau die Teile, die sonst Handarbeit sind |
| Fallback | `nostr-tools` | Falls NDK zu viel Magie mitbringt: `SimplePool` + eigener AUTH-Handler. Entscheidung nach Spike in Phase 1 |
| Cache | IndexedDB (`idb` oder NDK-Dexie-Adapter) | Sofort-Rendern, Offline-Lesen, lokale Suche |
| State | Zustand | Klein, kein Boilerplate; Domänenobjekte statt Events im Store |
| Markdown rendern | `react-markdown` + `remark-gfm` + **`rehype-sanitize`** | Inhalte kommen von beliebigen npubs → Sanitizing ist Pflicht, nicht Option |
| Editor | CodeMirror 6 (`@codemirror/lang-markdown`) | Robust, große Dokumente, gute Selektions-API für Inline-Kommentare später |
| Diff | `diff` (jsdiff) | Zeilen- und Wort-Diff, Basis für Blame und 3-Wege-Merge |
| 3-Wege-Merge | `diff3` (aus jsdiff-Ökosystem) | Automatisches Zusammenführen nicht-kollidierender Absätze |
| Styling | Tailwind, `dark`-Variante an `data-theme` gekoppelt | Atlassian-artige Dichte in Tokens; manuelle Hell/Dunkel-Umschaltung nötig → [12](12-theming.md) |
| Syntax-Highlighting | Shiki (Dual-Theme) | Ein Rendering für beide Modi, kein Stylesheet-Wechsel zur Laufzeit |
| Suche | MiniSearch über den Cache | Volltextsuche ohne Relay-Unterstützung (NIP-50 ist nicht überall vorhanden) |
| Tests | Vitest + Playwright | Kettenlogik (Head, Merge, Blame) ist reine Funktionslogik → gut unit-testbar |

## Struktur des Codes (geplant)

```
src/
  nostr/        kinds.ts, signer.ts, pool.ts, auth.ts      (kennt Kinds)
  domain/       page.ts, revision-graph.ts, merge.ts, tree.ts, blame.ts
  data/         cache.ts, queries.ts, mutations.ts
  ui/           layout/, sidebar/, page/, editor/, history/
  routes/
```

Wichtig: `domain/revision-graph.ts` (Head-Auflösung), `domain/merge.ts` und
`domain/blame.ts` sind reine Funktionen ohne Netzwerk. Sie sind der Kern der
Anwendung und werden zuerst mit Tests gebaut.
