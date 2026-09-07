# 08 — Relay-Setup & Testumgebung

**Entscheidung (bestätigt):** Ein eigenes Relay ist Teil des Projekts. Dass der
Relay-Betreiber (Firma/Admin) alle Inhalte im Klartext lesen kann, ist für den
Einsatzzweck akzeptiert — siehe [09](09-security-privacy.md).

## Harte Randbedingung

NIP-29 muss das Relay implementieren. Ein gewöhnliches Relay speichert
`h`-getaggte Events einfach, prüft aber keine Mitgliedschaft und erzeugt keine
`39000`–`39003`.

## Dreistufige Testleiter

### Stufe 1 — `nak serve` + simulierte Gruppen-Metadaten

**`nak serve` ist kein NIP-29-Relay.** Geprüft am 2026-09-07 mit nak 0.20.6:

- Sein NIP-11-Dokument meldet `supported_nips: [1, 11, 42, 70, 86, 40, 9, 45]`
  — 29 fehlt.
- Ein `kind 9007` (create-group) und ein `kind 9000` (put-user) werden roh
  gespeichert; das Relay reagiert nicht darauf. Es entstehen **keine**
  `39000`–`39003`.
- Ein völlig fremder, zufälliger Key darf in dieselbe Gruppe schreiben. Keine
  Rechteprüfung.
- Speicher ist `slicestore.SliceStore`, also rein im RAM: nach jedem Neustart
  ist der Zustand weg und muss neu geseedet werden.

**Trotzdem lässt sich die Leseseite vollständig simulieren.** Weil das Relay
jedes signierte Event annimmt, erzeugen wir die Gruppen-Metadaten selbst,
signiert mit einem lokalen "Fake-Relay"-Schlüssel. Genau das macht
[`scripts/dev-relay-seed.sh`](../scripts/dev-relay-seed.sh):

```bash
nak serve --port 10577            # Terminal 1
./scripts/dev-relay-seed.sh       # Terminal 2
```

Danach funktioniert `nak group info|members|admins` gegen das lokale Relay, und
die App hat einen vollständigen Space mit Metadaten, Admin, zwei Mitgliedern,
zwei Seiten und einer zweigliedrigen Revisionskette.

Drei Fallen, die dabei Zeit gekostet haben und die das Skript jetzt abfängt:

1. **Portkollision.** `nak serve` nimmt standardmäßig Port **10547**. Läuft
   dort schon ein Relay-Container (z. B. `scsibug/nostr-rs-relay` per Docker
   auf `10547`), lauschen zwei Prozesse auf demselben Port — einer auf IPv4,
   Docker auf IPv6-Wildcard — und `localhost` landet mal hier, mal dort. Das
   Skript nutzt deshalb **10577** und prüft per NIP-11 nach, mit welchem Relay
   es tatsächlich spricht (und bricht ab, falls das Relay NIP-29 selbst kann —
   dann soll man nicht simulieren, sondern `nak group create-group` benutzen).
2. **`nak group <sub> <host/path>` scheitert lokal.** Diese Adressform wird per
   NIP-AD über `https://<host>/.well-known/nostr.json` aufgelöst, was gegen
   `localhost` ohne TLS nicht geht. Lösung: `naddr` verwenden —
   `nak encode naddr -d <gruppe> -k 39000 -a <relay-pubkey> -r <relay-url>`.
   Wichtig dabei: `fetchGroupMetadata` in nak nimmt zuerst `self`/`pubkey` aus
   dem NIP-11-Dokument des Relays als Autor der Metadaten und nur als Fallback
   den Autor aus dem `naddr`. Da `nak serve` keinen eigenen Pubkey ausweist,
   greift der Fallback — deshalb funktioniert der Fake-Relay-Key.
   `nak group create-group <naddr>` funktioniert übrigens auch gegen ein dummes
   Relay: es publisht das `9007` korrekt, nur reagiert niemand darauf.
3. **`GID` ist in zsh reserviert** (Gruppen-ID des Prozesses). Eine Zeile wie
   `GID=engineering` bricht mit "failed to change group ID" ab. Im Skript heißt
   die Variable `GROUP_ID`.

