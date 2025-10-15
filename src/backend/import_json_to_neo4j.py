#!/usr/bin/env python3
"""
Import CPG JSON to Neo4j via batch HTTP API
"""
import json
import requests
import base64
import sys
import os

def main():
    if len(sys.argv) != 6:
        print("Usage: import_json_to_neo4j.py <json_file> <neo4j_host> <neo4j_port> <user> <password>", file=sys.stderr)
        print(f"Received {len(sys.argv)} arguments: {sys.argv}", file=sys.stderr)
        sys.exit(1)
    
    json_file = sys.argv[1]
    neo4j_host = sys.argv[2]
    neo4j_port = sys.argv[3]
    neo4j_user = sys.argv[4]
    neo4j_pass = sys.argv[5]
    
    # Load JSON
    with open(json_file) as f:
        cpg_data = json.load(f)
    
    # Neo4j connection (Neo4j 5.x uses different endpoint)
    auth = base64.b64encode(f'{neo4j_user}:{neo4j_pass}'.encode()).decode('ascii')
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Basic {auth}'
    }
    # Neo4j 5.x endpoint: /db/{database}/tx/commit
    url = f'http://{neo4j_host}:{neo4j_port}/db/neo4j/tx/commit'
    
    # Import nodes in batches
    nodes = cpg_data.get('nodes', [])
    batch_size = 5000
    print(f"» Importing {len(nodes)} nodes in batches of {batch_size}...")
    
    for i in range(0, len(nodes), batch_size):
        batch = nodes[i:i+batch_size]
        
        # Create Cypher for batch
        statements = []
        for node in batch:
            node_id = node['id']
            # Use backticks for Neo4j label escaping
            labels = ':'.join(['`' + l + '`' for l in node.get('labels', ['Node'])])
            props_str = ', '.join([f'{k}: {json.dumps(v)}' for k, v in node.get('properties', {}).items()])
            cypher = f"CREATE (n:{labels} {{__cpg_id__: {node_id}, {props_str}}})"
            statements.append({'statement': cypher})
        
        # Execute batch
        response = requests.post(url, headers=headers, json={'statements': statements})
        if response.status_code != 200:
            print(f"ERROR: Failed to import node batch {i//batch_size + 1}", file=sys.stderr)
            print(f"Status code: {response.status_code}", file=sys.stderr)
            print(f"Response: {response.text[:500]}", file=sys.stderr)
            sys.exit(1)
    
    print(f"✓ Imported {len(nodes)} nodes")
    
    # Import edges in batches
    edges = cpg_data.get('edges', [])
    print(f"» Importing {len(edges)} edges in batches of {batch_size}...")
    
    for i in range(0, len(edges), batch_size):
        batch = edges[i:i+batch_size]
        
        statements = []
        for edge in batch:
            start_id = edge['startNode']
            end_id = edge['endNode']
            edge_type = edge['type'].replace('-', '_').replace(' ', '_')
            props_str = ', '.join([f'{k}: {json.dumps(v)}' for k, v in edge.get('properties', {}).items()])
            props_part = f'{{{props_str}}}' if props_str else ''
            
            # Use backticks for Neo4j relationship type escaping
            cypher = f"MATCH (a {{__cpg_id__: {start_id}}}), (b {{__cpg_id__: {end_id}}}) CREATE (a)-[r:`{edge_type}` {props_part}]->(b)"
            statements.append({'statement': cypher})
        
        # Execute batch
        response = requests.post(url, headers=headers, json={'statements': statements})
        if response.status_code != 200:
            print(f"ERROR: Failed to import edge batch {i//batch_size + 1}", file=sys.stderr)
            print(f"Status code: {response.status_code}", file=sys.stderr)
            print(f"Response: {response.text[:500]}", file=sys.stderr)
            sys.exit(1)
    
    print(f"✓ Imported {len(edges)} edges")
    print(f"✓ APOC import complete: {len(nodes)} nodes, {len(edges)} edges")

if __name__ == '__main__':
    main()

