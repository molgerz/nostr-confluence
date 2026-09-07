# 04 — Rechte: NIP-29-Gruppen

## Grundprinzip

Bei NIP-29 ist **das Relay die Autorität**. Es kennt die Mitglieder, prüft bei
jedem eingehenden Event mit `h`-Tag, ob der Absender schreiben darf, und lehnt
sonst mit `OK false` ab. Der Client setzt keine Rechte durch — er zeigt nur an,
was er weiß, und rechnet damit, abgelehnt zu werden.

Eine Gruppe wird identifiziert als `<relay-host>'<group-id>`, z. B.
`relay.example.com'engineering`. Das Relay gehört zur Identität des Spaces.

## Relay-generierte Zustandsevents (nur lesen)

| Kind | Inhalt | Nutzung im UI |
|---|---|---|
| `39000` | Name, Bild, `about`, Flags, `supported_kinds` | Space-Kopf in der Sidebar, Sichtbarkeits-Badge |
| `39001` | Admins mit Rollen | "Space-Einstellungen", Moderations-Buttons nur für Admins |
| `39002` | Mitglieder | Mitgliederliste, Autor-Badge "Mitglied" an Revisionen |
| `39003` | Verfügbare Rollen | Rollenauswahl beim Einladen |

Diese Events sind vom Relay signiert, nicht von Nutzern. Sie sind Anzeige- und
Filtergrundlage, nicht Beweis.

## Nutzer-Events zur Verwaltung

| Kind | Aktion | Wer |
|---|---|---|
| `9007` | Gruppe erstellen | wer darf (relayabhängig) |
| `9002` | Metadaten ändern (Name, Bild, Flags) | Admin |
| `9000` | Mitglied hinzufügen / Rolle setzen | Admin |
| `9001` | Mitglied entfernen | Admin |
| `9005` | Event löschen (Moderation) | Admin |
| `9009` | Einladungscode erzeugen | Admin |
| `9021` | Beitritt anfragen (optional mit Code) | jede/r |
| `9022` | Austritt | Mitglied |

### Flags in `39000` (Stand der aktuellen NIP-29-Implementierung)

Geprüft an `fiatjaf.com/nostr/nip29` (2026-09-07): die Metadaten kennen die
Tags `private`, `restricted`, `closed`, `hidden`, `livekit`, `supported_kinds`
sowie `parent`/`child` für verschachtelte Gruppen.

| Tag | Wirkung bei Anwesenheit | Fehlt der Tag |
|---|---|---|
| `restricted` | Nur Mitglieder dürfen publishen | **Nicht-Mitglieder dürfen publishen** |
| `closed` | Beitritt nur per Einladung/Freigabe | Jede/r darf beitreten |
| `private` | Inhalt nur für Mitglieder lesbar | Inhalt öffentlich lesbar |
| `hidden` | Gruppe nicht in Relay-Listen sichtbar | Gruppe auffindbar |
| `supported_kinds` | Liste der akzeptierten Kinds | Unspezifiziert |

Am laufenden `groups_relay` am 2026-09-07 nachgemessen:

- Eine neu angelegte Gruppe ist **`private` + `closed`** — nicht offen. Das
  Öffnen ist ein eigener Schritt.
- `apply_tags` im Relay ist **additiv**: ein Flag ändert sich nur, wenn der
  entsprechende Tag im `9002` vorhanden ist. `public` und `open` müssen also
  ausdrücklich gesendet werden, sonst bleibt die Gruppe privat.
