# Development tasks. `just` on its own lists them.
default:
    @just --list

# real NIP-29 relay (verse-pbc/groups_relay) on ws://localhost:8080
relay:
    ./scripts/dev-relay-up.sh

# create the space, its members and sample pages — via nak group only
seed:
    ./scripts/dev-group-seed.sh

# inspect the group state
group-info:
    #!/usr/bin/env bash
    source scripts/.dev-keys
    PK=$(nak relay ws://localhost:8080 | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("self") or d.get("pubkey"))')
    ADDR=$(nak encode naddr -d engineering -k 39000 -a "$PK" -r ws://localhost:8080)
    nak group info --sec "$ALICE_SEC" --auth "$ADDR"
    nak group members --sec "$ALICE_SEC" --auth "$ADDR"

# Blossom server for attachments (development only)
blossom:
    node scripts/dev-blossom.mjs

# relay for profiles (kind 0) — a NIP-29 relay will not accept them
profile-relay:
    nak serve --port 10577

dev:
    npm run dev

check:
    npm run typecheck && npm run build
