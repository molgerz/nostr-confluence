# Was dieses Projekt von Nostr benutzt

nostr confluence ist ein Wiki ohne eigenen Server: Identität ist ein npub,
Speicher sind Relay-Events, Rechte kommen von einer NIP-29-Gruppe. Diese Datei
listet auf, welche NIPs, Event-Kinds und Tags dabei tatsächlich im Spiel sind —
inklusive dem, was bewusst **nicht** dem Standard folgt.

Legende: ✅ umgesetzt · ⚠️ umgesetzt, aber mit Einschränkung oder Eigenbau ·
❌ bewusst (noch) nicht

* * *

## Stand jetzt: die Gruppe entsteht ausserhalb der App

Wichtig für jede/n, der das hier zum ersten Mal liest — **so soll es nicht
bleiben**:

- **Die App kann keinen Space anlegen und keine Gruppen-Metadaten ändern.**
  Beides passiert ausschliesslich über die Kommandozeile mit `nak`, gebündelt
  in [`scripts/dev-group-seed.sh`](scripts/dev-group-seed.sh):
  `nak group create-group` legt die Gruppe an, ein `9002`-Event öffnet sie
  (`public`, `open`, `supported_kinds`), `nak group put-user` nimmt Leute auf.
  In der App gibt es dafür bisher keinen einzigen Knopf.
- **Die Beispielinhalte kommen ebenfalls aus dem Seed-Skript**, nicht aus einer
  echten Nutzung: zwei Seiten, eine zweite Revision, zwei Wegwerf-Schlüssel.
- **Es läuft alles lokal.** Relay auf `localhost:8080`, Anhänge auf
  `localhost:3355`, Profile auf `localhost:10577`. Es gibt kein Deployment,
  keine Domain, kein TLS.