- Solange eine Gruppe `private` ist, liefert das Relay ihre Metadaten an
  unauthentifizierte Leser **gar nicht** aus (Log: "User is not authenticated,
  cannot see event … kind 39000") — ohne Fehlermeldung, einfach leer.
- Ist sie `public`, gilt im Relay-Code "Public groups are always visible":
  Lesen ohne Anmeldung funktioniert. Damit hält die Zusage aus
  [06](06-ui-information-architecture.md), dass Lesen keinen Login braucht —
  aber nur für öffentliche Spaces.

Für uns wichtig: **weglassen** ist die offene Variante. Für Anforderung 4 setzen
wir also weder `restricted` noch `closed` noch `private`. Und `supported_kinds`
sollte `1818` enthalten — die App liest den Tag und warnt sonst.

`parent`/`child` erlauben verschachtelte Gruppen. Das ist eine mögliche
Alternative zu unserem seitenbasierten Baum, wenn Spaces später Unter-Spaces
bekommen sollen. **Offen**, bewusst nicht im MVP.

## Anforderung 4: "grundsätzlich darf jeder bearbeiten"

Das ist im NIP-29-Modell eine Flag-Kombination:

- **`open`** — Beitrittsanfragen (`9021`) werden automatisch angenommen. Wer die
  Gruppe kennt, wird Mitglied und darf damit schreiben.
- **`public`** — Die Gruppeninhalte sind ohne Mitgliedschaft lesbar.

**Entscheidung MVP:** Space ist `public` + `open`. Effekt: jede/r mit npub kann
lesen, und mit einem Klick ("Diesem Space beitreten") schreiben. Kein Admin muss
freischalten.

**Geprüft am Quellcode von `verse-pbc/groups_relay` (2026-09-07):** In einer
`open`-Gruppe wird der Autor beim Posten automatisch Mitglied ("Open groups
auto-join the author when posting"), und `39002` wird dabei aktualisiert. Ein
expliziter `9021`-Beitritt ist dort also nicht nötig — Schreiben genügt.

Die App behandelt beides, weil andere Relays strenger sein können:

1. Publish direkt versuchen. Erfolg → fertig (Auto-Join-Fall).
2. Bei Ablehnung mit Mitgliedschaftsgrund → `9021` senden, auf `39002` warten,
   erneut publishen.
3. Bleibt es abgelehnt (`closed`-Gruppe) → Hinweis "Beitritt anfragen" statt
   Editor.

UI-Zustände dafür: "Beitritt läuft" und "Beitritt abgelehnt".

## Umgesetzt in der App

Die Space-Übersicht zeigt die Mitgliederliste aus `39002` mit den Rollen aus
`39001`. Admins bekommen dort zusätzlich ein Feld, um jemanden per npub oder
Hex aufzunehmen (`9000`), und pro Mitglied einen Knopf zum Entfernen (`9001`).
In Historie und Kommentaren können Admins einzelne Events entfernen (`9005`),
mit Rückfrage, weil das Relay diese Löschung wirklich durchsetzt.

Alle diese Aktionen sind **Anträge**: Das Relay prüft die Admin-Eigenschaft und
lehnt sonst ab. Die App korrigiert die Mitgliederliste deshalb nie lokal,
sondern zeigt, was das Relay als neues `39002` zurückschickt.

## Rechte-Stufen, die wir abbilden

| Stufe | Wie durchgesetzt |
|---|---|
| Lesen | Relay: bei `private` nur Mitglieder (nach NIP-42-AUTH) |
| Schreiben / Bearbeiten | Relay: Absender muss Mitglied sein (`h`-Tag-Prüfung) |
| Moderieren (löschen, Mitglieder) | Relay: Absender muss Admin sein (`39001`) |
| Seiten sperren ("nur Admins dürfen diese Seite ändern") | **nicht** relay-durchsetzbar |

Der letzte Punkt ist eine echte Grenze: NIP-29 kennt Rechte pro Gruppe, nicht
pro Seite. Eine "gesperrte Seite" wäre nur eine UI-Konvention, die ein anderer
Client ignorieren kann. **Entscheidung:** Wir bauen keine Seitensperre und sagen
das offen, statt Scheinsicherheit anzuzeigen. Wer Seiten mit engeren Rechten
braucht, bekommt einen eigenen Space.

## Was ein bösartiges Relay kann

- Events verschweigen (Historie unvollständig zeigen) → mitigiert durch
  `previous`-Timeline-Referenzen: fehlende Vorgänger sind erkennbar, und die App
  zeigt "Historie unvollständig" statt stillschweigend zu kürzen.
- Mitgliederlisten fälschen → betrifft nur die Anzeige; Autorschaft der
  Revisionen bleibt durch die Signatur unangreifbar.
- Nicht möglich: Inhalte im Namen einer anderen Person schreiben. Ohne deren
  privaten Schlüssel gibt es keine gültige Signatur.
