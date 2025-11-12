// "special edges options" IE: something that is NOT an edge, but is within that same select component.
const specialSelection = [
  { value: "", label: "" },
];

const edges = [
  { value: "DFG", label: "📊 Data Flow Graph (DFG)"},
  { value: 'EOG', label: '🔄 Execution Order Graph (EOG)' },
  { value: 'AST', label: '🌳 Abstract Syntax Tree (AST)' },
  { value: 'REFERS_TO', label: '🔗 References (REFERS_TO)' },
  { value: 'PDG', label: '📈 Program Dependence Graph (PDG)' },
  { value: 'USAGE|SCOPE', label: '🎯 Usage & Scope Relations' },
];

type Option = { value: string; label: string };

/*
* Returns array of { value: str, label: str} indicative of applicable edge and general query types.
*/
export function getCypherOptions(): Option[] {
  var cyphers: Option[] = [];
  edges.forEach(e => {
    cyphers.push({
        value: e.value,
        label: e.label
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
  var relationshipFilter = edges.map(e => { return e.value; }).join("|");
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
