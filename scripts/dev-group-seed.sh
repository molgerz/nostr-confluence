#!/usr/bin/env bash
# Legt den Entwicklungs-Space auf einem echten NIP-29-Relay an — ausschliesslich
# ueber `nak group`. Gruppen-Metadaten (39000/39001/39002) erzeugt das Relay
# selbst; sie werden hier nie von Hand signiert. Siehe AGENTS.md.
#
# Voraussetzung: ./scripts/dev-relay-up.sh   (Relay auf ws://localhost:8080)
# Aufruf:        ./scripts/dev-group-seed.sh [relay-url] [gruppen-id]

set -euo pipefail

RELAY="${1:-ws://localhost:8080}"
GROUP_ID="${2:-engineering}"          # NICHT GID nennen: in zsh reserviert
KEYFILE="$(dirname "$0")/.dev-keys"

command -v nak >/dev/null || { echo "nak fehlt"; exit 1; }

# --- Preflight: spricht dieses Relay ueberhaupt NIP-29? --------------------
INFO=$(nak relay "$RELAY" </dev/null 2>/dev/null || true)
if [[ -z "$INFO" ]]; then
  echo "kein Relay auf $RELAY erreichbar — zuerst ./scripts/dev-relay-up.sh"
  exit 1
fi

read -r RELAY_NAME RELAY_PK HAS29 <<<"$(python3 - "$INFO" <<'PY'
import json, sys
doc = json.loads(sys.argv[1])
nips = doc.get("supported_nips", [])
print(
    doc.get("name", "?").replace(" ", "_"),
    doc.get("self") or doc.get("pubkey") or "-",
    "yes" if 29 in nips else "no",
)
PY
)"

echo "Relay:    $RELAY_NAME ($RELAY)"
if [[ "$HAS29" != "yes" ]]; then
  echo
  echo "Dieses Relay implementiert NIP-29 nicht. Gruppen wuerden nur simuliert,"
  echo "und genau das soll nicht passieren (AGENTS.md)."
  echo "Starte ein echtes Gruppen-Relay:  ./scripts/dev-relay-up.sh"
  exit 1
fi
if [[ "$RELAY_PK" == "-" ]]; then
  echo "Relay nennt in seinem NIP-11 keinen eigenen Pubkey (self/pubkey)."
  echo "Ohne den laesst sich keine naddr-Adresse bauen."
  exit 1
fi

# --- Wegwerf-Schluessel, nur fuer lokale Testrelays -----------------------
if [[ ! -f "$KEYFILE" ]]; then
  {
    echo "ALICE_SEC=$(nak key generate </dev/null)"
    echo "BOB_SEC=$(nak key generate </dev/null)"
  } > "$KEYFILE"
  echo "neue Wegwerf-Keys in $KEYFILE angelegt"
fi
# shellcheck source=/dev/null
source "$KEYFILE"
# stdin explizit schliessen: nak-Befehle lesen sonst von stdin und blockieren,
# wenn das Skript aus einer Pipe heraus laeuft.
ALICE_PK=$(nak key public "$ALICE_SEC" </dev/null)
BOB_PK=$(nak key public "$BOB_SEC" </dev/null)

ADDRESS=$(nak encode naddr -d "$GROUP_ID" -k 39000 -a "$RELAY_PK" -r "$RELAY" </dev/null)

# Alle nak-Aufrufe brauchen --fpa (force-pre-auth): dieses Relay filtert
# unauthentifizierte Leser stillschweigend heraus, statt mit "auth-required"
# abzulehnen — und nur auf eine Ablehnung würde --auth reagieren.
NAK_AUTH=(--fpa --sec "$ALICE_SEC")

run() { # run <sekunden> <befehl...>
  local limit="$1"; shift
  if command -v timeout >/dev/null; then timeout -k 2 "$limit" "$@" </dev/null 2>&1
  else "$@" </dev/null 2>&1; fi
}

echo "Gruppe:   $GROUP_ID"
echo "Admin:    $ALICE_PK (alice)"
echo "Mitglied: $BOB_PK (bob)"
echo

# create-group ohne --fpa: der Befehl haengt mit --fpa, weil er vor dem
# Publish Metadaten liest und dabei auf eine AUTH-Challenge wartet, die auf
# diesem Pfad nicht kommt. Das Anlegen selbst braucht kein AUTH.
echo "1) Gruppe anlegen (nak group create-group)"
OUT=$(run 25 nak group create-group --sec "$ALICE_SEC" "$ADDRESS") || true
if grep -q "already exists" <<<"$OUT"; then echo "   existiert schon"; else echo "   angelegt"; fi

