#!/bin/bash
# Test script for JSON + APOC import optimization

set -e

echo "=========================================="
echo "Testing JSON + APOC Import Pipeline"
echo "=========================================="

# Create a simple test Rust file
cat > /tmp/test_import.rs <<'RUST'
fn factorial(n: u32) -> u32 {
    match n {
        0 => 1,
        _ => n * factorial(n - 1)
    }
}

fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2)
    }
}

fn main() {
    let f1 = factorial(10);
    let f2 = fibonacci(10);
    println!("Factorial: {}, Fibonacci: {}", f1, f2);
}
RUST

echo "✓ Created test Rust file: /tmp/test_import.rs"
echo ""

# Submit to the /convert endpoint
echo "Submitting to /convert endpoint..."
START_TIME=$(date +%s)

# Send file content properly - use @ to read from file in curl  
# The <file syntax reads file content as the form field value
RESPONSE=$(curl -s -X POST -F "code=</tmp/test_import.rs" http://localhost:8000/convert/)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "=========================================="
echo "Results:"
echo "=========================================="
echo "Duration: ${DURATION} seconds"
echo ""

# Extract status from response
if echo "$RESPONSE" | grep -q "success"; then
    echo "✓ Import successful!"
    
    # Count nodes in Neo4j
    NODE_COUNT=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -u neo4j:${NEO4J_PASSWORD:-password} \
        -d '{"statements": [{"statement": "MATCH (n) RETURN count(n) as count"}]}' \
        http://localhost:7474/db/data/transaction/commit | \
        grep -o '"count":[0-9]*' | grep -o '[0-9]*' | head -1)
    
    echo "Nodes in Neo4j: ${NODE_COUNT}"
    
    # Count edges in Neo4j
    EDGE_COUNT=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -u neo4j:${NEO4J_PASSWORD:-password} \
        -d '{"statements": [{"statement": "MATCH ()-[r]->() RETURN count(r) as count"}]}' \
        http://localhost:7474/db/data/transaction/commit | \
        grep -o '"count":[0-9]*' | grep -o '[0-9]*' | head -1)
    
    echo "Edges in Neo4j: ${EDGE_COUNT}"
else
    echo "✗ Import failed!"
    echo "Response: $RESPONSE"
    exit 1
fi

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="

# Clean up
rm -f /tmp/test_import.rs

