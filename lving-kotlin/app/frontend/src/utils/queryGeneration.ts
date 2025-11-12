const edges = [
  { value: "DFG", label: "📊 Data Flow Graph (DFG) Only"},
  { value: 'EOG', label: '🔄 Execution Order Graph (EOG) Only' },
  { value: 'AST', label: '🌳 Abstract Syntax Tree (AST) Only' },
  { value: 'REFERS_TO', label: '🔗 References (REFERS_TO) Only' },
  { value: 'PDG', label: '📈 Program Dependence Graph (PDG) Only' },
  { value: 'USAGE|SCOPE', label: '🎯 Usage & Scope Relations' },
  // { value: 'full_context', label: '🔍 Full Context (Multiple Union Queries)' },
];

export interface CypherQuery {
  node: string,
  label: string,
  cypher: string,
}

export function getCypherExamples(trackedNodes: string) : CypherQuery[] {
  var names = trackedNodes.split(',');
  names = names.map( n => { return n.trim(); });
  
  var cyphers: CypherQuery[] = [];

  names.forEach( n => {
    edges.forEach(e => {
      cyphers.push({
          node: n,
          label: e.label,
          cypher: 
            `MATCH (n: TrackedVariable {name: "${n}"})
            WITH n
            MATCH path=(n)-[:${e.value}*1..6]-(access)
            RETURN path`.replace(/  +/g, '')
        }
      );
    });
  });

  return cyphers;
}