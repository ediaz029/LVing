export const CYPHER_EXAMPLES: Record<string, string> = {
  all_edges: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  dfg_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  eog_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:EOG*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  ast_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:AST*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  refers_to: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:REFERS_TO*1..3]-(ref)
RETURN path`,
  
  pdg_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:PDG*1..6]-(dep)
RETURN path`,
  
  usage_scope: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:USAGE|SCOPE*1..4]-(related)
RETURN path`,
  
  full_context: `MATCH (start)
WHERE start.code CONTAINS 'sendable_ptr'
WITH start
CALL {
  WITH start
  MATCH path1 = (start)-[:DFG*1..4]-(dfg_node)
  RETURN path1
  UNION
  WITH start
  MATCH path2 = (start)-[:EOG*1..3]-(eog_node)
  RETURN path2
  UNION
  WITH start
  MATCH path3 = (start)-[:AST*1..2]-(ast_node)
  RETURN path3
  UNION
  WITH start
  MATCH path4 = (start)-[:REFERS_TO]-(ref_node)
  RETURN path4
}
RETURN path1, path2, path3, path4`,

  simple_all_nodes: `MATCH (n)
RETURN n LIMIT 100`,

  simple_relationships: `MATCH (n)-[r]->(m)
RETURN n, r, m LIMIT 50`
};

export const QUERY_EXAMPLE_OPTIONS = [
  { value: 'all_edges', label: '🔗 All Edge Types (DFG + EOG + AST + REFERS_TO + PDG + USAGE + SCOPE)' },
  { value: 'dfg_only', label: '📊 Data Flow Graph (DFG) Only' },
  { value: 'eog_only', label: '🔄 Execution Order Graph (EOG) Only' },
  { value: 'ast_only', label: '🌳 Abstract Syntax Tree (AST) Only' },
  { value: 'refers_to', label: '🔗 References (REFERS_TO) Only' },
  { value: 'pdg_only', label: '📈 Program Dependence Graph (PDG) Only' },
  { value: 'usage_scope', label: '🎯 Usage & Scope Relations' },
  { value: 'full_context', label: '🔍 Full Context (Multiple Union Queries)' },
  { value: 'simple_all_nodes', label: '📦 Simple: All Nodes (Limit 100)' },
  { value: 'simple_relationships', label: '🔗 Simple: All Relationships (Limit 50)' }
];

