# 11 — Offene Fragen

Punkte, bei denen ich eine Empfehlung habe, die Entscheidung aber dir gehört.

## 1. Eigener Kind `1818` oder bestehende NIPs?

| Variante | Bedeutung |
|---|---|
| **A (Empfehlung)** | Eigener Revisions-Kind `1818`, Volltext-Snapshots, `parent-rev`-Kette. Sauber auf den Anwendungsfall zugeschnitten |
| B | NIP-54-Wiki (`30818` + Merge-Requests `818`) als Wahrheit. Interop mit Wiki-Clients, aber ein Event pro Autor statt einer Seite |
| C | NIP-34-Patches (`1617`) wie ngit. Echtes Git-Modell, aber Lesen erfordert Patch-Replay |

## 2. Snapshot oder Diff pro Revision?

Empfehlung: Snapshot (siehe [02](02-data-model-events.md)). Alternative wäre
Patch-Speicherung — kleiner bei großen Seiten, aber teurer beim Lesen.
Relevant erst bei Seiten über ~100 kB.

## 3. Wie "offen" soll offen sein?

*Teil-entschieden: eigenes Relay ist gesetzt, Relay-Betreiber darf mitlesen.*

`public` + `open` heißt: jeder npub der Welt kann beitreten und schreiben. Für
ein internes Team-Wiki ist das ein Spam-Risiko. Alternative: `public` (lesen für
alle) + `closed` (Beitritt nur per Einladungscode `9009`). Deine Anforderung 4
klingt nach `open`; Empfehlung wäre `open` für den Prototyp und `closed` +
Einladungslink, sobald es echt genutzt wird.

## 4. Welches Relay ist die Autorität?

**Entschieden:** eigenes Relay. Umsetzung siehe [08](08-relay-setup.md) —
`nak serve` für Phase 0–3, `verse-pbc/groups_relay` ab Phase 4.
Restfrage: Rust (`groups_relay`) oder Go (`max21dev/groups-relay`), falls wir das
Relay selbst patchen wollen.

## 5. Mehrere Spaces oder nur einer im MVP?

Ein Space macht Phase 2 deutlich kleiner. Empfehlung: Datenmodell und Routing
von Anfang an mehr-Space-fähig (kostet fast nichts), UI-Space-Wechsler erst in
Phase 6.

## 6. Name und Domain

Arbeitstitel ist `nostr confluence`. "Confluence" ist eine eingetragene Marke von
Atlassian — für ein öffentlich verbreitetes Produkt wäre ein eigener Name
ratsam. Für ein internes Projekt/Prototyp ist der Arbeitstitel unkritisch.

## 7. Anhänge und Bilder

Nostr speichert keine Dateien. Braucht das MVP Bilder? Wenn ja: Blossom-Server
oder NIP-96-Host als zusätzliche Abhängigkeit einplanen (Phase 6 im aktuellen
Plan).
