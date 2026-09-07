#!/usr/bin/env bash
# Startet ein echtes NIP-29-Relay lokal: verse-pbc/groups_relay (Rust).
# Laeuft im Vordergrund wie ein Dev-Server — zum Stoppen Ctrl-C.
#
#   ./scripts/dev-relay-up.sh          baut beim ersten Mal und startet
#   GROUPS_RELAY_PORT=8081 ./scripts/dev-relay-up.sh
#
# Warum nicht `nak serve`: das implementiert NIP-29 nicht, Gruppen waeren nur
# Attrappe. Siehe AGENTS.md und docs/08-relay-setup.md.
#
# Quelle wird nach .local/groups_relay geklont (gitignored). Der native Bau
# ueber cargo ist der Standardweg; der mitgelieferte Dockerfile.dev schlaegt
# an `cargo build --features console` fehl.

set -euo pipefail

REPO="https://github.com/verse-pbc/groups_relay.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${GROUPS_RELAY_DIR:-$ROOT/.local/groups_relay}"
PORT="${GROUPS_RELAY_PORT:-8080}"

if [[ ! -d "$DIR" ]]; then
  command -v git >/dev/null || { echo "git fehlt"; exit 1; }
  echo "klone $REPO nach $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi

cd "$DIR"
mkdir -p db

if command -v cargo >/dev/null; then
  export RUSTFLAGS="--cfg tokio_unstable"
  export NIP29__relay__local_addr="0.0.0.0:$PORT"
  export NIP29__relay__relay_url="ws://localhost:$PORT"
  export RUST_LOG="${RUST_LOG:-info}"
  echo "baue groups_relay (erster Lauf dauert einige Minuten)…"
  cargo build --release --bin groups_relay
  echo
  echo "Relay startet auf ws://localhost:$PORT — danach in einem zweiten"
  echo "Terminal:  ./scripts/dev-group-seed.sh"
  exec ./target/release/groups_relay
fi

command -v docker >/dev/null || { echo "weder cargo noch docker vorhanden"; exit 1; }
echo "kein cargo gefunden, weiche auf Docker aus (Produktions-Dockerfile)"
exec docker compose -f compose.yml -f "$ROOT/docker/groups-relay.override.yml" up --build
