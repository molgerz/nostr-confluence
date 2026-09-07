# 08 — Relay-Setup & Testumgebung

**Entscheidung (bestätigt):** Ein eigenes Relay ist Teil des Projekts. Dass der
Relay-Betreiber (Firma/Admin) alle Inhalte im Klartext lesen kann, ist für den
Einsatzzweck akzeptiert — siehe [09](09-security-privacy.md).

**Projektregel:** Gruppen werden **ausschließlich über `nak group`** angelegt und
verändert. Die relay-generierten Events `39000`–`39003` werden nie selbst
signiert. Begründung und Konsequenzen stehen in der [AGENTS.md](../AGENTS.md).
Daraus folgt: die Entwicklung läuft von Anfang an gegen ein Relay, das NIP-29
wirklich implementiert — nicht gegen eine Attrappe.

## Entwicklungs-Relay: `verse-pbc/groups_relay`

[verse-pbc/groups_relay](https://github.com/verse-pbc/groups_relay) (Rust,
AGPL-3.0, letzter Commit 2026-02-11). Quellcode am 2026-09-07 geprüft:

- Setzt Mitgliedschaft durch: Nicht-Mitglieder werden in `closed`-Gruppen mit
  "User is not a member of this group" abgewiesen (`src/group.rs`).
- **Keine Kind-Whitelist innerhalb von Gruppen.** `validation_middleware.rs`
  verlangt nur einen `h`-Tag (Ausnahmen in `NON_GROUP_ALLOWED_KINDS`). Unser
  `kind 1818` läuft also ohne Relay-Patch durch — das war das größte offene
  Risiko am Datenmodell.
- In `open`-Gruppen wird der Autor beim Posten automatisch Mitglied ("Open
  groups auto-join the author when posting") und `39002` wird aktualisiert.
- Generiert `39000`–`39003` selbst, unterstützt `public`/`private`,
  `open`/`closed`, `broadcast`, dazu NIP-09/40/42/70.
- **Einschränkung:** Timeline-Referenzen (`previous`-Tag) sind laut README nicht
  implementiert. Der Tag darf geschrieben werden, das Relay prüft ihn nicht.

Nicht mehr verwenden: `fiatjaf/relay29` ist am 2026-04-20 archiviert worden und
trägt selbst den Hinweis, ihm nichts Ernstes anzuvertrauen.

### Starten

```bash
./scripts/dev-relay-up.sh     # klont nach .local/, baut, startet auf :8080
./scripts/dev-group-seed.sh   # Space, Mitglieder, Beispielseiten via nak group
```

Das Seed-Skript macht fünf Schritte und ist wiederholbar:

1. `nak group create-group` — beim zweiten Lauf meldet das Relay "Group already
   exists", was das Skript abfängt.
2. Ein `9002`-Moderationsevent mit ausdrücklichen `public`/`open`-Tags. Nötig,
   weil das Relay Gruppen privat und geschlossen anlegt und `nak group
   edit-metadata` diese Flags nicht zurücknehmen kann — Begründung in der
   [AGENTS.md](../AGENTS.md).
3. `nak group put-user` für das zweite Testkonto.
4. Drei `1818`-Revisionen (zwei Seiten, eine davon mit zweiter Revision und
   `parent-rev`) — Inhalt, keine Gruppenverwaltung.
5. Kontrolle über rohe `nak req`-Abfragen auf `39000`/`39001`/`39002`, weil
   `nak group info` gegen dieses Relay hängt.

Welche nak-Flags wann nötig sind (`--fpa` statt `--auth`, `create-group` ohne
beides), steht in der [AGENTS.md](../AGENTS.md) — das ist der Teil, der beim
ersten Versuch am meisten Zeit kostet.

Der Bau läuft **nativ über cargo**, nicht über Docker: der mitgelieferte
`Dockerfile.dev` bricht an `cargo build --features console` ab (exit 101) — das
Feature ist im Produktions-Dockerfile ausdrücklich als instabil deaktiviert.
Ohne lokales Rust weicht das Skript auf Docker mit dem Produktions-Dockerfile
aus ([docker/groups-relay.override.yml](../docker/groups-relay.override.yml)).
Die Konfiguration kommt aus `config/settings.yml` plus `settings.local.yml` des
Relays; Port und URL überschreibt das Skript per `NIP29__relay__*`-Umgebung.

### Gruppen adressieren

`nak group <befehl> <adresse>` nimmt zwei Formen:

| Form | Auflösung | Lokal brauchbar |
|---|---|---|
| `host/gruppe` (NIP-AD) | `https://<host>/.well-known/nostr.json` | nein, braucht TLS |
| `naddr1…` | direkt aus dem Code | ja |

Deshalb baut das Seed-Skript immer eine `naddr`:

```bash
nak encode naddr -d engineering -k 39000 -a "$RELAY_PUBKEY" -r ws://localhost:8080
```

Den Relay-Pubkey liefert das NIP-11-Dokument (`nak relay <url>`, Feld `self`
bzw. `pubkey`). Hintergrund: `fetchGroupMetadata` in nak nimmt zuerst diesen
Pubkey als Autor der Gruppen-Metadaten und nur als Fallback den Autor aus der
`naddr` — bei einem echten NIP-29-Relay ist also der Relay-Pubkey der richtige.

## `nak serve`: nur ohne Gruppenlogik

`nak serve` startet ein In-Memory-Relay (`slicestore.SliceStore`), ist aber
**kein NIP-29-Relay**. Geprüft am 2026-09-07 mit nak 0.20.6:

- NIP-11 meldet `supported_nips: [1, 11, 42, 70, 86, 40, 9, 45]` — 29 fehlt.
- `9007` (create-group) und `9000` (put-user) werden roh gespeichert, ohne
  Wirkung. Es entstehen keine `39000`–`39003`.
- Jeder fremde Schlüssel darf in jede Gruppe schreiben.

Zulässig ist es damit nur für Dinge ohne Gruppenbezug — Event-Formate,
NIP-42-Ablauf (`nak serve --auth`), Reconnect-Verhalten. Gruppen-Metadaten von
Hand zu erzeugen ist ausdrücklich nicht mehr erlaubt.

Zwei Eigenheiten, die dabei Zeit gekostet haben:

- **Portkollision:** Default ist `10547`, wo auf diesem Rechner schon ein
  `nostr-rs-relay`-Container lauscht. Zwei Listener auf demselben Port (IPv4
  bzw. IPv6-Wildcard) führen dazu, dass `localhost` mal hier, mal dort landet.
  Falls doch nötig: `nak serve --port 10577`.
- **Ephemere Events** (20000–29999) lehnt `nak serve` mit
  `mute: no one was listening for this` ab, wenn niemand abonniert hat. Das ist
  kein Rechteproblem — die App klassifiziert solche Gründe entsprechend
  (`classifyRejection` in `src/nostr/client.ts`).

## Betrieb

- Relay hinter TLS (`wss://`), weil eine HTTPS-Seite kein `ws://` öffnen darf
  (außer `localhost`).
- Web-App als statisches Bundle auf beliebigem Host.
- Backup = Event-Export als JSONL. Weil alles signiert ist, ist ein Export auf
  einem anderen Relay verifizierbar wiederherstellbar. Das ist gleichzeitig die
  Umzugsstrategie: Space umziehen heißt Events kopieren.
