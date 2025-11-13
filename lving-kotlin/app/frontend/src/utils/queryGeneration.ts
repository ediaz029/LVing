const edges = [
  { value: "DFG", label: "📊 Data Flow Graph (DFG)"},
  { value: 'EOG', label: '🔄 Execution Order Graph (EOG)' },
  { value: 'AST', label: '🌳 Abstract Syntax Tree (AST)' },
  { value: 'REFERS_TO', label: '🔗 References (REFERS_TO)' },
  { value: 'PDG', label: '📈 Program Dependence Graph (PDG)' },
  { value: 'USAGE|SCOPE', label: '🎯 Usage & Scope Relations' },
];

export type Option = { value: string, label: string, direction: "<" | ">" | "<>" };

/*
* Returns array of { value: str, label: str} indicative of applicable edge and general query types.
*/
export function getCypherOptions(): Option[] {
  var cyphers: Option[] = [];
  edges.forEach(e => {
    cyphers.push({
        value: e.value,
        label: e.label,
        direction: "<>",
      }
    );
  });
  return cyphers;
}

/*
* Given the currently selected nodes and edges, build a Cypher query.
*/
export function buildCypherQuery(nodes: Option[], edges: Option[]): string | null {
  if (nodes.length == 0 && edges.length == 0) return null;

  // NODES:
  var nodeMatch = nodes.map(n => { return `"${n.value}"`; }).join(", ");
  var match = `MATCH (n: Node)`;

  // switch to trackedvar if one is chosen:
  if (nodes.length > 0) {
    match = `MATCH (n: TrackedVariable)\nWHERE n.name IN [${nodeMatch}]`;
  }

  // RELATIONSHIPS:
  var relationshipFilter = edges.map(e => { 
    var dir: string = e.direction;
    if (dir == "<>") dir = "";
    return e.value + dir;
  }).join("|");

  var procedure = `
CALL apoc.path.expandConfig(n, {
  relationshipFilter: "${relationshipFilter}",
  minLevel: 1,
  maxLevel: 3
})
YIELD path
RETURN path`;

  const fullCypherQuery = (match + procedure);
  console.log(fullCypherQuery);
  return fullCypherQuery;
}
