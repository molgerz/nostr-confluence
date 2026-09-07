# 00 — Vision & Scope

## Produktidee

Ein Team-Wiki, das sich anfühlt wie Confluence (linke Navigationsleiste, Seiten
in einem Baum, Editor, Versionshistorie, "zuletzt geändert von …"), aber ohne
Server-Account: Identität = npub, Speicher = Nostr-Relay, Rechte = NIP-29-Gruppe.

## Muss-Funktionen (aus deiner Anforderung)

| # | Anforderung | Umsetzung im Konzept |
|---|---|---|
| 1 | Login mit Nostr, zunächst nur NIP-07 | `window.nostr` + NIP-42-Relay-AUTH → [03](03-auth-nip07-nip42.md) |
| 2 | Linke Task-/Navigationsleiste wie Confluence | Space-Sidebar mit Seitenbaum → [06](06-ui-information-architecture.md) |
| 3 | Neue "Seiten" als Markdown anlegen | Seiten-Event + Revision → [02](02-data-model-events.md) |
| 4 | Grundsätzlich darf jede/r bearbeiten | Offene NIP-29-Gruppe, Relay entscheidet → [04](04-permissions-nip29.md) |
| 5 | Versionshistorie, an npub geknüpft | Hash-verkettete Revisions-Events, git-artig → [05](05-versioning-history.md) |
| 6 | Gemeinsames Arbeiten | Optimistisches Speichern + 3-Wege-Merge, später CRDT → [05](05-versioning-history.md) |
| 7 | Umschaltbar zwischen Hell und Dunkel | Token-basiertes Theming, Umschalter in der Topbar → [12](12-theming.md) |

## Reifegrad

**Prototyp.** Der Space wird bisher ausschliesslich mit `nak` von der
Kommandozeile angelegt; in der App gibt es dafür keinen Weg. Zusammen mit
fehlendem TLS, Wegwerf-Schlüsseln im Seed und einem Event-Format, das sich noch
ändern kann, heisst das: nichts hineinschreiben, dessen Verlust weh tut.
Vollständige Begründung in [NOSTR.md](../NOSTR.md).

## Zielbild Phase 1 (MVP)

Zwei Personen mit Alby im Browser öffnen dieselbe URL, sehen denselben Space,
legen Seiten an, bearbeiten sich gegenseitig die Seiten, und in der Historie
steht bei jeder Version, welcher npub sie signiert hat. Ein Konflikt (beide
bearbeiten gleichzeitig) wird erkannt und nicht stillschweigend überschrieben.

## Nicht-Ziele

- **Nicht-Ziel:** Zeichen-für-Zeichen-Echtzeit-Kollaboration im MVP. Das ist
  Phase 6 (CRDT über ephemere Events), nicht Phase 1.
- **Nicht-Ziel:** Ende-zu-Ende-Verschlüsselung von Seiteninhalten. Eine "private"
  NIP-29-Gruppe ist zugriffsbeschränkt, nicht verschlüsselt — das Relay sieht
  Klartext. Siehe [09](09-security-privacy.md).
- **Nicht-Ziel:** Kompatibilität mit dem gesamten Confluence-Funktionsumfang
  (Makros, Jira-Integration, Blueprints, Berechtigungen pro Seite).
- **Nicht-Ziel:** Login per nsec-Eingabe. Nie. NIP-07 in Phase 1, NIP-46
  (Bunker) später.
- **Nicht-Ziel:** Eigener Backend-Server mit Datenbank. Der Client spricht
  direkt mit Relays.

## Grundsatz-Spannung, die das Design prägt

Confluence hat *eine* kanonische Seite. Nostr hat *Events pro Autor* — ein
adressierbares Event (`30xxx`) ist immer per `(kind, pubkey, d-Tag)` eindeutig,
also gehört es genau einem Schlüsselpaar. Zwei Personen können nicht dasselbe
adressierbare Event ersetzen.

Die Auflösung: die Seitenidentität ist nicht ein Event, sondern das Paar
`(Gruppen-ID, Slug)`, und der Inhalt lebt in unveränderlichen Revisions-Events,
die per `parent-rev` eine Kette bilden. Damit ist "eine Seite, viele Autoren"
darstellbar, ohne dass jemand ein Event einer anderen Person überschreiben muss.
Details in [02](02-data-model-events.md) und [05](05-versioning-history.md).
