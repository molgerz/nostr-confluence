# nostr confluence

Ein Confluence-artiges Wiki, das komplett auf Nostr läuft: Login per NIP-07,
Spaces als NIP-29-Gruppen, Seiten als Markdown-Events, Versionshistorie als
signierte, hash-verkettete Revisionen — jede Änderung kryptografisch an einen
npub gebunden.

**Status: Phase 0 bis 5 stehen.** Anmelden mit NIP-07, Space mit Mitgliedern
und Seitenbaum, Seiten anlegen und bearbeiten, 3-Wege-Merge bei gleichzeitigem
Speichern, Versionshistorie mit Diff, Zeilenherkunft und Wiederherstellen —
alles gegen ein echtes NIP-29-Relay. Dazu Suche, Kommentare, Moderation,
Anzeigenamen, mobiles Layout, CodeMirror-Editor und Anhänge über Blossom.
Offen sind noch Echtzeit-Bearbeitung und NIP-46-Login.
Konzeption unter [`docs/`](docs/), Phasenplan in
[`docs/10-roadmap.md`](docs/10-roadmap.md).

## Entwicklung starten

Drei Terminals, oder `just` benutzen:

```bash
./scripts/dev-relay-up.sh     # echtes NIP-29-Relay auf ws://localhost:8080
./scripts/dev-group-seed.sh   # Space, Mitglieder, Beispielseiten via nak group
npm install && npm run dev    # App auf http://localhost:5273
```

Optional, für Anhänge und Anzeigenamen (siehe [`.env.example`](.env.example)):

```bash
node scripts/dev-blossom.mjs  # Anhänge auf http://localhost:3355
nak serve --port 10577        # Profile (Kind 0), die ein NIP-29-Relay nicht annimmt
```

Gruppen werden ausschließlich über `nak group` verwaltet, nie über selbst
signierte `39000`-Events — Begründung in [`AGENTS.md`](AGENTS.md), Details zum
Relay in [`docs/08-relay-setup.md`](docs/08-relay-setup.md). Port 5273 statt
5173, weil 5173 auf diesem Rechner von einem Container belegt ist.

## Leitidee in vier Sätzen

1. Ein *Space* ist eine NIP-29-Gruppe auf einem Relay. Das Relay ist die
   Zugriffs-Autorität — wer schreiben darf, entscheidet es, nicht der Client.
2. Eine *Seite* ist kein einzelnes Event, sondern eine Kette unveränderlicher
   Revisions-Events. Die Kette *ist* die Versionshistorie.
3. Jede Revision ist von einem npub signiert und zeigt per `parent-rev` auf ihren
   Vorgänger — dieselbe Idee wie ein Git-Commit, nur als Nostr-Event.
4. Der Client hält niemals einen privaten Schlüssel. Signieren macht die
   NIP-07-Extension.

## Konzept lesen

Start: [docs/README.md](docs/README.md)