Was dagegen **nicht** (mehr) simuliert wird: die Gruppe selbst. Sie liegt auf
einem echten NIP-29-Relay ([`verse-pbc/groups_relay`](https://github.com/verse-pbc/groups_relay)),
das Mitgliedschaft und Rechte wirklich durchsetzt. Eine frühere Fassung hatte
die Gruppen-Metadaten `39000`/`39001`/`39002` mit `nak serve` selbst signiert —
das war eine Attrappe, in der nichts geprüft wurde, und ist bewusst rausgeflogen
(Begründung in der [AGENTS.md](AGENTS.md)).

**Damit fehlt für einen echten Einsatz:** Space in der App anlegen (`9007`),
Metadaten in der App ändern (`9002`), Beitritt anfragen (`9021`) für Relays
ohne Auto-Join, und ein Relay unter eigener Domain mit TLS. Alles im Backlog,
siehe [docs/10](docs/10-roadmap.md).

* * *

## NIPs

| NIP | Status | Wofür | Code |
|---|---|---|---|
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) Basis | ✅ | Events, Filter, `REQ`/`EVENT`/`OK` | `src/nostr/client.ts` |
| [NIP-07](https://github.com/nostr-protocol/nips/blob/master/07.md) Browser-Signer | ✅ | Anmeldung über `window.nostr`, Signieren ohne Schlüssel in der App | `src/nostr/signer.ts` |
| [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) Relay-Info | ✅ | Relay-Name, `supported_nips`, Relay-Pubkey für `naddr` | `src/nostr/relay-status.ts` |
| [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) bech32 | ✅ | `npub` anzeigen, npub-Eingabe in der Mitgliederverwaltung | `src/nostr/profile.ts` |
| [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md) Kommentare | ⚠️ | Kommentare (Kind 1111) — Verankerung weicht ab, siehe unten | `src/domain/comment.ts` |
| [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md) Gruppen | ✅ | Spaces, Mitgliedschaft, Moderation. Das Relay ist die Autorität | `src/domain/group-state.ts`, `src/nostr/moderation.ts` |
| [NIP-31](https://github.com/nostr-protocol/nips/blob/master/31.md) `alt` | ✅ | Klartext-Beschreibung an eigenen Kinds, damit fremde Clients etwas anzeigen können | `src/nostr/publish-page.ts` |
| [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) AUTH | ✅ | Anmeldung am Relay, automatisch bei jeder neuen Verbindung, Wiederholung nach `auth-required` | `src/nostr/client.ts` |
| [Blossom](https://github.com/hzrd149/blossom) BUD-01/02 | ✅ | Anhänge: Blob liegt beim Server unter seinem sha256, im Event steht nur die URL | `src/nostr/blossom.ts` |
| [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) Löschanfrage | ❌ | Gelöscht wird nur über NIP-29 (`9005`), das ein Relay wirklich durchsetzt | — |
| [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) Bunker | ❌ | Geplant als zweite Signer-Implementierung hinter demselben Interface | — |
| [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) Suche | ❌ | Bewusst nicht: unterstützt nicht jedes Relay, und eine relay-abhängige Suche wäre offline kaputt. Gesucht wird lokal | `src/domain/search.ts` |
| [NIP-54](https://github.com/nostr-protocol/nips/blob/master/54.md) Wiki | ⚠️ | Vorbild für die Slug-Normalisierung; `30818` als Interop-Spiegel ist geplant, nicht gebaut | `src/nostr/kinds.ts` |
| [NIP-34](https://github.com/nostr-protocol/nips/blob/master/34.md) git | ❌ | Geprüft und verworfen: Patch-Replay zum Lesen einer Seite. Die Git-Semantik steckt stattdessen im eigenen Revisions-Kind | [docs/05](docs/05-versioning-history.md) |
| [NIP-96](https://github.com/nostr-protocol/nips/blob/master/96.md) Dateien | ❌ | Alternative zu Blossom, nicht implementiert | — |

* * *

## Event-Kinds

### Wir schreiben

| Kind | Status | Bedeutung |
|---|---|---|
| **1818** Seiten-Revision | ⚠️ eigener Kind | Der eigentliche Inhalt. Unveränderlich, mit `parent-rev` verkettet, Volltext-Snapshot. **Kein Standard** — fremde Clients zeigen das nicht an |
| **1111** Kommentar | ⚠️ | NIP-22, aber an `(h, d)` verankert statt an einem Wurzel-Event |
| **20817** Diagnose-Ping | ⚠️ eigener Kind | Ephemer (20000–29999), wird nicht gespeichert. Nur für „darf ich hier schreiben?" |
| **24242** Blossom-Upload | ✅ | Autorisiert einen Datei-Upload. Kein Relay-Event, geht per HTTP an den Blossom-Server |
| **22242** Relay-AUTH | ✅ | NIP-42, erzeugt von `nostr-tools` |
| **9000** / **9001** Mitglied auf/abnehmen | ✅ | Antrag an das Relay, das die Admin-Eigenschaft prüft |
| **9005** Event löschen | ✅ | Moderation; das Relay setzt die Löschung durch |
| **9002** Metadaten ändern | ⚠️ nur im Seed | Wird von `scripts/dev-group-seed.sh` gesendet, nicht aus der App |
| **9007** Gruppe anlegen | ⚠️ nur im Seed | Über `nak group create-group` |

### Wir lesen

| Kind | Status | Bedeutung |
|---|---|---|
| **0** Profil | ✅ | Anzeigename und Avatar, gebündelt geholt. Ein NIP-29-Relay nimmt Kind 0 nicht an — Profile kommen von anderen Relays (`VITE_PROFILE_RELAYS`) |
| **39000** Gruppen-Metadaten | ✅ | Name, Beschreibung, Flags, `supported_kinds`. Vom Relay signiert |
| **39001** Admins | ✅ | Rollen; steuert, wer Moderationsknöpfe sieht |
| **39002** Mitglieder | ✅ | Mitgliederliste |
| **39003** Rollen-Definitionen | ❌ | Wird nicht ausgewertet |
| **30818** Wiki-Artikel | ❌ | Als Interop-Spiegel geplant |
| **5** Löschanfrage | ❌ | Siehe NIP-09 oben |
| **9021** Beitritt | ❌ | In offenen Gruppen unnötig: das Relay nimmt den Autor beim ersten Schreiben automatisch auf. Fallback für strengere Relays fehlt noch |

* * *

## Tags

| Tag | Wo | Bedeutung |
|---|---|---|
| `h` | überall | Gruppen-ID. **Daran prüft das Relay die Schreibberechtigung** — das ist unser gesamtes Rechtesystem |
| `d` | 1818, 1111 | Normalisierter Seiten-Slug. Einbuchstabig, also relay-indexiert und filterbar |
| `title` | 1818 | Anzeigetitel |
| `parent-rev` | 1818 | Vorgänger-Revision. Keiner = erste Revision, zwei = Zusammenführung |
| `page-parent` | 1818 | Slug der Elternseite; daraus entsteht der Sidebar-Baum |
| `summary` | 1818 | Änderungsnotiz, entspricht der Commit-Message |
| `content-hash` | 1818 | sha256 des Inhalts |
| `restore-of` | 1818 | Wiederherstellung verweist auf ihre Vorlage |
| `m` | 1818 | Immer `text/markdown` |
| `alt` | 1818, 1111 | NIP-31-Fallback für fremde Clients |
| `K` / `k` / `e` / `p` | 1111 | NIP-22: Art des Wurzelobjekts, Art des Bezugs, Elternkommentar, dessen Autor |
| `supported_kinds` | 39000 (gelesen) | Kinds, die die Gruppe annimmt. Fehlt `1818`, warnt die App **vor** dem Publish |
| `previous` | — | ❌ NIP-29-Timeline-Referenzen werden **nicht** geschrieben. `groups_relay` prüft sie ohnehin nicht |

### Beispiel: eine Seiten-Revision

```json
{
  "kind": 1818,
  "pubkey": "<npub der Autorin, hex>",
  "content": "# Onboarding\n\nWillkommen im Team …",
  "tags": [
    ["h", "engineering"],
    ["d", "onboarding"],
    ["title", "Onboarding"],
    ["m", "text/markdown"],
    ["content-hash", "<sha256>"],
    ["alt", "Wiki-Seite \"Onboarding\" im Space engineering"],
    ["page-parent", "handbuch"],
    ["summary", "Abschnitt Zugänge ergänzt"],
    ["parent-rev", "<id der Vorgänger-Revision>"]
  ]
}
```

Eine Seite ist damit **kein einzelnes Event**, sondern das Paar
`(Gruppe, Slug)` plus die Kette ihrer Revisionen. Warum das so sein muss:
adressierbare Events (`30xxx`) gehören immer genau einem Schlüsselpaar — zwei
Leute könnten dieselbe Seite sonst gar nicht bearbeiten. Ausführlich in
[docs/02](docs/02-data-model-events.md).

* * *

## Was das Relay können muss

| Anforderung | Warum |
|---|---|
| NIP-29 (`supported_nips` enthält 29) | Ohne echte Gruppenlogik sind Mitgliedschaft und Rechte Attrappe |
| NIP-42 | Private Gruppen und Schreibzugriff hängen daran |
| `1818` und `1111` in `supported_kinds` der Gruppe | Sonst lehnt das Relay die Seiten ab, obwohl die Person Mitglied ist |
| Gruppe auf `public` + `open` (kein `private`, kein `closed`) | Damit Lesen ohne Anmeldung geht und jede/r schreiben darf |

Geprüft und empfohlen: [`verse-pbc/groups_relay`](https://github.com/verse-pbc/groups_relay).
`nak serve` ist **kein** NIP-29-Relay — Details und die Fallstricke stehen in
[docs/08](docs/08-relay-setup.md) und der [AGENTS.md](AGENTS.md).

```bash
./scripts/dev-relay-up.sh     # Relay auf ws://localhost:8080
./scripts/dev-group-seed.sh   # Gruppe und Beispielseiten, ausschliesslich via nak group
```

* * *

## Mit `nak` nachsehen

Wichtig gegen dieses Relay: `--fpa` (force-pre-auth), nicht `--auth` — es
filtert unauthentifizierte Leser stillschweigend heraus, statt sie abzulehnen.

```bash
source scripts/.dev-keys

# alle Seiten-Revisionen der Gruppe
nak req --fpa --sec "$ALICE_SEC" -k 1818 -t h=engineering ws://localhost:8080

# eine bestimmte Seite mit ihrer Kette
nak req --fpa --sec "$ALICE_SEC" -k 1818 -t d=onboarding ws://localhost:8080

# den vom Relay erzeugten Gruppenzustand
nak req --fpa --sec "$ALICE_SEC" -k 39000 -k 39001 -k 39002 ws://localhost:8080

# Kommentare
nak req --fpa --sec "$ALICE_SEC" -k 1111 -t h=engineering ws://localhost:8080

# eine Seite von Hand schreiben
nak event --fpa --sec "$ALICE_SEC" -k 1818 -h engineering -d notizen \
  -t title=Notizen -t m=text/markdown -c '# Notizen' ws://localhost:8080
```

`nak group info|members|edit-metadata` funktioniert gegen dieses Relay **nicht**
(sein interner Pool authentifiziert nicht, `info` hängt). Deshalb rohe `req`.

* * *

## Konfiguration

| Variable | Default | Bedeutung |
|---|---|---|
| `VITE_RELAY_URL` | `ws://localhost:8080` | Das Gruppen-Relay. Es ist Teil der Space-Identität (`host'gruppe`) |
| `VITE_PROFILE_RELAYS` | leer | Relays für Kind 0. Leer heisst: die App zeigt npubs statt Namen — ehrlicher als ein erfundener Name |
| `VITE_BLOSSOM_SERVER` | leer | Blossom-Server für Anhänge. Leer heisst: der Anhang-Knopf ist deaktiviert |

* * *

## Abweichungen und Grenzen

Ehrlich benannt, weil sie beim Weiterbauen wichtig sind:

- ⚠️ **`1818` ist kein Standard-Kind.** Der Inhalt ist für andere
  Nostr-Clients unsichtbar. Der `alt`-Tag ist der einzige Trost. Ein
  `30818`-Spiegel für NIP-54-Wiki-Clients ist geplant.
- ⚠️ **Kommentare sind an `(h, d)` verankert**, nicht per `A`/`E` an einem
  Wurzel-Event. Ein Verweis auf eine Revision wäre nach der nächsten
  Bearbeitung verwaist ([docs/02](docs/02-data-model-events.md)).
- ⚠️ **`previous`-Timeline-Referenzen fehlen.** Ein Relay kann Events
  verschweigen; erkennbar wären Lücken nur über diese Tags. `groups_relay`
  prüft sie ohnehin nicht.
- ⚠️ **Zeilenherkunft folgt dem ersten Vorgänger.** Bei einer
  Merge-Revision erscheinen die Zeilen des zweiten Zweigs als von der
  Zusammenführung eingeführt — wie `git blame` ohne Zusatzoptionen.
- ⚠️ **Rechte gelten pro Gruppe, nicht pro Seite.** NIP-29 kennt nichts
  Feineres. Eine „gesperrte Seite" wäre reine UI-Kosmetik, deshalb gibt es sie
  nicht ([docs/04](docs/04-permissions-nip29.md)).
- ⚠️ **Kein E2EE.** Eine `private` Gruppe ist zugriffsbeschränkt, nicht
  verschlüsselt: der Relay-Betreiber liest mit. Bewusste Entscheidung
  ([docs/09](docs/09-security-privacy.md)).
- ⚠️ **Löschen ist relativ.** `9005` wirkt auf diesem Relay; Kopien anderswo
  bleiben.
- ⚠️ **`created_at` ist manipulierbar**, weil der Client ihn setzt. Für die
  Reihenfolge zählt primär die `parent-rev`-Kette, die Uhrzeit ist Anzeige.

* * *

## Wo was liegt

| Thema | Datei |
|---|---|
| Alle Kinds und Tags an einer Stelle | `src/nostr/kinds.ts` |
| Relay-Verbindung, NIP-42, Publish mit Retry | `src/nostr/client.ts` |
| Signer-Interface (NIP-07, später NIP-46) | `src/nostr/signer.ts` |
| Revisionen lesen, Head auflösen, Seitenbaum | `src/domain/revision.ts`, `src/domain/pages.ts` |
| 3-Wege-Merge | `src/domain/merge.ts` |
| Gruppen-Zustand und Moderation | `src/domain/group-state.ts`, `src/nostr/moderation.ts` |
| Anhänge | `src/nostr/blossom.ts`, `scripts/dev-blossom.mjs` |

Die Begründung hinter jeder Entscheidung steht in [docs/](docs/README.md),
die Arbeitsregeln für dieses Repo in [AGENTS.md](AGENTS.md).
