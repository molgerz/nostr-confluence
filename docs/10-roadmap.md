# 10 — Roadmap

Jede Phase endet mit einem überprüfbaren Ergebnis. Reihenfolge ist so gewählt,
dass das Risiko früh sichtbar wird: erst Relay + Rechte, dann Komfort.

## Phase 0 — Fundament ✅ (2026-09-07)
- Vite/React/TS-Projekt, Tailwind, Routing-Skelett
- **Theme-Tokens und Umschalter System/Hell/Dunkel** ([12](12-theming.md)) —
  bewusst zuerst, weil Nachrüsten jede Komponente erneut anfasst
- `nak serve --port 10547` als Entwicklungs-Relay ([08](08-relay-setup.md))
- `src/nostr/kinds.ts` mit allen Kinds aus [02](02-data-model-events.md)
- **Fertig, wenn:** die App verbindet sich, Relay-Status wird angezeigt, beide
  Modi sehen in allen vorhandenen Ansichten korrekt aus

Erledigt und geprüft:

| Baustein | Ort |
|---|---|
| Vite + React 19 + TS, Routing nach [06](06-ui-information-architecture.md) | `src/routes/router.tsx` |
| Theme-Tokens hell/dunkel, `@theme inline` | `src/index.css` |
| Umschalter System/Hell/Dunkel + Persistenz | `src/theme/theme.tsx`, `src/ui/ThemeToggle.tsx` |
| Kein Aufblitzen beim Laden | Inline-Skript in `index.html` |
| Alle Kinds und Tags an einer Stelle, Slug-Normalisierung | `src/nostr/kinds.ts` |
| Gruppen-Adresse `host'id` parsen | `src/nostr/group-address.ts` |
| Relay-Verbindung + NIP-11 + Backoff | `src/nostr/relay-status.ts` |
| Confluence-Layout: Topbar, Sidebar, Inhalt, rechte Leiste | `src/ui/layout/` |
| Aufgaben `relay`, `relay-auth`, `seed`, `dev`, `check` | `justfile` |

Verifiziert im Browser: Umschaltung hell/dunkel in allen Ansichten, Persistenz
über den Reload (`data-theme` und Toggle-Zustand bleiben), Relay-Status
"verbunden" mit Namen `nak serve` und Hinweis "NIP-29: nein, Gruppen simuliert",
sowie der Ausfall-Zustand mit Wiederverbindungszähler nach Stoppen des Relays.

## Phase 1 — Login (Anforderung 1)
- NIP-07-Erkennung, `getPublicKey`, Profil (`kind 0`), Session
- NIP-42-AUTH inkl. automatischem Retry bei Reconnect
- Signer-Interface (für NIP-46 später)
- **Fertig, wenn:** Login mit Alby funktioniert, Publish nach Reconnect nicht still fehlschlägt

## Phase 2 — Space & Sidebar (Anforderung 2)
- Gruppen laden (`39000`–`39002`), Space-Kopf, Mitgliederliste
- Linke Leiste mit fixen Einträgen, einklappbar
- Seitenbaum (noch leer), Routing komplett
- **Fertig, wenn:** ein per Seed-Skript erzeugter Space vollständig navigierbar ist

## Phase 3 — Seiten lesen & anlegen (Anforderung 3)
- `1818`-Revision publishen (erste Revision = Seite erstellen)
- Head-Auflösung, Markdown-Rendering mit Sanitizing
- Seitenbaum aus Revisionen, Slug-Normalisierung
- Editor (CodeMirror + Vorschau), `summary`-Feld
- **Fertig, wenn:** zwei Browser-Profile sehen die Seite des jeweils anderen

## Phase 4 — Gemeinsam bearbeiten (Anforderungen 4 & 6)
- Wechsel auf `groups_relay` (echte NIP-29-Rechte) — ab hier reicht `nak serve` nicht mehr
- Beitritt: Auto-Join in `open`-Gruppen nutzen, `9021`-Fallback für strengere Relays
- Optimistische Sperre: Head-Prüfung vor Publish
- 3-Wege-Merge-Dialog, Verzweigungs-Banner, Merge-Revision
- **Fertig, wenn:** gleichzeitiges Bearbeiten keinen Text verliert und der Konflikt sichtbar ist

## Phase 5 — Historie (Anforderung 5)
- Zeitachse pro Seite mit npub, Zeit, `summary`
- Diff zwischen beliebigen Revisionen, Blame pro Zeile
- Wiederherstellen als neue Revision, Signatur-Detailansicht
- **Fertig, wenn:** jede Version einer Seite einem npub zugeordnet und verifizierbar ist

## Phase 6 — Ausbau
Moderation (`9000`/`9001`/`9005`), Kommentare (`1111`), Volltextsuche,
Anhänge (Blossom/NIP-96), `30818`-Interop-Spiegel, Sidebar-Sortierung (`30820`),
Echtzeit-CRDT, NIP-46-Login, mobiles Layout.

## Reihenfolge-Begründung

Anforderung 5 (Historie) kommt spät, obwohl sie dir wichtig ist — weil das
Datenmodell sie ab Phase 3 *automatisch* erzeugt. Jede Speicherung ist bereits
eine unveränderliche, signierte Revision; Phase 5 baut nur die Ansicht darauf.
Wäre die Historie ein nachträglich angeflanschtes Feature, müsste sie früher
kommen. Genau deshalb ist das Event-Design so gewählt.
