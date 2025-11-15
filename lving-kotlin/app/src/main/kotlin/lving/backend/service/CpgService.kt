package lving.backend.service

import de.fraunhofer.aisec.cpg.TranslationConfiguration
import de.fraunhofer.aisec.cpg.TranslationManager
import de.fraunhofer.aisec.cpg.TranslationResult
import de.fraunhofer.aisec.cpg.frontends.llvm.LLVMIRLanguage
import de.fraunhofer.aisec.cpg.graph.Node
import de.fraunhofer.aisec.cpg.graph.allChildren
import de.fraunhofer.aisec.cpg.passes.DynamicInvokeResolver
import org.neo4j.driver.AuthTokens
import org.neo4j.driver.GraphDatabase
import org.neo4j.driver.Values
import java.io.File
import java.util.concurrent.ExecutionException
import kotlinx.serialization.Serializable
import lving.backend.graph.persistGraph

@Serializable
data class GraphNode(
    val id: String,
    val label: String,
    val labels: List<String>,
    val title: Map<String, String>
)

@Serializable
data class GraphEdge(
    val id: String,
    val from: String,
    val to: String,
    val label: String,
    val title: Map<String, String>
)

@Serializable
data class GraphData(
    val nodes: List<GraphNode>,
    val edges: List<GraphEdge>
)

class CpgService {

    fun runCpgAnalysis(projectId: String, llvmFile: File) {
        val translationResult = analyzeLlvmFile(llvmFile)
        exportGraphToNeo4j(translationResult, projectId)
    }

    private fun analyzeLlvmFile(llvmFile: File): TranslationResult {
        println("Starting CPG analysis for file ${llvmFile.absolutePath}")
        try {
            val translationConfig = TranslationConfiguration.builder()
                .sourceLocations(listOf(llvmFile))
//                .defaultPasses()
                .registerLanguage<LLVMIRLanguage>()
//                .registerPass<ControlDependenceGraphPass>()
                .registerPass<DynamicInvokeResolver>()
                .build()

            val translationManager = TranslationManager.builder().config(translationConfig).build()
            val result = translationManager.analyze().get()
            println("CPG analysis successful. $result")
            return result
        } catch (e: ExecutionException) {
            throw Exception("CPG analysis failed: ${e.cause?.message}", e)
        }
    }

    @Throws(InterruptedException::class)
    private fun exportGraphToNeo4j(result: TranslationResult, projectId: String) {
        val neo4jHost = System.getenv("NEO4J_HOST") ?: "localhost"
        val neo4jUser = System.getenv("NEO4J_USER") ?: "neo4j"
        val neo4jPassword = System.getenv("NEO4J_PASSWORD") ?: "password"
        val uri = "bolt://$neo4jHost:7687"

        println("Exporting graph to Neo4j for project $projectId")

        GraphDatabase.driver(uri, AuthTokens.basic(neo4jUser, neo4jPassword)).use { driver ->
            // Clear old project data
            driver.session().use { session ->
                session.writeTransaction { tx ->
                    tx.run(
                        "MATCH (n {projectId: \$projectId}) DETACH DELETE n",
                        Values.parameters("projectId", projectId)
                    ).consume()
                }
            }
            println("Cleared old data for project $projectId")

            val allNodes = result.allChildren<Node>()
            println("Found ${allNodes.size} nodes to persist")

            println("Persisting graph using CPG Neo4j backend...")
            
            // Use CPG's persist extension function with Session context
            driver.session().use { session ->
                with(session) {
                    result.persistGraph(projectId)
                }
            }
            println("Graph persisted successfully")
            println("Export to Neo4j successful for project $projectId")
        }
    }

    fun executeQuery(projectId: String, cypherQuery: String): GraphData {
        val neo4jHost = System.getenv("NEO4J_HOST") ?: "localhost"
        val neo4jUser = System.getenv("NEO4J_USER") ?: "neo4j"
        val neo4jPassword = System.getenv("NEO4J_PASSWORD") ?: "password"
        val uri = "bolt://$neo4jHost:7687"

        // usb test
        val forbiddenPatterns = listOf(
            "\\bcreate\\b",
            "\\bmerge\\b",
            "\\bdelete\\b",
            "\\bset\\b",
            "\\bdrop\\b",
            "\\bremove\\b",
            "\\bcall.*dbms\\b"
        )

        if (forbiddenPatterns.any { Regex(it).containsMatchIn(cypherQuery) }) {
            throw Exception("access");
        }

        GraphDatabase.driver(uri, AuthTokens.basic(neo4jUser, neo4jPassword)).use { driver ->
            driver.session().use { session ->
                return session.readTransaction { tx ->
                    // Inject projectId filter into the query
                    var modifiedQuery = injectProjectIdFilter(cypherQuery, projectId)

                    // (usability test): limit at 150 nodes.
                    modifiedQuery += "\nLIMIT 150";

                    println("Executing query: $modifiedQuery")
                    
                    val result = tx.run(
                        modifiedQuery, Values.parameters("projectId", projectId))
                    
                    val nodes = mutableListOf<GraphNode>()
                    val edges = mutableListOf<GraphEdge>()
                    val nodeIds = mutableSetOf<String>()

                    result.list().forEach { record ->
                        record.values().forEach { value ->
                            extractNodesAndEdges(value.asObject(), nodes, edges, nodeIds)
                        }
                    }

                    GraphData(nodes = nodes, edges = edges)
                }
            }
        }
    }

