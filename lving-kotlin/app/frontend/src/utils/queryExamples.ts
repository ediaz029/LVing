export interface Query {
  label: string,
  cypher: string,
}

const CYPHER_EXAMPLES: Record<string, Query[]> = {
  "test.rs": [
    {
      label: "default",
      cypher: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
    },
    {
      label: "second",
      cypher: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
    },
  ],
};

export function getQueryCandidates(filename: string): Query[] {
  return CYPHER_EXAMPLES[filename] || [];
}

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

