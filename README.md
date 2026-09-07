# nostr confluence

Ein Confluence-artiges Wiki, das komplett auf Nostr läuft: Login per NIP-07,
Spaces als NIP-29-Gruppen, Seiten als Markdown-Events, Versionshistorie als
signierte, hash-verkettete Revisionen — jede Änderung kryptografisch an einen
npub gebunden.

**Status: Phase 0 steht** (Grundgerüst, Theming, Relay-Status, Routing).
Konzeption unter [`docs/`](docs/), Phasenplan in
[`docs/10-roadmap.md`](docs/10-roadmap.md).

## Entwicklung starten

Drei Terminals, oder `just` benutzen:

```bash
nak serve --port 10577        # dummes Testrelay (in-memory)
./scripts/dev-relay-seed.sh   # Gruppen-Metadaten + Beispielseiten hineinschreiben
npm install && npm run dev    # App auf http://localhost:5273
```

Port 10577 statt des nak-Defaults 10547, weil dort oft schon ein Relay-Container
lauscht; Port 5273 statt 5173 aus dem gleichen Grund. Warum das Seed-Skript
nötig ist und was es simuliert: [`docs/08-relay-setup.md`](docs/08-relay-setup.md).

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
