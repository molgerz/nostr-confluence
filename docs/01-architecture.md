# 01 — Architektur

## Beteiligte

```
Browser-Tab                     Browser-Extension            Relay
┌──────────────────────┐        ┌──────────────────┐        ┌───────────────────┐
│ UI-Schicht           │        │ NIP-07 Signer    │        │ NIP-29 Relay      │
│ Nostr-Datenschicht   │◄──────►│ (Alby, nos2x)    │        │ Gruppen-Autorität │
│ Lokaler Cache        │◄───────┴──────────────────┘        │ Event-Speicher    │
└──────────┬───────────┘   signEvent / getPublicKey         └─────────┬─────────┘
           └──────────────────── WebSocket (REQ / EVENT / AUTH) ──────┘
```

Es gibt kein eigenes Backend. Alles, was ein klassisches Wiki serverseitig macht
(Rechte, Speicher, Historie), übernehmen Relay + Event-Design.

## Schichten im Client

1. **UI-Schicht** — React-Komponenten: Sidebar, Seitenansicht, Editor,
   Historie, Diff. Kennt keine Relay-Details, nur Domänenobjekte
   (`Space`, `Page`, `Revision`, `Member`).
2. **Domänenschicht** — übersetzt zwischen Nostr-Events und Domänenobjekten:
   Seitenbaum aus Revisions-Events aufbauen, Head-Auflösung, Diff berechnen,
   Konflikte erkennen.
3. **Nostr-Datenschicht** — Relay-Verbindungen, Subscriptions, Signieren,
   NIP-42-AUTH, Retry. Einzige Schicht, die `kind`-Nummern kennt.
4. **Cache-Schicht** — IndexedDB. Zweck: Sofort-Rendern beim Reload,
   Offline-Lesen, lokale Volltextsuche über Seiteninhalte.

**Entscheidung:** Kind-Nummern und Tag-Namen existieren an genau einer Stelle im
Code (`src/nostr/kinds.ts`). Keine magischen Zahlen in Komponenten.

## Datenfluss: Seite öffnen

1. Route `/space/:groupId/:slug` wird geöffnet.
2. Cache-Treffer wird sofort gerendert (falls vorhanden).
3. Subscription: alle Revisions-Events mit `#h=groupId` und `#s=slug`.
4. Domänenschicht baut die Revisionskette, ermittelt den Head.
5. UI rendert Markdown des Heads + Byline (npub, Zeit) + Konflikt-Banner,
   falls die Kette sich verzweigt hat.

## Datenfluss: Seite speichern

1. Editor kennt die Basis-Revision `base` (die, auf der er geöffnet wurde).
2. Vor dem Publish: Head erneut abfragen.
3. `head == base` → Revision mit `parent-rev = base` signieren und publishen.
4. `head != base` → 3-Wege-Merge-Dialog (Basis / meine Version / ihre Version).
5. Nach `OK` vom Relay: Cache aktualisieren, UI umschalten auf Leseansicht.

## Relay-Strategie

- **Ein Gruppen-Relay pro Space** ist die Autorität. Eine NIP-29-Gruppe wird als
  `<relay-host>'<group-id>` identifiziert — das Relay ist Teil der Identität.
- Zusätzliche Relays optional als Read-Replica/Backup (Events sind signiert,
  also verifizierbar auch von unbefugten Relays), aber die Rechteprüfung passiert
  nur auf dem Gruppen-Relay.
- **Offen:** Ob Spiegel-Relays im MVP überhaupt geschrieben werden. Vorschlag:
  nein, erst ab Phase 5.

## Warum kein Backend?

Weil jedes Backend die Vertrauensfrage nur verschiebt. Signatur + `parent-rev`
liefern Nachvollziehbarkeit ohne Server-Vertrauen; das Relay bleibt austauschbar,
weil die Historie in den Events selbst steckt.