# Das Relay legt Gruppen als private+closed an. `nak group edit-metadata` kann
# das nicht zurücknehmen: es laesst public/open weg, wenn sie falsch sind,
# waehrend dieses Relay Flags nur setzt, wenn der Tag vorhanden ist
# (apply_tags in src/group.rs ist additiv). Deshalb hier ein regulaeres
# 9002-Moderationsevent mit expliziten Tags — das ist der vorgesehene
# NIP-29-Weg, kein selbst signiertes 39000.
echo "2) Gruppe oeffnen und Metadaten setzen (Kind 9002)"
OUT=$(run 25 nak event --fpa --sec "$ALICE_SEC" -k 9002 -h "$GROUP_ID" \
  -t "name=Engineering" -t "about=Team-Wiki auf Nostr" \
  -t public= -t open= -t visible= -t nonbroadcast= \
  -t "supported_kinds=1818;1111;9" -c '' "$RELAY") || true
grep -q success <<<"$OUT" || { echo "   FEHLER: $(tail -1 <<<"$OUT")"; exit 1; }
echo "   public, open, supported_kinds=1818;1111;9"

echo "3) bob als Mitglied aufnehmen (nak group put-user)"
OUT=$(run 25 nak group put-user "${NAK_AUTH[@]}" --pubkey "$BOB_PK" "$ADDRESS") || true
grep -q '"kind":9000' <<<"$OUT" || { echo "   FEHLER: $(tail -1 <<<"$OUT")"; exit 1; }
echo "   aufgenommen"

echo "4) Beispielseiten (Inhalt, keine Gruppenverwaltung)"
page() { # page <sec> <slug> <titel> <elternslug> <notiz> <parent-rev> <text>
  local sec="$1" slug="$2" title="$3" parent="$4" note="$5" prev="$6" body="$7"
  local args=(--fpa --sec "$sec" -k 1818 -h "$GROUP_ID" -d "$slug"
              -t "title=$title" -t m=text/markdown)
  [[ -n "$parent" ]] && args+=(-t "page-parent=$parent")
  [[ -n "$note" ]] && args+=(-t "summary=$note")
  [[ -n "$prev" ]] && args+=(-t "parent-rev=$prev")
  local out
  out=$(run 25 nak event "${args[@]}" -c "$body" "$RELAY") || true
  grep -q success <<<"$out" || { echo "   ABGELEHNT ($slug): $(tail -1 <<<"$out")"; exit 1; }
  LAST_ID=$(grep -o '"id":"[0-9a-f]\{64\}"' <<<"$out" | head -1 | cut -d'"' -f4)
  echo "   $slug ${LAST_ID:0:8}"
}

page "$ALICE_SEC" handbuch Handbuch "" "" "" '# Handbuch

Elternseite fuer die Sidebar.'
page "$ALICE_SEC" onboarding Onboarding handbuch "" "" '# Onboarding

Erste Revision.'
FIRST="$LAST_ID"
page "$BOB_SEC" onboarding Onboarding handbuch "Abschnitt ergaenzt" "$FIRST" '# Onboarding

Erste Revision.

## Zugaenge

Von bob ergaenzt.'

echo
echo "5) Vom Relay erzeugter Gruppenzustand"
# Bewusst rohe REQs statt `nak group info`: dessen interner Pool
# authentifiziert nicht und der Befehl haengt gegen dieses Relay.
run 15 nak req "${NAK_AUTH[@]}" -k 39000 -k 39001 -k 39002 --limit 3 "$RELAY" \
  | grep '^{' | python3 -c '
import json, sys
names = {39000: "39000 Metadaten", 39001: "39001 Admins ", 39002: "39002 Mitglieder"}
for line in sys.stdin:
    e = json.loads(line)
    label = names.get(e["kind"], str(e["kind"]))
    tags = ", ".join("=".join(t) if len(t) > 1 else t[0] for t in e["tags"] if t[0] != "d")
    print("   " + label + ": " + tags)
'

cat <<OUT

fertig.

  Gruppen-Adresse:  $(sed 's|wss\{0,1\}://||' <<<"$RELAY")'$GROUP_ID
  naddr:            $ADDRESS
  App:              npm run dev  ->  http://localhost:5273

Nachsehen:
  nak req --fpa --sec \$ALICE_SEC -k 1818 -t h=$GROUP_ID $RELAY
OUT
