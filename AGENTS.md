# Hinweise für KI-Agenten in diesem Repo

Projekt: Confluence-artiges Wiki auf Nostr. Konzeption vollständig in
[`docs/`](docs/README.md) — dort steht die Begründung für jede Entscheidung,
hier stehen nur Arbeitsregeln.

## Gruppen immer mit `nak group` verwalten

**Regel:** NIP-29-Gruppen werden ausschließlich über `nak group` angelegt und
verändert — `create-group`, `edit-metadata`, `put-user`, `remove-user`,
`create-invite`, `delete-event`. Niemals die relay-generierten Events `39000`,
`39001`, `39002`, `39003` selbst signieren und publishen.

**Warum:** Bei NIP-29 ist das Relay die Autorität. Selbst signierte
Metadaten-Events sind eine Attrappe: sie sehen im Client richtig aus, aber das
Relay setzt nichts durch, Mitgliedschaft und Rollen sind Fiktion, und
Verhaltensunterschiede zum echten Relay fallen erst spät auf.

**Folge daraus:** Es muss ein Relay laufen, das NIP-29 wirklich implementiert.
`nak serve` tut das nicht (sein NIP-11 nennt kein NIP 29, `9007`/`9000` werden
nur rohgespeichert). Deshalb:

```bash
./scripts/dev-relay-up.sh     # verse-pbc/groups_relay auf :8080 (nativ via cargo)
./scripts/dev-group-seed.sh   # Gruppe und Mitglieder via nak group
```

Der Bau läuft nativ über cargo, weil der mitgelieferte `Dockerfile.dev` an
`cargo build --features console` scheitert. Ohne Rust weicht das Skript auf
Docker mit dem Produktions-Dockerfile aus.

`nak serve` ist nur für Arbeiten ohne Docker und ohne Gruppenlogik zulässig
(z. B. reine Event-Formatprüfungen) — und dann ohne gefälschte Gruppen-Metadaten.

`nak group` ist ein **Client**, kein Relay: es ersetzt kein laufendes Relay.

## Adressierung von Gruppen mit nak

`nak group <befehl> <adresse>` akzeptiert zwei Formen:

- NIP-AD-Webadresse `host/gruppe` — wird über `https://<host>/.well-known/nostr.json`
  aufgelöst, funktioniert bei `localhost` ohne TLS also **nicht**.
- `naddr1…` — funktioniert immer:
  `nak encode naddr -d <gruppe> -k 39000 -a <relay-pubkey> -r <relay-url>`

Den Relay-Pubkey liefert das NIP-11-Dokument (`nak relay <url>`, Feld `self`
bzw. `pubkey`).

## nak gegen `groups_relay`: welche Flags wann

Am 2026-09-07 durchgemessen. Ohne diese Regeln laufen Befehle ins Leere oder
hängen:

| Aufruf | Flags | Grund |
|---|---|---|
| `nak req`, Lesen allgemein | `--fpa --sec <key>` | Das Relay filtert unauthentifizierte Leser bei privaten Gruppen **stillschweigend** heraus, statt mit `auth-required` abzulehnen. `--auth` reagiert nur auf eine Ablehnung und greift deshalb nicht; `--fpa` (force-pre-auth) wartet die Challenge ab |
| `nak event` (publishen) | `--fpa --sec <key>` | funktioniert; `--auth` allein genügt oft, `--fpa` ist verlässlicher |
| `nak group create-group` | **nur** `--sec` | mit `--fpa` hängt der Befehl: er liest vor dem Publish Metadaten und wartet dort auf eine Challenge, die auf diesem Pfad nicht kommt |
| `nak group put-user` | `--fpa --sec` | funktioniert |
| `nak group info`, `members`, `edit-metadata` | — | **unbrauchbar gegen dieses Relay.** Sie rufen `fetchGroupMetadata` über nak's internen Pool auf, der kein AUTH kennt; `info` hängt endlos. Zustand stattdessen per `nak req -k 39000 -k 39001 -k 39002` prüfen |

Zwei inhaltliche Folgen daraus:

- **Gruppe öffnen braucht ein rohes `9002`.** Das Relay legt Gruppen als
  `private` + `closed` an. `nak group edit-metadata` lässt die Tags `public`
  und `open` weg, wenn die Flags falsch sind — `apply_tags` im Relay ist aber
  additiv und ändert nur, was als Tag vorhanden ist. `private` liesse sich so
  nie zurücknehmen. Deshalb einmal
  `nak event -k 9002 -h <gruppe> -t public= -t open= …`. Das ist weiterhin der
  vorgesehene NIP-29-Weg (ein Moderationsevent, das das Relay auswertet) und
  **kein** selbst signiertes `39000`.
- **Kind 0 wird abgelehnt.** Ein echtes NIP-29-Relay verlangt an jedem Event
  einen `h`-Tag; Profile gehören auf die Relays der Nutzerin
  (`VITE_PROFILE_RELAYS`). Lokal zeigt die App deshalb npubs statt Namen.

## Ports auf diesem Rechner

| Zweck | Port | Grund |
|---|---|---|
| App (Vite) | 5273 | 5173 ist von einem Container belegt |
| NIP-29-Relay | 8080 | — |
| `nak serve` (nur Notfall) | 10577 | 10547 ist von einem Relay-Container belegt |

## Kleinigkeiten, die Zeit gekostet haben

- **zsh:** `GID` ist eine reservierte Variable. `GID=engineering` bricht mit
  "failed to change group ID" ab. In Skripten `GROUP_ID` verwenden.
- **Jeder** nak-Aufruf in einem Skript braucht `</dev/null` — auch
  `nak key public`. Sonst blockieren sie auf stdin, wenn das Skript aus einer
  Pipe läuft. `nak event` ohne `-c` wartet ebenfalls auf stdin.
- nak liefert für erwartbare Zustände Exit 1 (z. B. "Group already exists").
  Mit `set -e` bricht ein Skript daran stumm ab — `|| true` setzen und die
  Ausgabe selbst prüfen.
- Ephemere Events (20000–29999) lehnt `nak serve` mit
  `mute: no one was listening for this` ab, wenn niemand abonniert hat. Das ist
  kein Rechteproblem.

## Konventionen

- Doku, Kommentare und Commit-Nachrichten auf Deutsch.
- Kind-Nummern und Tag-Namen nur in `src/nostr/kinds.ts`.
- Vor jedem Commit: `npm run typecheck && npm run build`.
- Platzhalter im UI benennen ihre Phase aus `docs/10-roadmap.md`.
