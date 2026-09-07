# 02 — Datenmodell & Events

## Begriffe

| Confluence | Hier | Nostr-Umsetzung |
|---|---|---|
| Instanz | App | Statische Web-App im Browser |
| Space | Space | NIP-29-Gruppe auf einem Relay |
| Seite | Seite | `(Gruppen-ID, Slug)` + Kette von Revisionen |
| Version | Revision | Unveränderliches, signiertes Event |
| Nutzer | npub | Pubkey aus NIP-07 |
| Berechtigung | Mitgliedschaft | Vom Relay durchgesetzt (NIP-29) |

## Event-Kinds im Überblick

| Kind | Herkunft | Rolle |
|---|---|---|
| `0` | Nutzer | Profil (Name, Avatar) für Bylines |
| `22242` | Nutzer | NIP-42 Relay-AUTH |
| `39000` | **Relay** | Gruppen-Metadaten: Name, Bild, `public`/`private`, `open`/`closed` |
| `39001` | **Relay** | Admin-Liste der Gruppe |
| `39002` | **Relay** | Mitgliederliste der Gruppe |
| `39003` | **Relay** | Rollendefinitionen |
| `9000`–`9009` | Nutzer (Admin) | Moderation: Mitglied hinzufügen/entfernen, Metadaten, Event löschen |
| `9021` / `9022` | Nutzer | Beitritts- / Austritts-Anfrage |
| `9` / `11` / `12` | Nutzer | Gruppen-Chat und Threads (Space-Diskussion, Phase 6) |
| **`1818`** | Nutzer | **Seiten-Revision — der eigentliche Inhalt** |
| `30818` | Nutzer | Seiten-Kopf als NIP-54-Wiki-Artikel (Interop-Spiegel, optional) |
| `1111` | Nutzer | Kommentar (NIP-22) auf eine Seite |
| `5` / `9005` | Nutzer / Admin | Löschanfrage bzw. Moderations-Löschung |

## Anhänge

Nostr speichert keine Dateien. Ein Anhang wird auf einen **Blossom**-Server
geladen (BUD-01/02), liegt dort unter seinem sha256 und erscheint im Markdown
nur als URL — im Event steht also nie die Datei selbst. Der Upload wird mit
einem Event vom Kind `24242` autorisiert: der Server prüft eine Signatur,
kein Passwort. Konfiguration über `VITE_BLOSSOM_SERVER`; ohne sie ist der
Anhang-Knopf deaktiviert statt ins Leere zu laufen.

Für die lokale Entwicklung liegt ein winziger Server bei:
`node scripts/dev-blossom.mjs`.

Vor dem ersten Publish prüft die App den Tag `supported_kinds` in `39000`:
listet die Gruppe Kinds auf und `1818` fehlt, wird gewarnt statt blind
publiziert ([04](04-permissions-nip29.md)).

**Entscheidung:** `1818` ist ein anwendungseigener Kind im regulären Bereich
(also unveränderlich, nicht ersetzbar). NIP-54 belegt `818` für Merge-Requests im
Wiki-Kontext; `1818` ist bewusst daran angelehnt, aber eigenständig.
**Offen:** Ob wir stattdessen NIP-34-Patches (`1617`) verwenden — siehe
[11](11-open-questions.md).

## Kernevent: Seiten-Revision (`1818`)

```json
{
  "kind": 1818,
  "pubkey": "<npub der Autorin, hex>",
  "created_at": 1757250000,
  "content": "# Onboarding\n\nWillkommen im Team …",
  "tags": [
    ["h", "engineering"],
    ["d", "onboarding"],
    ["title", "Onboarding"],
    ["parent-rev", "<event-id der Vorgänger-Revision>"],
    ["content-hash", "<sha256 des content>"],
    ["page-parent", "handbuch"],
    ["m", "text/markdown"],
    ["summary", "Tippfehler korrigiert"],
    ["alt", "Wiki-Seite 'Onboarding' im Space engineering"],
    ["previous", "a1b2c3d4", "e5f6a7b8"]
  ],
  "id": "…", "sig": "…"
}
```

Bedeutung der Tags:

- **`h`** — Gruppen-ID. Pflicht in NIP-29; das Relay prüft an diesem Tag, ob die
  Autorin schreiben darf. Das ist unser gesamter Rechte-Mechanismus.
- **`d`** — normalisierter Slug der Seite (`kleinbuchstaben-mit-bindestrich`).
  Einbuchstabige Tags sind relay-indexiert, also filterbar via `#d`.
