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

## Phase 4 — Gemeinsam bearbeiten (Anforderungen 4 & 6) ✅ (2026-09-07)
- Beitritt: Auto-Join in `open`-Gruppen nutzen, `9021`-Fallback für strengere Relays
- Optimistische Sperre: Head-Prüfung vor Publish
- 3-Wege-Merge, Verzweigungs-Banner, Merge-Revision
- **Fertig, wenn:** gleichzeitiges Bearbeiten keinen Text verliert und der Konflikt sichtbar ist

| Baustein | Ort |
|---|---|
| Zeilenweiser 3-Wege-Merge mit Konfliktmarkern | `src/domain/merge.ts` |
| Jüngster gemeinsamer Vorfahre zweier Revisionen | `findCommonAncestor` in `src/domain/pages.ts` |
| Optimistische Sperre und Merge im Editor | `src/ui/PageEditor.tsx` |
| Verzweigte Seite zusammenführen | `src/routes/EditorView.tsx` mit `?merge=1` |

Ablauf beim Speichern: hat sich der Kopf der Kette seit dem Öffnen bewegt,
wird nicht publiziert, sondern zusammengeführt und der Mensch gefragt.
Überschneiden sich die Änderungen, stehen Konfliktmarker im Text und Speichern
bleibt gesperrt, bis sie weg sind. Das Ergebnis einer Zusammenführung ist eine
Revision mit zwei `parent-rev`-Tags.

Am laufenden Relay durchgespielt: zwei konkurrierende Revisionen über `nak`
erzeugt, in der App zusammengeführt (Merge-Revision `bc523a4b` mit beiden
Vorgängern), danach mit offenem Editor eine fremde Revision publiziert — beim
Speichern wurde zusammengeführt statt überschrieben, der Konflikt markiert und
das Speichern verweigert, bis die Marker entfernt waren.

Zwei Fehler dabei gefunden: Zeilennummern aus Unified-Diff-Hunks sind für reine
Einfügungen mehrdeutig (ein eingefügter Abschnitt landete eine Zeile zu weit
hinten) — die Änderungserkennung läuft jetzt über `diffArrays` auf Zeilen-Arrays.
Und der Merge startete, sobald zwei Blätter geladen waren, während die
gemeinsame Basis noch unterwegs war; der Editor wartet jetzt auf das
vollständige Laden.

## Phase 5 — Historie (Anforderung 5) ✅ (2026-09-07)
- Zeitachse pro Seite mit npub, Zeit, `summary`
- Diff zwischen beliebigen Revisionen, Blame pro Zeile
- Wiederherstellen als neue Revision, Signatur-Detailansicht
- **Fertig, wenn:** jede Version einer Seite einem npub zugeordnet und verifizierbar ist

| Baustein | Ort |
|---|---|
| Zeilen-Diff mit Zeilennummern beider Seiten, Faltung langer Strecken | `src/domain/diff.ts`, `src/ui/DiffView.tsx` |
| Zeilenherkunft über die Kette | `src/domain/blame.ts`, `src/routes/BlameView.tsx` |
| Vergleich beliebiger Revisionen, Details, Wiederherstellen | `src/routes/HistoryView.tsx` |

Vergleichen geht zwischen **beliebigen** Revisionen, nicht nur benachbarten —
möglich, weil jede Revision einen Volltext-Snapshot trägt. Hinzufügen und
Entfernen sind zusätzlich mit `+` und `−` gekennzeichnet, nicht nur farbig.

Wiederherstellen löscht nichts: es entsteht eine neue Revision mit dem alten
Inhalt, die per `restore-of` auf ihre Vorlage verweist und als Vorgänger den
aktuellen Kopf hat.

Am laufenden Relay durchgespielt; die Kette der Testseite zeigt den ganzen
Bogen: Wurzel, Verzweigung, Merge-Revision mit zwei Vorgängern, konkurrierende
Revision, Konfliktauflösung, Wiederherstellung mit `restore-of`.

**Bekannte Vereinfachung:** Die Zeilenherkunft folgt dem ersten Vorgänger. Bei
einer Merge-Revision erscheinen die Zeilen des zweiten Zweiges deshalb als von
der Zusammenführung eingeführt — dasselbe Verhalten wie `git blame` ohne
Zusatzoptionen.

## Phase 6 — Ausbau (läuft)

Erledigt:

| Baustein | Ort |
|---|---|
| Volltextsuche über Titel und Inhalt, lokal statt über NIP-50 | `src/domain/search.ts`, `src/routes/SearchView.tsx` |
| Einklappbare Sidebar, Zustand bleibt erhalten | `src/ui/layout/Sidebar.tsx` |
| Kommentare mit Threads (Kind 1111) | `src/domain/comment.ts`, `src/ui/Comments.tsx` |
| Moderation: Mitglieder aufnehmen und entfernen, Events löschen | `src/nostr/moderation.ts`, `src/ui/MemberAdmin.tsx` |

Offen: Anhänge
(Blossom/NIP-96), `30818`-Interop-Spiegel, Sidebar-Sortierung (`30820`),
Echtzeit-CRDT, NIP-46-Login, mobiles Layout, CodeMirror-Editor,
Anzeigenamen über `VITE_PROFILE_RELAYS`.

## Reihenfolge-Begründung

Anforderung 5 (Historie) kommt spät, obwohl sie dir wichtig ist — weil das
Datenmodell sie ab Phase 3 *automatisch* erzeugt. Jede Speicherung ist bereits
eine unveränderliche, signierte Revision; Phase 5 baut nur die Ansicht darauf.
Wäre die Historie ein nachträglich angeflanschtes Feature, müsste sie früher
kommen. Genau deshalb ist das Event-Design so gewählt.
