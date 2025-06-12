#!/usr/bin/env bash
# Rust ➜ LLVM-IR ➜ CPG ➜ Neo4j  (updated for codyze-console)

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

# Use Docker service names for internal communication
NEO4J_HOST=${NEO4J_HOST:-neo4j}
NEO4J_BOLT_PORT=${NEO4J_BOLT_PORT:-7687}
NEO4J_HTTP_PORT=${NEO4J_HTTP_PORT:-7474}
NEO4J_BOLT="bolt://${NEO4J_HOST}:${NEO4J_BOLT_PORT}"
NEO4J_USER=${NEO4J_USER:-neo4j}

#ensure pw is provided
if [[ -z "${NEO4J_PASSWORD:-}" ]]; then
  echo "ERROR: NEO4J_PASSWORD environment variable is required!" >&2
  exit 1
fi

NEO4J_PASS="$NEO4J_PASSWORD"

# wait until neo4j bolt port is reachable
echo "» Waiting for Neo4j Bolt on ${NEO4J_HOST}:${NEO4J_BOLT_PORT} …"
timeout=60
counter=0
until nc -z "$NEO4J_HOST" "$NEO4J_BOLT_PORT"; do
  if [ $counter -ge $timeout ]; then
    echo "ERROR: Timeout waiting for Neo4j after ${timeout} seconds" >&2
    exit 1
  fi
  echo "  … still waiting for Neo4j ($counter/$timeout)"
  sleep 2
  ((counter += 2))
done
echo "» Neo4j is up."

# Verify LLVM file was created and has content
if [[ ! -f "$LL" ]]; then
  echo "ERROR: LLVM-IR file was not created: $LL" >&2
  exit 1
fi

if [[ ! -s "$LL" ]]; then
  echo "ERROR: LLVM-IR file is empty: $LL" >&2
  exit 1
fi

echo "» LLVM-IR file created successfully: $LL ($(wc -l < "$LL") lines)"

# Debug: Show first few lines of LLVM-IR
echo "» LLVM-IR preview:"
head -5 "$LL" | sed 's/^/  /'

echo "» Exporting CPG to Neo4j @ $NEO4J_BOLT …"

# Use cpg-neo4j with command-line arguments (not interactive commands)
echo "» Executing CPG translation and Neo4j export with cpg-neo4j..."
if command -v cpg-neo4j >/dev/null 2>&1; then
  cpg-neo4j \
    --host="$NEO4J_HOST" \
    --port="$NEO4J_BOLT_PORT" \
    --user="$NEO4J_USER" \
    --password="$NEO4J_PASS" \
    "$LL"
else
  echo "ERROR: cpg-neo4j not found in PATH" >&2
  echo "Available executables:"
  find /opt/cpg -name "*neo4j*" -type f -executable 2>/dev/null || echo "No cpg-neo4j executable found"
  exit 1
fi

if [ $? -ne 0 ]; then
  echo "ERROR: codyze-console failed" >&2
  echo "Possible causes:" >&2
  echo "1. LLVM-IR file format is incompatible" >&2
  echo "2. Neo4j connection failed" >&2
  echo "3. cpg-neo4j doesn't support CPG commands" >&2
  exit 1
fi

# Get the browser host for external access
NEO4J_BROWSER_HOST=${NEO4J_BROWSER_HOST:-$NEO4J_HOST}
echo "✓ Done — open Neo4j browser at http://${NEO4J_BROWSER_HOST}:${NEO4J_HTTP_PORT}"