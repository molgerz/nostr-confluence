# Entwicklungsaufgaben. `just` allein zeigt die Liste.
default:
    @just --list

# dummes Testrelay (Phase 0-3). Port 10577, weil 10547 oft belegt ist.
relay:
    nak serve --port 10577

# dasselbe, aber mit erzwungenem NIP-42 zum Testen des Login-Flows
relay-auth:
    nak serve --port 10577 --auth

# Gruppen-Metadaten und Beispielseiten in das laufende Testrelay schreiben
seed:
    ./scripts/dev-relay-seed.sh

# echtes NIP-29-Relay ab Phase 4 (siehe docs/08-relay-setup.md)
relay-nip29:
    @echo "git clone https://github.com/verse-pbc/groups_relay && cd groups_relay && docker compose up --build"

dev:
    npm run dev

check:
    npm run typecheck && npm run build
