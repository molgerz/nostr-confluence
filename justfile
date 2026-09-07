# Entwicklungsaufgaben. `just` allein zeigt die Liste.
default:
    @just --list

# echtes NIP-29-Relay (verse-pbc/groups_relay) auf ws://localhost:8080
relay:
    ./scripts/dev-relay-up.sh

# Space, Mitglieder und Beispielseiten anlegen — ausschliesslich via nak group
seed:
    ./scripts/dev-group-seed.sh

# Gruppenzustand nachsehen
group-info:
    #!/usr/bin/env bash
    source scripts/.dev-keys
    PK=$(nak relay ws://localhost:8080 | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("self") or d.get("pubkey"))')
    ADDR=$(nak encode naddr -d engineering -k 39000 -a "$PK" -r ws://localhost:8080)
    nak group info --sec "$ALICE_SEC" --auth "$ADDR"
    nak group members --sec "$ALICE_SEC" --auth "$ADDR"

dev:
    npm run dev

check:
    npm run typecheck && npm run build
