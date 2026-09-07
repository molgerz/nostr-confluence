# 05 — Versionierung & gemeinsames Arbeiten

## Modell: Git-Semantik in Nostr-Events

Eine Revision ist ein Commit:

| Git | Hier |
|---|---|
| Commit-Hash | Event-`id` (Hash über das Event) |
| Autor | `pubkey` → npub, **kryptografisch, nicht behauptet** |
| Zeitstempel | `created_at` |
| Parent-Commit | Tag `parent-rev` |
| Commit-Message | Tag `summary` |
| Blob | `content` (kompletter Markdown-Snapshot) |
| Branch-Head | Blatt der Kette |
| Merge-Commit | Revision mit zwei `parent-rev`-Tags |

Die Kette ist damit nachprüfbar: Reihenfolge ergibt sich aus `parent-rev`, nicht
aus dem Zeitstempel des Relays. Ein Relay kann Ereignisse verschweigen, aber
keine falsche Reihenfolge behaupten und keine fremde Autorschaft erfinden.

```
rev1 (alice) ──► rev2 (bob) ──► rev3 (carol)   ← Head
                     │
                     └──► rev2b (dave)          ← Verzweigung, offener Konflikt
```

## Speichern mit optimistischer Sperre

Confluence sagt "Diese Seite wurde in der Zwischenzeit geändert". Genau das
brauchen wir, weil parallele Bearbeitung sonst Text verliert.

1. Editor öffnet Seite auf Basis `base = <head-id>`.
2. Beim Klick auf "Speichern": Head neu vom Relay holen.
3. `head == base` → Revision mit `parent-rev = base` publishen. Fertig.
4. `head != base` → **3-Wege-Merge**: gemeinsame Basis, "deine Änderungen",
   "Änderungen von <npub>". Drei Optionen im Dialog:
   - automatisch zusammenführen (wenn die Änderungen unterschiedliche Absätze
     betreffen — `diff3`-artig, clientseitig)
   - manuell auflösen im Editor mit Konfliktmarkern
   - als Verzweigung speichern (zwei Blätter, bewusst offen gelassen)
5. Ergebnis einer Auflösung ist eine Merge-Revision mit zwei `parent-rev`-Tags.

**Entscheidung:** Kein Silent-Overwrite. Wenn der Head sich bewegt hat, wird
immer gefragt.

## Historien-Ansicht

Pro Seite eine Zeitachse, jüngste oben:

```
● 11:40  carol   „Abschnitt Deployment ergänzt"      [Diff] [Wiederherstellen]
● 11:15  bob     „Tippfehler"                        [Diff] [Wiederherstellen]
● 10:02  alice   Seite erstellt                      [Diff]
```

Jeder Eintrag zeigt Avatar + Anzeigename aus `kind 0`, darunter den gekürzten
npub. Der npub ist die Wahrheit, der Anzeigename nur Komfort — das UI macht das
sichtbar (Name grau, npub monospace daneben), damit zwei Personen mit gleichem
Anzeigenamen nicht verwechselt werden können.

Funktionen:

- **Diff** — Zwei Revisionen wählen, Zeilen-Diff mit Wort-Hervorhebung
  (`jsdiff`). Weil jede Revision ein Volltext-Snapshot ist, ist jeder beliebige
  Vergleich möglich, nicht nur benachbarte.
- **Blame** — Zeilenweise Zuordnung: für jede Zeile die jüngste Revision, die sie
  eingeführt hat, plus deren npub. Wird clientseitig aus der Kette berechnet.
- **Wiederherstellen** — Publisht eine *neue* Revision mit dem alten Inhalt,
  `parent-rev = aktueller Head`, plus Tag `restore-of = <alte-id>`. Nichts wird
  gelöscht; die Historie bleibt append-only.
- **Signatur prüfen** — Detailansicht einer Revision zeigt Event-ID, `sig`-Status
  und `content-hash`. Das ist der Punkt, an dem "an den npub geknüpft" für
  Nutzende überprüfbar wird und nicht nur behauptet.

## Löschen

- Nutzerin löscht eigene Revision: NIP-09 `kind 5` — eine *Bitte* an Relays.
  Andere Kopien können bleiben. Das UI formuliert es deshalb als "Löschung
  anfragen".
- Admin löscht fremdes Event: NIP-29 `kind 9005`, wird vom Gruppen-Relay
  durchgesetzt.
- Seite als Ganzes: neue Revision mit Tag `deleted` (Tombstone) + `9005` auf die
  Vorgänger, damit Sidebar und Suche sie ausblenden.

## Verhältnis zu ngit / NIP-34

Du hattest ngit im Kopf — das ist der Git-über-Nostr-Stack: NIP-34 mit
`30617` Repo-Ankündigung, `1617` Patches, `1621` Issues. Zwei Wege:

| Weg | Vorteil | Nachteil |
|---|---|---|
| **A: eigene Revisionskette (`1818`)** — gewählt | Genau auf Wiki-Seiten zugeschnitten, ein Event = eine lesbare Seite, kein Git-Repo nötig | Kein Tooling-Ökosystem, eigener Kind |
| B: NIP-34-Patches (`1617`) | Kompatibel mit ngit/gitworkshop, echte Diffs, Merge-Requests vorhanden | Patch-Replay nötig, um eine Seite zu lesen; Repo-Konzept passt schlecht auf "Space mit 200 Seiten" |

**Entscheidung:** Weg A für den MVP, weil Lesen dadurch ein einziger
Event-Fetch bleibt. Die Git-Eigenschaften, die dir wichtig sind (Autorschaft am
npub, Parent-Verkettung, Diff, Blame, Merge), liefert Weg A vollständig.
NIP-34-Export bleibt als späteres Feature möglich.

## Echtzeit-Kollaboration (Phase 6)

Für gleichzeitiges Tippen: CRDT (Yjs oder Loro) als Transport über ephemere
Events (`20000`–`29999`) im `h`-Scope der Gruppe — Relays speichern die nicht.
Beim Speichern wird der CRDT-Zustand als normale `1818`-Revision festgeschrieben.
Damit bleibt die Historie sauber (eine Revision pro Speicherung), und Live-Cursor
sind ein Zusatz statt eine Änderung am Datenmodell.

**Nicht-Ziel im MVP** — bewusst später, weil das Konfliktmodell aus Schritt 4
ohne CRDT schon funktioniert.
