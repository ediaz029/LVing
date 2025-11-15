export interface Query {
  label: string,
  cypher: string,
}

const CYPHER_EXAMPLES: Record<string, Query[]> = {
  "004_RawData.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["ptr2", "ptr1"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG",
  minLevel: 1,
  maxLevel: 7,
  dfs: true
})
YIELD path
RETURN path`
    },
  ],
  "003_AtomicThread.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["atomic_ptr", "ptr.dbg.spill"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "REFERS_TO<|EOG>|DFG>",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`
    },
  ],
  "018_ThreadSwap.rs": [
    {
      label: "default",
      cypher: `MATCH (n:TrackedVariable)
WHERE n.name IN ["ptr", "vec2", "x.dbg.spill"]
WITH collect(n) AS nodes

UNWIND range(0, size(nodes)-1) AS i
UNWIND range(i+1, size(nodes)-1) AS j

WITH nodes[i] AS a, nodes[j] AS b
CALL apoc.algo.dijkstra(
  a, b,
  "DFG>|<AST|EOG>",
  "1"
) YIELD path
RETURN a.name AS from, b.name AS to, path`
    },
  ],
  "006_SharedBufferX.rs": [
    {
      label: "default",
      cypher: ``
    },
  ],
  "001_PointerThread.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["ptr1", "ptr2"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG",
  minLevel: 1,
  maxLevel: 4
})
YIELD path
RETURN path`
    },
  ],
  "009_HeapThreadA.rs": [
    {
      label: "default",
      cypher: `MATCH (n:TrackedVariable)
WHERE n.name IN ["sendable_ptr", "boxed", "value.dbg.spill"]
WITH collect(n) AS nodes

UNWIND range(0, size(nodes)-1) AS i
UNWIND range(i+1, size(nodes)-1) AS j

WITH nodes[i] AS a, nodes[j] AS b
CALL apoc.algo.dijkstra(
  a, b,
  "DFG>|<AST|EOG>",
  "1"
) YIELD path
RETURN a.name AS from, b.name AS to, path`
    },
  ],
  "010_HeapThreadX.rs": [
    {
      label: "default",
      cypher: ``
    },
  ],
  "014_Swap.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["s1"]
MATCH (e: CallExpression)
WHERE e.fullName CONTAINS "core::ptr::drop_in_place"
WITH n, COLLECT(e) AS es
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "<REFERS_TO|EOG>",
  minLevel: 1,
  maxLevel: 5,
  terminatorNodes: es
})
YIELD path
RETURN path`
    },
  ],
  "017_VecExtend.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["vec"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG>|EOG>",
  minLevel: 1,
  maxLevel: 2
})
YIELD path
RETURN path`
    },
  ],
  "020_VecThreadRaw.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["vec_main", "vec_thread"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "EOG>|REFERS_TO",
  minLevel: 1,
  maxLevel: 4
})
YIELD path
RETURN path`
    },
  ],
  "019_DropTrait.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["resource"]
MATCH (e: CallExpression)
WHERE e.fullName STARTS WITH "core::ptr::drop_in_place"
CALL apoc.path.expandConfig(n, {
    relationshipFilter: "EOG>|DFG|REFERS_TO<",
    endNodes: [e],
    minLevel: 1,
    maxLevel: 8,
    bfs: true,
    uniqueness: "NODE_GLOBAL",
    limit: 1
}) YIELD path
RETURN path`
    },
  ],
  "008_StringSlice.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["s", "x.dbg.spill"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`
    },
  ],
  "005_DeallocThread.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["ptr1", "ptr2"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG",
  minLevel: 1,
  maxLevel: 4
})
YIELD path
RETURN path`
    },
  ],
  "013_WeakArc.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["arc", "weak"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "EOG>|REFERS_TO<|DFG>",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`
    },
  ],
  "007_StringAllocation.rs": [
    {
      label: "default",
      cypher: `MATCH (e)
WHERE e.fullName CONTAINS "core::ptr::drop_in_place" OR e.fullName CONTAINS "llvm.dbg.declare"
WITH COLLECT(e) AS blacklist
MATCH (n: TrackedVariable)
WHERE n.name IN ["v"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "EOG>|REFERS_TO<",
  minLevel: 1,
  maxLevel: 7,
  blacklistNodes: blacklist
})
YIELD path
RETURN path`
    },
  ],
  "016_PhantomData.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["wrapper"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "EOG>|REFERS_TO<",
  minLevel: 1,
  maxLevel: 2
})
YIELD path
RETURN path`
    },
  ],
  "015_ReadWrite.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["data"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "REFERS_TO<|EOG>",
  minLevel: 1,
  maxLevel: 2
})
YIELD path
RETURN path`
    },
  ],
  "012_LifetimeElision.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["x"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG|EOG>",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`
    },
  ],
  "002_CellThread.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["ptr1", "ptr2"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "DFG",
  minLevel: 1,
  maxLevel: 4
})
YIELD path
RETURN path`
    },
  ],
  "011_DynTrait.rs": [
    {
      label: "default",
      cypher: `MATCH (n: TrackedVariable)
WHERE n.name IN ["x.dbg.spill", "animal", "dog"]
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "EOG>|REFERS_TO<|AST<",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`
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

