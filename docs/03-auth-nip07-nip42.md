# 03 — Login: NIP-07 und NIP-42

## Was NIP-07 ist

Eine Browser-Extension (Alby, nos2x, Nostr Connect …) stellt `window.nostr`
bereit. Die App ruft daran:

| Aufruf | Zweck |
|---|---|
| `getPublicKey()` | Pubkey hex → Identität, daraus `npub…` per NIP-19 |
| `signEvent(event)` | Signiert ein Event. Der private Schlüssel verlässt die Extension nie |
| `getRelays()` | Vorschlagsliste von Relays der Nutzerin (optional) |
| `nip44.encrypt/decrypt` | Erst relevant, wenn wir private Inhalte verschlüsseln (nicht MVP) |

**Entscheidung:** Die App speichert nie einen privaten Schlüssel und bietet auch
kein Feld dafür an. Session = Pubkey + Zeitstempel in `localStorage`, alles
Signieren geht durch die Extension.

## Ablauf

1. **Erkennen** — Nach dem Mount kurz auf `window.nostr` warten (Extensions
   injizieren asynchron; ~500 ms Polling). Fehlt sie: Hinweisseite mit Link auf
   Alby/nos2x statt Login-Button ins Leere.
2. **Identität** — `getPublicKey()`. Das löst den Extension-Dialog aus, muss also
   aus einer Nutzeraktion (Klick) kommen, nicht beim Seitenladen.
3. **Profil** — `kind 0` der Nutzerin laden für Name und Avatar. Fällt zurück auf
   `npub1abc…xyz` (gekürzt), wenn kein Profil existiert.
4. **Relay-AUTH (NIP-42)** — Das NIP-29-Relay schickt beim Verbinden
   `["AUTH", "<challenge>"]`. Der Client signiert ein `kind 22242`-Event mit
   `relay`- und `challenge`-Tag und antwortet mit `["AUTH", <event>]`. Erst
   danach darf er in Gruppen schreiben und private Gruppen lesen.
5. **Session aktiv** — Gruppenliste laden (`39002`, gefiltert auf den eigenen
   Pubkey → "meine Spaces"), Sidebar rendern.

## Praktische Fallen

- **Zweiter Signaturdialog**: `getPublicKey()` und AUTH sind zwei Dialoge.
  Alby merkt sich Berechtigungen pro Domain; trotzdem im UI erklären, warum
  zweimal gefragt wird.
- **AUTH-Wiederholung**: Bei Reconnect kommt eine neue Challenge. Die
  Datenschicht muss AUTH automatisch erneut abwickeln, sonst schlägt der nächste
  Publish still fehl. Publish-Fehler (`OK false`, Grund `auth-required`) müssen
  in einen Retry nach AUTH laufen.
- **Mehrere Accounts**: Extension-Wechsel während der Session → Pubkey vor jedem
  Publish erneut abfragen und mit der Session vergleichen. Bei Abweichung
  Session neu aufsetzen statt fremd signieren.
- **Read-only ohne Login**: Öffentliche Spaces sollen ohne Extension lesbar sein.
  Also: Login nur für Schreibaktionen erzwingen, Leseansicht funktioniert anonym.

## Später: NIP-46

NIP-46 (Bunker/Remote-Signer) erlaubt Login ohne Extension, z. B. am Handy. Das
Interface ist dasselbe (`getPublicKey`, `signEvent`), daher: Signer hinter einem
Interface `Signer` abstrahieren, damit NIP-46 eine zweite Implementierung ist und
kein Umbau.
