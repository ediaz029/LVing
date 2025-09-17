"""
After committing the annotated IR to Neo4J, the nodes we are annotating remains
disconnected from any data involving the annotation. This post-process cypher
connects those nodes and then creates new properties and a new "Annotation" node.
"""

CONNECTION_CYPHER =\
"""
// Match the reference containing the function call
// This is so we can use the EOG to label argumentIndex (which, by default, are 0 at the start).
MATCH(r:Reference WHERE r.fullName CONTAINS "llvm.ptr.annotation.p0")
WITH r

// Before anything, we run through the EOG from 1->5 (llvm.ptr.annotation.p0 has 4 arguments)
// To make operations easier later in this cypher, we adjust the argumentIndex property which
// was not properly saved from CPG->Neo4J.
MATCH arg_path = (r)-[:EOG*1..4]->(_)
FOREACH (arg in nodes(arg_path) |
    SET arg.argumentIndex=[x IN range(0, 4) WHERE nodes(arg_path)[x]=arg][0]-1
)
WITH arg_path

//
// Argument Traversal:
// Traversing annotation argument until literal is reached.
//  : <n> is the CallExpression for llvm.ptr.annotation.p0.
//  : <arg_path> is the EOG path from <n>'s reference to the final argument.
//
MATCH(n:CallExpression {fullName: "llvm.ptr.annotation.p0i8.p0i8"})

// Some arguments (like line number) will start as a literal.
// If that's the case, we're done with those and we save them within <args>.
MATCH (n)-[:OPERATOR_ARGUMENTS]->(args WHERE args:Literal AND NOT args.code CONTAINS "null")

// Now, we get the second set of arguments which were NOT literals as <others>.
MATCH (n)-[:OPERATOR_ARGUMENTS]->(others WHERE NOT others:Literal AND others.argumentIndex > 0)

// To make things easier for the next call, I move on to the reference and copy that argIndex property.
MATCH (others)-[:REFERS_TO]->(reference)
SET reference.argumentIndex=others.argumentIndex
WITH n, reference, args

// Follow the path from the annotation's argument's reference -> the literal.
CALL apoc.path.expandConfig(reference, {
    relationshipFilter: ">EOG|>REFERS_TO", // follow eog or refers_to, 
    // labelFilter: "/ConstructExpression",
    labelFilter: "-FunctionDeclaration|-CastExpression|/Literal",
    minLevel: 1
})
YIELD path

// Next, set the argumentIndex on the literal.
WITH path, n, args, LAST(nodes(path)) AS literal, HEAD(nodes(path)) AS start
SET literal.argumentIndex=start.argumentIndex

// Combine literals into 1 list and sort by argumentIndex
WITH n, COLLECT(DISTINCT literal) + COLLECT(DISTINCT args) AS literals
UNWIND literals as item
ORDER BY item.argumentIndex
WITH n, COLLECT(item) AS literals

//
// Annotation Node
//  : <n> remains in scope
//  : <literals> is now a list of all annotation related literals ordered by argumentIndex.
//       <literals> = [<annotation name>, <filename>, <line number>]
//
MERGE(annotation:Annotation {
    name: literals[0].value,
    filename: literals[1].value,
    line_number: literals[2].value
})

// SCOPE CHANGE
// : <n>
// : <annotation>
WITH n, annotation

// Find the node that we are annotating (and then the actual VariableDeclaration of it)
// No need for APOC call here because we're only actually reaching two direct paths.
MATCH (n)-[:OPERATOR_ARGUMENTS]->(_ {argumentIndex: 0})-[:REFERS_TO]-(register)

// I use APOC here only for speed purposes.
CALL apoc.path.subgraphNodes(register, {
    relationshipFilter: "<DFG",
    labelFilter: "/VariableDeclaration"
})
YIELD node AS variable

// Set properties on the variable itself
SET variable.annotation=annotation.name,
    variable.filename = annotation.filename,
    variable.line_number = annotation.line_number

MERGE (annotation)-[:ANNOTATE]->(variable)
WITH annotation AS _

MATCH (a: Annotation)
RETURN count(DISTINCT a)
"""
