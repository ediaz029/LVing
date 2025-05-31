#!/usr/bin/env bash
# Rust ➜ LLVM-IR ➜ CPG ➜ Neo4j  (container-safe version)

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <rust_file>.rs"
  exit 1
fi

RUST_FILE=$(realpath "$1")
BASE=$(basename "$RUST_FILE" .rs)
DIR=$(dirname  "$RUST_FILE")
LL="$DIR/$BASE.ll"

echo "» Compiling to LLVM-IR …"
rustc --emit=llvm-ir -g -C debuginfo=2 -C opt-level=0 -o "$LL" "$RUST_FILE"

# Neo4j connection params from environment variables
NEO4J_HOST=${NEO4J_HOST:-neo4j}
NEO4J_BOLT_PORT=${NEO4J_BOLT_PORT:-7687}
NEO4J_HTTP_PORT=${NEO4J_HTTP_PORT:-7474}
NEO4J_BOLT="bolt://${NEO4J_HOST}:${NEO4J_BOLT_PORT}"
NEO4J_USER=${NEO4J_USER:-neo4j}

# Critical: Password must be provided
if [[ -z "${NEO4J_PASSWORD:-}" ]]; then
  echo "ERROR: NEO4J_PASSWORD environment variable is required!" >&2
  exit 1
fi

NEO4J_PASS="$NEO4J_PASSWORD"

echo "» Exporting CPG to Neo4j @ $NEO4J_BOLT …"
/opt/cpg/cpg-console/build/install/cpg-console/bin/cpg-console <<EOF
:tr $LL
:e neo4j $NEO4J_USER $NEO4J_PASS
EOF

echo "✓ Done — open Neo4j browser at http://${NEO4J_HOST}:${NEO4J_HTTP_PORT}"