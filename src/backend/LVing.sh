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

# Now handled by backend/handler.py
# echo "» Compiling to LLVM-IR …"
# rustc --emit=llvm-ir -g -C debuginfo=2 -C opt-level=0 -o "$LL" "$RUST_FILE"

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

## Debug: LLVM-IR preview suppressed
# echo "» LLVM-IR preview:"
# head -5 "$LL" | sed 's/^/  /'

echo "» Exporting CPG to Neo4j @ $NEO4J_BOLT …"

# Use cpg-neo4j with command-line arguments (not interactive commands)
echo "» Executing CPG translation and Neo4j export..."

# Create temporary files for capturing output
TEMP_OUT=$(mktemp)
TEMP_ERR=$(mktemp)

# Execute cpg-neo4j using Gradle wrapper (since direct executable doesn't exist)
if [ -f "/opt/cpg/gradlew" ]; then
  echo "» Using Gradle wrapper to execute CPG analysis..."
  cd /opt/cpg && ./gradlew :cpg-neo4j:run --args="--host=$NEO4J_HOST --port=$NEO4J_BOLT_PORT --user=$NEO4J_USER --password=$NEO4J_PASS $LL" > "$TEMP_OUT" 2> "$TEMP_ERR"
  CPG_EXIT_CODE=$?
elif command -v cpg-neo4j >/dev/null 2>&1; then
  cpg-neo4j \
    --host="$NEO4J_HOST" \
    --port="$NEO4J_BOLT_PORT" \
    --user="$NEO4J_USER" \
    --password="$NEO4J_PASS" \
    "$LL" > "$TEMP_OUT" 2> "$TEMP_ERR"
  CPG_EXIT_CODE=$?
else
  echo "ERROR: Neither gradlew nor cpg-neo4j found" >&2
  echo "Available executables:"
  find /opt/cpg -name "*neo4j*" -type f -executable 2>/dev/null || echo "No cpg-neo4j executable found"
  echo "Gradle wrapper status:"
  ls -la /opt/cpg/gradlew 2>/dev/null || echo "Gradle wrapper not found"
  exit 1
fi

# Process the output to show only relevant information
if [ $CPG_EXIT_CODE -eq 0 ]; then
  echo "✓ CPG analysis completed successfully"
  
  # Extract useful information from output if available
  if grep -q "nodes" "$TEMP_OUT" 2>/dev/null; then
    echo "» CPG processing details:"
    grep -E "(nodes|relationships|Processing|Finished)" "$TEMP_OUT" | head -3 | sed 's/^/  /'
  fi
else
  echo "ERROR: CPG analysis failed (exit code: $CPG_EXIT_CODE)" >&2
  echo "» Error details:" >&2
  
  # Show only the most relevant error lines
  if [ -s "$TEMP_ERR" ]; then
    # Extract key error messages, avoiding stack traces
    grep -E "(ERROR|Exception|Failed|Cannot|Unable)" "$TEMP_ERR" | head -5 | sed 's/^/  /' >&2
  fi
  
  if [ -s "$TEMP_OUT" ]; then
    # Check stdout for error indicators too
    grep -E "(ERROR|Exception|Failed)" "$TEMP_OUT" | head -3 | sed 's/^/  /' >&2
  fi
  
  # Clean up temp files before exit
  rm -f "$TEMP_OUT" "$TEMP_ERR"
  exit 1
fi

# Clean up temp files
rm -f "$TEMP_OUT" "$TEMP_ERR"

if [ $CPG_EXIT_CODE -ne 0 ]; then
  echo "ERROR: CPG analysis failed" >&2
  echo "Possible causes:" >&2
  echo "1. LLVM-IR file format is incompatible" >&2
  echo "2. Neo4j connection failed" >&2
  echo "3. cpg-neo4j doesn't support CPG commands" >&2
  exit 1
fi

echo "» Validating CPG import results..."

# Wait a moment for Neo4j to commit the transaction
echo "» Waiting for Neo4j to commit transaction..."
sleep 3

