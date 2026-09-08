#!/usr/bin/env bash
# Starts a real NIP-29 relay locally: verse-pbc/groups_relay (Rust).
# Runs in the foreground like a dev server — Ctrl-C to stop.
#
#   ./scripts/dev-relay-up.sh          builds on the first run, then starts
#   GROUPS_RELAY_PORT=8081 ./scripts/dev-relay-up.sh
#
# Why not `nak serve`: it does not implement NIP-29, groups would only be a
# sham. See AGENTS.md and docs/08-relay-setup.md.
#
# The source is cloned into .local/groups_relay (gitignored). The native build
# via cargo is the default path; the bundled Dockerfile.dev fails at
# `cargo build --features console`.

set -euo pipefail

REPO="https://github.com/verse-pbc/groups_relay.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${GROUPS_RELAY_DIR:-$ROOT/.local/groups_relay}"
PORT="${GROUPS_RELAY_PORT:-8080}"

if [[ ! -d "$DIR" ]]; then
  command -v git >/dev/null || { echo "git is missing"; exit 1; }
  echo "cloning $REPO into $DIR"
  git clone --depth 1 "$REPO" "$DIR"
fi

cd "$DIR"
mkdir -p db

if command -v cargo >/dev/null; then
  export RUSTFLAGS="--cfg tokio_unstable"
  export NIP29__relay__local_addr="0.0.0.0:$PORT"
  export NIP29__relay__relay_url="ws://localhost:$PORT"
  export RUST_LOG="${RUST_LOG:-info}"
  echo "building groups_relay (the first run takes a few minutes)…"
  cargo build --release --bin groups_relay
  echo
  echo "relay starting on ws://localhost:$PORT — then, in a second"
  echo "terminal:  ./scripts/dev-group-seed.sh"
  exec ./target/release/groups_relay
fi

command -v docker >/dev/null || { echo "neither cargo nor docker available"; exit 1; }
echo "no cargo found, falling back to Docker (production Dockerfile)"
exec docker compose -f compose.yml -f "$ROOT/docker/groups-relay.override.yml" up --build