- **`parent-rev`** — Event-ID der Vorgänger-Revision. Keine Angabe = erste
  Revision. Zwei Angaben = Merge-Revision.
- **`content-hash`** — erlaubt, identische Inhalte zu erkennen (Restore,
  No-Op-Speichern) ohne Volltextvergleich.
- **`page-parent`** — Slug der Elternseite. Daraus baut die Sidebar den Baum.
- **`previous`** — NIP-29-Timeline-Referenzen: Kurz-IDs kürzlich gesehener
  Gruppen-Events. Verhindert, dass ein Relay Events fälscht oder in eine andere
  Gruppen-Historie umhängt. **Noch nicht umgesetzt:** die App schreibt den Tag
  nicht, und `groups_relay` prüft ihn ohnehin nicht ([09](09-security-privacy.md)).

**Entscheidung: Volltext-Snapshot statt Diff.** Jede Revision enthält den
kompletten Markdown-Text, nicht nur die Änderung. Begründung: eine Seite lesen
braucht dann genau ein Event statt einer Replay-Kette, Diffs lassen sich
clientseitig aus zwei Snapshots berechnen, und Textseiten sind klein. Die
`parent-rev`-Kette liefert die Git-Semantik, der Snapshot die Bequemlichkeit.
Bei Bedarf lässt sich später eine Patch-Variante ergänzen.

## Seitenidentität und Head-Auflösung

Eine Seite ist `(h, d)`. Ihr aktueller Inhalt ist der **Head** der
Revisionskette:

1. Alle `1818`-Events mit `#h=<group>` und `#d=<slug>` laden.
2. Signaturen prüfen, Events mit fremdem `h` verwerfen.
3. Gerichteten Graph über `parent-rev` bauen.
4. Blätter (Events, auf die keine andere Revision zeigt) ermitteln.
5. Ein Blatt → das ist der Head. Mehrere Blätter → Verzweigung, UI zeigt
   Konflikt-Banner und Merge-Angebot ([05](05-versioning-history.md)).

Bei mehreren Blättern gilt zum *Anzeigen* das jüngste (`created_at`, bei
Gleichstand lexikografisch kleinere `id` — deterministisch für alle Clients).
Verschwiegen wird die Verzweigung nie.

## Seitenbaum für die Sidebar

Aus allen `1818`-Events der Gruppe wird pro `d`-Wert der Head bestimmt; dessen
`title` und `page-parent` ergeben den Baum. Kein separates Index-Event nötig —
der Baum ist eine Projektion der Revisionen.

- Vorteil: keine Inkonsistenz zwischen Index und Inhalt.
- Kosten: beim ersten Laden eines Spaces müssen viele Events geladen werden.
  Gegenmaßnahme: IndexedDB-Cache + Subscription nur ab letztem bekannten
  `created_at`.
- **Offen:** Manuelle Sortierung der Sidebar (Confluence erlaubt Drag & Drop).
  Vorschlag: adressierbares Admin-Event `30820` mit der Reihenfolge, erst Phase 5.

## Seiten-Kopf (`30818`) — bewusst nur Spiegel

Zusätzlich kann jede Speicherung einen NIP-54-Wiki-Artikel `30818` mit
`d = slug`, `h = group` und `rev = <revision-id>` schreiben. Nutzen: andere
Nostr-Wiki-Clients können die Seite lesen, und Listen laden schnell.

**Wichtig:** `30818` ist per `(kind, pubkey, d)` eindeutig, existiert also
einmal *pro Autorin*. Es ist deshalb niemals die Wahrheit über den Seiteninhalt,
sondern ein Hinweis. Wahrheit ist die Revisionskette. Diese Trennung ist der
Grund, warum "jede/r darf bearbeiten" überhaupt funktioniert.

## Kommentare (`1111`) — umgesetzt

NIP-22-Kommentar, verankert an `h` (Gruppe) und `d` (Slug), mit `K = 1818` für
die Art des Wurzelobjekts, `k` für die Art des direkten Bezugs und `e` auf den
Elternkommentar bei Antworten.

**Abweichung vom Buchstaben des NIP:** NIP-22 verweist per `A`/`E` auf ein
einzelnes Wurzel-Event. Unsere Seite *ist* kein einzelnes Event, sondern das
Paar `(Gruppe, Slug)` — ein Verweis auf eine Revision würde mit der nächsten
Bearbeitung ins Leere zeigen und den Faden verwaisen lassen. Deshalb dieselbe
Verankerung wie bei den Revisionen.

**Offen:** Inline-Kommentare an einer Textstelle (Zitat-Anker). Braucht eine
Selektions-API im Editor und damit CodeMirror.