# Function to query Neo4j via HTTP REST API (more reliable than cypher-shell)
query_neo4j() {
  local cypher_query="$1"
  local max_retries=5
  local retry_count=0
  
  while [ $retry_count -lt $max_retries ]; do
    local result=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -H "Authorization: Basic $(echo -n "${NEO4J_USER}:${NEO4J_PASS}" | base64)" \
      -d "{\"statements\": [{\"statement\": \"$cypher_query\"}]}" \
      "http://${NEO4J_HOST}:${NEO4J_HTTP_PORT}/db/data/transaction/commit" 2>/dev/null)
    
    # Check if we got a valid response
    if echo "$result" | grep -q '"results"'; then
      echo "$result"
      return 0
    fi
    
  retry_count=$((retry_count + 1))
    sleep 2
  done
  
  echo ""  # Return empty on failure
  return 1
}

# Query node and edge counts with retries
NODE_RESULT=$(query_neo4j "MATCH (n) RETURN count(n) as nodeCount")
EDGE_RESULT=$(query_neo4j "MATCH ()-[r]->() RETURN count(r) as edgeCount")

# Extract counts from JSON response (improved parsing)
NODE_COUNT=$(echo "$NODE_RESULT" | grep -o '"nodeCount":[0-9]*' | grep -o '[0-9]*' | head -1)
EDGE_COUNT=$(echo "$EDGE_RESULT" | grep -o '"edgeCount":[0-9]*' | grep -o '[0-9]*' | head -1)

# Set defaults if parsing failed
NODE_COUNT=${NODE_COUNT:-0}
EDGE_COUNT=${EDGE_COUNT:-0}

# Validate that we got numeric results
if ! [[ "$NODE_COUNT" =~ ^[0-9]+$ ]]; then
  echo "WARNING: Could not validate CPG import - using default count" >&2
  NODE_COUNT=0
fi

if ! [[ "$EDGE_COUNT" =~ ^[0-9]+$ ]]; then
  echo "WARNING: Could not validate edge count - using default" >&2
  EDGE_COUNT=0
fi

echo "» CPG Analysis Results: $NODE_COUNT nodes, $EDGE_COUNT edges"

# Check for empty results - be more conservative
if [[ "$NODE_COUNT" -eq 0 && "$EDGE_COUNT" -eq 0 ]]; then
  # Only report as empty if we're confident the queries worked
  if [[ -n "$NODE_RESULT" && -n "$EDGE_RESULT" ]]; then
    echo "WARNING: CPG analysis produced an empty graph (0 nodes, 0 edges)" >&2
    echo "This usually indicates:" >&2
    echo "• Rust code was too simple (no complex operations to analyze)" >&2
    echo "• LLVM-IR format not fully supported by CPG library" >&2
    echo "• Code contains only basic variable assignments" >&2
    echo "" >&2
    echo "Try analyzing Rust code with:" >&2
    echo "• Function calls and definitions" >&2
    echo "• Memory operations (Vec, arrays, pointers)" >&2
    echo "• Control flow (if/else, match, loops)" >&2
    echo "• External crate usage" >&2
    exit 2  # Special exit code for empty results
  else
    echo "WARNING: Could not verify CPG import results - validation queries failed" >&2
    echo "CPG export may have succeeded, but unable to confirm node/edge counts" >&2
    # Don't exit with error code if we can't verify - assume success
  fi
fi

# Check for minimal results (might indicate partial analysis)
if [[ "$NODE_COUNT" -gt 0 && "$NODE_COUNT" -lt 5 ]]; then
  echo "NOTE: Very few nodes generated ($NODE_COUNT). Consider analyzing more complex code for better results." >&2
fi

echo "✓ CPG export completed successfully!"
if [[ "$NODE_COUNT" -gt 0 || "$EDGE_COUNT" -gt 0 ]]; then
  echo "✓ Graph contains: $NODE_COUNT nodes, $EDGE_COUNT edges"
else
  echo "✓ Data exported to Neo4j (validation pending)"
fi