    fun getTrackedNodes(projectId: String): String {
        val cypher = """
            MATCH (n: TrackedVariable)
            RETURN n
        """.trimIndent()

        val data = executeQuery(projectId, cypher);
        val s = data.nodes.toSet().joinToString { it.title["name"].toString() }
        return s;
    }

    private fun injectProjectIdFilter(cypherQuery: String, projectId: String): String {
        // Simple injection: add WHERE clause after first MATCH if not present
        // This is a basic implementation - for production, use a proper Cypher parser
        val lines = cypherQuery.split("\n")
        val modifiedLines = mutableListOf<String>()
        val matchRgx = """MATCH \((\w+):""".toRegex()
        val whereRgx = """WHERE (?:\w+\()?(\w+)""".toRegex()
        var injected = false

        for (line in lines) {
            modifiedLines.add(line)
            val nodeName = matchRgx.find(line)?.destructured?.component1()
            if (!injected && line.trim().uppercase().startsWith("MATCH")) {
                // Check if next line is WHERE, if not, inject
                val nextLineIndex = lines.indexOf(line) + 1
                if (nextLineIndex < lines.size) {
                    val nextLine = lines[nextLineIndex].trim().uppercase()
                    if (!nextLine.startsWith("WHERE")) {
                        modifiedLines.add("WHERE ${nodeName}.projectId IS NOT NULL AND ${nodeName}.projectId = \$projectId")
//                        injected = true
                    }
                } else {
                    modifiedLines.add("WHERE ${nodeName}.projectId IS NOT NULL AND ${nodeName}.projectId = \$projectId")
//                    injected = true
                }
            }

            // If the user supplies their own predicate, we'll assume its just one line
            // and attach on via AND.
            if (!injected && line.trim().uppercase().startsWith("WHERE")) {
                val nodeName = whereRgx.find(line.trim())?.destructured?.component1()
                modifiedLines.add("AND ${nodeName}.projectId IS NOT NULL AND ${nodeName}.projectId = \$projectId")
//                injected = true
            }
        }

        return modifiedLines.joinToString("\n")
    }

    private fun extractNodesAndEdges(
        obj: Any?,
        nodes: MutableList<GraphNode>,
        edges: MutableList<GraphEdge>,
        nodeIds: MutableSet<String>
    ) {
        when (obj) {
            is org.neo4j.driver.types.Node -> {
                val nodeId = obj.id().toString()
                if (!nodeIds.contains(nodeId)) {
                    nodeIds.add(nodeId)
                    val labelsList = obj.labels().toList()
                    
                    // Get the most specific label (filter out generic "Node" label)
                    val primaryLabel = labelsList.firstOrNull { it != "Node" } 
                        ?: labelsList.firstOrNull() 
                        ?: "Node"
                    
                    // Simple conversion like Python - convert all values to strings
                    val title = obj.asMap().mapValues { (_, value) ->
                        value?.toString() ?: ""
                    }
                    
                    nodes.add(
                        GraphNode(
                            id = nodeId,
                            label = primaryLabel,
                            labels = labelsList,
                            title = title
                        )
                    )
                }
            }
            is org.neo4j.driver.types.Relationship -> {
                // Simple conversion like Python - convert all values to strings
                val title = obj.asMap().mapValues { (_, value) ->
                    value?.toString() ?: ""
                }
                
                edges.add(
                    GraphEdge(
                        id = obj.id().toString(),
                        from = obj.startNodeId().toString(),
                        to = obj.endNodeId().toString(),
                        label = obj.type(),
                        title = title
                    )
                )
            }
            is org.neo4j.driver.types.Path -> {
                obj.nodes().forEach { node ->
                    extractNodesAndEdges(node, nodes, edges, nodeIds)
                }
                obj.relationships().forEach { rel ->
                    extractNodesAndEdges(rel, nodes, edges, nodeIds)
                }
            }
            is List<*> -> {
                obj.forEach { item ->
                    extractNodesAndEdges(item, nodes, edges, nodeIds)
                }
            }
        }
    }
}
