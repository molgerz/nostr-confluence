# 09 — Sicherheit & Privacy

## Was kryptografisch garantiert ist

- **Autorschaft**: Jede Revision ist mit dem Schlüssel ihres npub signiert.
  Niemand — auch das Relay nicht — kann Inhalte im Namen einer anderen Person
  erzeugen.
- **Integrität**: Die Event-`id` ist ein Hash über Inhalt und Tags. Nachträgliche
  Änderung eines Events ist nicht möglich, nur eine neue Revision.
- **Reihenfolge**: `parent-rev` verankert jede Revision an ihrem Vorgänger.

## Was ausdrücklich nicht garantiert ist

- **Vollständigkeit**: Ein Relay kann Events verschweigen. Teil-Mitigation:
  `previous`-Timeline-Referenzen (NIP-29) machen Lücken erkennbar; die App zeigt
  dann "Historie möglicherweise unvollständig" statt eine glatte Liste.
  Einschränkung: `groups_relay` implementiert Timeline-Referenzen laut README
  nicht, prüft den Tag also nicht. Die Lückenerkennung bleibt damit eine
  clientseitige Heuristik über `parent-rev`-Ketten mit fehlenden Gliedern.
- **Vertraulichkeit**: Eine `private` NIP-29-Gruppe ist *zugriffsbeschränkt*,
  nicht verschlüsselt. Der Relay-Betreiber liest alles im Klartext.
  **Entscheidung (bestätigt):** Das ist für den Einsatzzweck in Ordnung — das
  Relay gehört der Firma bzw. dem Admin, das Vertrauensmodell entspricht einem
  selbst gehosteten Wiki. Konsequenz für das UI: kein Schloss-Symbol und keine
  Formulierung, die E2EE suggeriert. Stattdessen wörtlich: "Mitglieder und der
  Relay-Betreiber sehen den Inhalt."
  E2EE bleibt bewusst außerhalb des Projekts; sie wäre mit
  relay-durchgesetzten Rechten und Volltextsuche auch nicht vereinbar.
- **Löschung**: NIP-09 ist eine Bitte. Einmal publiziert, kann Inhalt auf Kopien
  bestehen bleiben. UI-Wortwahl: "Löschung anfragen".
- **Zeitstempel**: `created_at` setzt der Client, ist also manipulierbar. Für die
  Sortierung gilt primär die `parent-rev`-Kette; die Uhrzeit ist Anzeige.

## Client-Angriffsflächen

| Risiko | Maßnahme |
|---|---|
| XSS über Markdown fremder npubs | `rehype-sanitize` mit strikter Allowlist, kein `dangerouslySetInnerHTML`, kein rohes HTML, keine `javascript:`-Links |
| Bild-/Iframe-Einbettung als Tracker | Externe Bilder nur über Proxy oder mit Klick-zum-Laden; keine Iframes |
| Gefälschte `h`-Tags (Event aus fremder Gruppe eingeschmuggelt) | Nach dem Laden prüfen: `h` muss dem geöffneten Space entsprechen, sonst verwerfen |
| Signaturprüfung vergessen | Verifikation in der Datenschicht erzwingen, nicht optional pro Aufruf |
| Impersonation über Anzeigenamen | npub immer mitanzeigen; Mitglieds-Badge nur bei Eintrag in `39002` |
| Spam in offenen Spaces | Rate-Limits des Relays + Moderations-Löschung (`9005`) + UI-Filter "nur Mitglieder anzeigen" |
| Schlüsseldiebstahl durch die App | Kein Umgang mit nsec. Ausschließlich NIP-07/NIP-46 |

## Datenschutz-Hinweis für Nutzende

Ein npub ist ein dauerhaftes Pseudonym: alle Beiträge einer Person sind über
Relays hinweg verknüpfbar. Für Teams mit Klarnamenbezug bedeutet das faktisch
eine öffentliche Aktivitätshistorie. Das gehört in die Onboarding-Seite der App,
nicht ins Kleingedruckte.
