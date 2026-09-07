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

## Phase 1 — Login (Anforderung 1) ✅ (2026-09-07)
- NIP-07-Erkennung, `getPublicKey`, Profil (`kind 0`), Session
- NIP-42-AUTH inkl. automatischem Retry bei Reconnect
- Signer-Interface (für NIP-46 später)
- **Fertig, wenn:** Login mit Alby funktioniert, Publish nach Reconnect nicht still fehlschlägt

Erledigt und geprüft:

| Baustein | Ort |
|---|---|
| Signer-Interface, `window.nostr`-Erkennung mit Polling | `src/nostr/signer.ts` |
| Relay-Schicht mit NIP-42: Challenge automatisch signieren, Publish-Retry nach `auth-required`, Backoff-Reconnect | `src/nostr/client.ts` |
| Sitzung, Profil aus Kind 0, Erkennung eines Account-Wechsels vor dem Schreiben | `src/session/session.tsx` |
| Login-Ansicht mit echten Zuständen, Nutzer-Chip, Schreibprobe | `src/routes/Login.tsx`, `src/ui/UserChip.tsx`, `src/ui/WriteCheck.tsx` |
| Wegwerf-Signer für automatisierte Tests ohne Extension (nur DEV, nur mit `?devsigner`) | `src/dev/fake-nip07.ts` |

Bibliotheksentscheidung aus dem Spike: **nostr-tools**, nicht NDK — siehe
[07](07-tech-stack.md).

Gegengeprüft am echten NIP-29-Relay (`groups_relay`, ws://localhost:8080):
Anmeldung, Sitzung über den Reload, und eine Schreibprobe, die vom Relay mit
"akzeptiert" bestätigt und über das eigene Abo zurückgeliefert wurde.

Drei Funde, die ohne Test nicht aufgefallen wären:
- `pool.get` nimmt keinen `onauth`-Haken. Auf einem Relay mit erzwungenem
  NIP-42 liefert es deshalb stillschweigend leere Ergebnisse. Lesen läuft
  daher über `subscribeEose` mit `onauth`.
- Ephemere Events brauchen einen Abonnenten, sonst lehnt das Relay sie ab. Die
  Schreibprobe abonniert deshalb zuerst und wartet auf das eigene Event.
- `subscribeEose` schliesst das Abo bei EOSE. Für den Rückweg eines ephemeren
  Events ist das zu früh — dort braucht es `pool.subscribe` und ein manuelles
  Schliessen.

## Phase 2 — Space & Sidebar (Anforderung 2) ✅ (2026-09-07)
- Gruppen laden (`39000`–`39002`), Space-Kopf, Mitgliederliste
- Linke Leiste mit fixen Einträgen
- Seitenbaum, Routing komplett
- **Fertig, wenn:** ein per Seed-Skript erzeugter Space vollständig navigierbar ist

Umgesetzt in `src/nostr/space-store.ts` (ein Store pro Space, hält die
Relay-Events und leitet Seiten und Baum ab) und `src/domain/group-state.ts`.
Die Übersicht zeigt Name, Beschreibung, die Flags aus `39000`, Mitglieder aus
`39002` und Rollen aus `39001`, dazu ein Badge "du bist Admin/Mitglied".

## Phase 3 — Seiten lesen & anlegen (Anforderung 3) ✅ (2026-09-07)
- `1818`-Revision publishen (erste Revision = Seite erstellen)
- Head-Auflösung, Markdown-Rendering mit Sanitizing
- Seitenbaum aus Revisionen, Slug-Normalisierung
- Editor mit Vorschau, `summary`-Feld
- **Fertig, wenn:** zwei Browser-Profile sehen die Seite des jeweils anderen

| Baustein | Ort |
|---|---|
| Revisionen aus Events lesen, h-Tag prüfen | `src/domain/revision.ts` |
| Head-Auflösung über `parent-rev`, Blätter, Seitenbaum | `src/domain/pages.ts` |
| Revision signieren und publishen (mit `content-hash`) | `src/nostr/publish-page.ts` |
| Markdown rendern mit `rehype-sanitize` | `src/ui/Markdown.tsx` |
| Editor für neue und bestehende Seiten | `src/ui/PageEditor.tsx` |
| Seite, Historie, Übersicht, Sidebar-Baum | `src/routes/`, `src/ui/layout/Sidebar.tsx` |

Gegen das laufende NIP-29-Relay geprüft: Seite "Deployment" als Unterseite von
"Handbuch" angelegt, danach bearbeitet — die zweite Revision zeigt per
`parent-rev` auf die erste, die Historie listet beide mit npub und Notiz, und
der Sidebar-Baum hängt die Seite unter ihre Elternseite.

**Abweichung vom Konzept:** Der Editor ist vorerst ein Textfeld mit
umschaltbarer Vorschau statt CodeMirror 6. Für das Schreiben von Markdown
reicht das; CodeMirror bringt Syntaxhervorhebung und eine bessere
Selektions-API für Inline-Kommentare und kommt deshalb zusammen mit Phase 6.

Die Verzweigungserkennung aus Phase 4 ist als Anzeige schon da: hat eine Seite
mehr als ein Blatt, zeigen Seite und Sidebar das an. Das Zusammenführen fehlt
noch.

## Phase 4 — Gemeinsam bearbeiten (Anforderungen 4 & 6)
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
