#!/usr/bin/env bash
# Simuliert die Leseseite eines NIP-29-Relays auf einem "dummen" nak-Relay.
#
# Hintergrund: `nak serve` implementiert NIP-29 nicht (supported_nips enthaelt
# kein 29) — es erzeugt also keine 39000/39001/39002 und setzt keine Rechte
# durch. Es speichert aber jedes signierte Event. Also erzeugen wir die
# Gruppen-Metadaten selbst, signiert mit einem lokalen "Fake-Relay"-Key.
# Damit funktionieren `nak group info/members/admins` und der komplette
# Lesepfad der App gegen ein rein lokales Relay.
#
# Was damit NICHT getestet werden kann: Rechtedurchsetzung. Jeder Key darf
# schreiben. Dafuer ab Phase 4 verse-pbc/groups_relay verwenden.
#
# Voraussetzung:  nak serve --port 10577   (in einem zweiten Terminal)
# Aufruf:         ./scripts/dev-relay-seed.sh [relay-url] [group-id]
#
# Port 10577 statt des nak-Defaults 10547: 10547 kollidiert haeufig mit einem
# bereits laufenden Relay-Container. Das Skript prueft deshalb per NIP-11 nach,
# mit welchem Relay es wirklich spricht.

set -euo pipefail

RELAY="${1:-ws://localhost:10577}"
GROUP_ID="${2:-engineering}"            # NICHT GID nennen: in zsh reserviert
KEYFILE="$(dirname "$0")/.dev-keys"

need() { command -v "$1" >/dev/null || { echo "fehlt: $1"; exit 1; }; }
need nak

# --- Preflight: mit welchem Relay reden wir ueberhaupt? ---------------------
INFO=$(nak relay "$RELAY" </dev/null 2>/dev/null || true)
if [[ -z "$INFO" ]]; then
  echo "kein Relay auf $RELAY erreichbar."
  echo "starte es mit:  nak serve --port ${RELAY##*:}"
  exit 1
fi
RELAY_NAME=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("name","?"))' <<<"$INFO")
RELAY_SOFT=$(python3 -c 'import json,sys;print(json.loads(sys.stdin.read()).get("software","?"))' <<<"$INFO")
echo "Relay meldet sich als: $RELAY_NAME ($RELAY_SOFT)"
if python3 -c 'import json,sys;sys.exit(0 if 29 in json.loads(sys.stdin.read()).get("supported_nips",[]) else 1)' <<<"$INFO"; then
  echo "Dieses Relay unterstuetzt NIP-29 selbst — dann NICHT simulieren,"
  echo "sondern 'nak group create-group' und 'nak group put-user' benutzen."
  exit 1
fi

# --- Wegwerf-Schluessel, nur fuer lokale Testrelays -------------------------
if [[ ! -f "$KEYFILE" ]]; then
  {
    echo "RELAY_SEC=$(nak key generate)"
    echo "ALICE_SEC=$(nak key generate)"
    echo "BOB_SEC=$(nak key generate)"
  } > "$KEYFILE"
  echo "neue Wegwerf-Keys in $KEYFILE angelegt"
fi
# shellcheck source=/dev/null
source "$KEYFILE"

RELAY_PK=$(nak key public "$RELAY_SEC")
ALICE_PK=$(nak key public "$ALICE_SEC")
BOB_PK=$(nak key public "$BOB_SEC")

# publiziert und legt die Event-ID in $LAST_ID ab (nicht nachtraeglich abfragen:
# die Relay-Reihenfolge ist nicht garantiert und Altbestand verfaelscht das Ergebnis)
LAST_ID=""
pub() {
  local out
  out=$(nak event "$@" "$RELAY" </dev/null 2>&1) || { echo "  FEHLER"; echo "$out"; exit 1; }
  grep -q success <<<"$out" || { echo "  FEHLER"; echo "$out"; exit 1; }
  LAST_ID=$(grep -o '"id":"[0-9a-f]\{64\}"' <<<"$out" | head -1 | cut -d'"' -f4)
  echo "  ok  ${LAST_ID:0:8}"
}

echo "Relay:    $RELAY"
echo "Gruppe:   $GROUP_ID"
echo

echo "39000 Gruppen-Metadaten (Fake-Relay signiert)"
pub --sec "$RELAY_SEC" -k 39000 -d "$GROUP_ID" -c '' \
    -t name=Engineering \
    -t about="Team-Wiki auf Nostr" \
    -t supported_kinds="1818;1111;9"
# kein 'restricted'-Tag  => Nicht-Mitglieder duerfen schreiben
# kein 'closed'-Tag      => jede/r darf beitreten
# kein 'private'-Tag     => Inhalt oeffentlich lesbar

echo "39001 Admins"
pub --sec "$RELAY_SEC" -k 39001 -d "$GROUP_ID" -c '' -t p="$ALICE_PK;ceo"

echo "39002 Mitglieder"
pub --sec "$RELAY_SEC" -k 39002 -d "$GROUP_ID" -c '' -t p="$ALICE_PK" -t p="$BOB_PK"

echo "1818 Beispielseite 'handbuch' (alice)"
pub --sec "$ALICE_SEC" -k 1818 -h "$GROUP_ID" -d handbuch \
    -t title=Handbuch -t m=text/markdown \
    -c '# Handbuch

Elternseite fuer die Sidebar.'

echo "1818 Beispielseite 'onboarding' (alice)"
pub --sec "$ALICE_SEC" -k 1818 -h "$GROUP_ID" -d onboarding \
    -t title=Onboarding -t page-parent=handbuch -t m=text/markdown \
    -c '# Onboarding

Erste Revision.'

FIRST="$LAST_ID"

echo "1818 zweite Revision derselben Seite (bob), parent-rev=${FIRST:0:8}"
pub --sec "$BOB_SEC" -k 1818 -h "$GROUP_ID" -d onboarding \
    -t title=Onboarding -t page-parent=handbuch -t m=text/markdown \
    -t parent-rev="$FIRST" -t summary="Abschnitt ergaenzt" \
    -c '# Onboarding

Erste Revision.

## Zugaenge

Von bob ergaenzt.'

NADDR=$(nak encode naddr -d "$GROUP_ID" -k 39000 -a "$RELAY_PK" -r "$RELAY")

cat <<OUT

fertig.

  Gruppen-Adresse (NIP-29):  $(echo "$RELAY" | sed 's|ws://||;s|wss://||')'$GROUP_ID
  naddr fuer nak group:      $NADDR
  alice (Admin):             $ALICE_PK
  bob   (Mitglied):          $BOB_PK

Pruefen:
  nak group info    $NADDR
  nak group members $NADDR
  nak req -k 1818 -t h=$GROUP_ID $RELAY

Hinweis: 'nak group put-user/create-group' schicken ihre 9000/9007-Events, aber
ein dummes Relay reagiert nicht darauf. Mitgliederaenderungen im Simulationsmodus
immer ueber dieses Skript (39002 neu publishen).
OUT