Nebenbei aufgefallen und für unser Datenmodell relevant: die Gruppen-Metadaten
kennen einen Tag **`supported_kinds`** (mit Unterstrich), über den ein Relay
ansagt, welche Kinds die Gruppe akzeptiert. Das Seed-Skript setzt
`supported_kinds=1818;1111;9`; die App sollte diesen Tag lesen und warnen,
wenn `1818` dort fehlt, statt Publishes ins Leere laufen zu lassen.

**Damit testbar:** Phase 0–3 vollständig — Login inkl. NIP-42 (`nak serve --auth`),
Space-Kopf, Mitgliederliste, Seitenbaum, Editor, Revisionsketten, Diff, Historie.
**Nicht testbar:** Rechtedurchsetzung und Auto-Join. Dafür Stufe 2.

### Stufe 2 — echtes NIP-29-Relay lokal

**Nicht mehr verwenden:** `fiatjaf/relay29` ist am 2026-04-20 archiviert worden
und trägt selbst den Hinweis, ihm nichts Ernstes anzuvertrauen.

**Empfehlung: [`verse-pbc/groups_relay`](https://github.com/verse-pbc/groups_relay)**
(Rust, AGPL-3.0, letzter Commit 2026-02-11). Quellcode am 2026-09-07 geprüft:

```bash
docker compose up --build      # Relay auf :8080, Web-UI auf http://localhost:8080
```

- Setzt Mitgliedschaft durch: `group.rs` lehnt Schreibzugriffe von
  Nicht-Mitgliedern in `closed`-Gruppen mit "User is not a member of this group"
  ab.
- **Wichtiger Fund für uns:** Es gibt *keine* Kind-Whitelist innerhalb von
  Gruppen. `validation_middleware.rs` verlangt nur, dass ein Event einen
  `h`-Tag hat (Ausnahmen in `NON_GROUP_ALLOWED_KINDS`). Unser `kind 1818` läuft
  also ohne Relay-Patch durch — das war das größte Risiko am Datenmodell.
- **Zweiter Fund:** In `open`-Gruppen wird der Autor beim Posten automatisch
  Mitglied ("Open groups auto-join the author when posting") und `39002` wird
  aktualisiert. Anforderung 4 braucht damit keinen expliziten
  `9021`-Beitrittsschritt im UI.
- Generiert `39000`–`39003` selbst, unterstützt `public`/`private`,
  `open`/`closed`, `broadcast`, dazu NIP-09/40/42/70.
- **Einschränkung:** Timeline-Referenzen (`previous`-Tag) sind laut README nicht
  implementiert. Wir dürfen den Tag schreiben, aber das Relay verifiziert ihn
  nicht — die Lückenerkennung aus [09](09-security-privacy.md) ist damit
  clientseitige Heuristik, keine Relay-Garantie.

Alternative: [`max21dev/groups-relay`](https://github.com/max21dev/groups-relay)
(Go, MIT, basiert auf relay29 + khatru) — leichter zu patchen, wenn Go lieber
ist als Rust, erbt aber die relay29-Basis.

### Stufe 3 — Betrieb

- Relay hinter TLS (`wss://`), weil eine HTTPS-Seite kein `ws://` öffnen darf
  (außer `localhost`).
- Web-App als statisches Bundle auf beliebigem Host.
- Backup = Event-Export als JSONL. Weil alles signiert ist, lässt sich ein Space
  auf einem anderen Relay verifizierbar wiederherstellen. Das ist gleichzeitig
  die Umzugsstrategie — und der Grund, warum `nak serve --events dump.jsonl` als
  Wegwerf-Kopie der Produktion nützlich ist.

## Entwicklungs-Setup im Repo (geplant)

```
justfile              relay-dumb / relay-real / seed / dev
docker/compose.yml    groups_relay auf :8080
scripts/seed.sh       nak-Aufrufe: Gruppe anlegen, Mitglieder, 3 Beispielseiten
seed/space.jsonl      Seed-Events für `nak serve --events`
```

**Offen:** Seeds mit Wegwerf-Keys im Repo (schnell, aber Keys liegen im Klartext
— nur für Testrelays) oder Seeds per Skript aus einer zweiten
Browser-Extension. Vorschlag: Wegwerf-Keys, klar als solche benannt.
