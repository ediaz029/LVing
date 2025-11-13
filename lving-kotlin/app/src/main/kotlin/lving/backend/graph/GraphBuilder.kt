// Internal copy of de.fraunhofer.aisec.cpg.persistence.Neo4j/
// Node IDs are not unique. Offending PR:
// https://github.com/Fraunhofer-AISEC/cpg/pull/2250


/*
 * Copyright (c) 2024, Fraunhofer AISEC. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *                    $$$$$$\  $$$$$$$\   $$$$$$\
 *                   $$  __$$\ $$  __$$\ $$  __$$\
 *                   $$ /  \__|$$ |  $$ |$$ /  \__|
 *                   $$ |      $$$$$$$  |$$ |$$$$\
 *                   $$ |      $$  ____/ $$ |\_$$ |
 *                   $$ |  $$\ $$ |      $$ |  $$ |
 *                   \$$$$$   |$$ |      \$$$$$   |
 *                    \______/ \__|       \______/
 *
 */

@file:OptIn(ExperimentalUuidApi::class)
@file:Suppress("CONTEXT_RECEIVERS_DEPRECATED")
package lving.backend.graph

import de.fraunhofer.aisec.cpg.TranslationResult
import de.fraunhofer.aisec.cpg.graph.Node
import de.fraunhofer.aisec.cpg.graph.Persistable
import de.fraunhofer.aisec.cpg.graph.blocks
import de.fraunhofer.aisec.cpg.graph.declarations.FunctionDeclaration
import de.fraunhofer.aisec.cpg.graph.declarations.VariableDeclaration
import de.fraunhofer.aisec.cpg.graph.edges.collections.EdgeCollection
import de.fraunhofer.aisec.cpg.graph.nodes
import de.fraunhofer.aisec.cpg.graph.scopes.FunctionScope
import de.fraunhofer.aisec.cpg.graph.statements.expressions.CallExpression
import de.fraunhofer.aisec.cpg.helpers.Benchmark
import de.fraunhofer.aisec.cpg.helpers.IdentitySet
import de.fraunhofer.aisec.cpg.helpers.identitySetOf
import de.fraunhofer.aisec.cpg.persistence.labels
import de.fraunhofer.aisec.cpg.persistence.properties
import de.fraunhofer.aisec.cpg.persistence.schemaRelationships
import org.neo4j.driver.Session
import org.slf4j.LoggerFactory
import java.util.WeakHashMap
import kotlin.collections.iterator
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

private typealias Relationship = Map<String, Any?>
private val log = LoggerFactory.getLogger("GraphBuilder")

/**
 * Defines the number of edges to be processed in a single batch operation during persistence.
 *
 * This constant is used for chunking collections of edges into smaller groups to optimize write
 * performance and reduce memory usage when interacting with the Neo4j database. Specifically, it
 * determines the maximum size of each chunk of edges to be persisted in one batch operation.
 */
const val edgeChunkSize = 10000

/**
 * Specifies the maximum number of nodes to be processed in a single chunk during persistence
 * operations.
 *
 * This constant is used to control the size of batches when persisting a list of nodes to the
 * database. Breaking the list into chunks of this size helps improve performance and memory
 * efficiency during database writes. Each chunk is handled individually, ensuring that operations
 * remain manageable even for large data sets.
 */
const val nodeChunkSize = 10000

private val FILTERED_NODES = listOf("UnknownType")
private val FILTERED_EDGES = listOf("LANGUAGE")

// @llvm.declare.dbg calls from within Rust standard library are excluded from being walked.
private val FILTERED_DBG_DECLARE_FUNCS = listOf(
    "std::",
    "core::",
    "alloc::",
    "proc_macro::",
    "std_detect::",
    "test::",
    "__rust",
    "__CxxFrame",
    "llvm.",
    "literal_",
)

/**
 * Persists the current [TranslationResult] into a graph database.
 *
 * This method performs the following actions:
 * - Logs information about the number and categories of nodes (e.g., AST nodes, scopes, types,
 *   languages) and edges that are being persisted.
 * - Collects nodes that include AST nodes, scopes, types, and languages, as well as all associated
 *   edges.
 * - Persists the collected nodes and edges.
 * - Persists additional relationships between nodes, such as those related to types, scopes, and
 *   languages.
 * - Utilizes a benchmarking mechanism to measure and log the time taken to complete the persistence
 *   operation.
 *
 * This method relies on the following context and properties:
 * - The [TranslationResult.finalCtx] property for accessing the scope manager, type manager, and
 *   configuration.
 * - A [Session] context to perform persistence actions.
 */
context(Session)
fun TranslationResult.persistGraph(projectId: String) {
    val b = Benchmark(Persistable::class.java, "Persisting translation result")

    val astNodes = this@persistGraph.nodes
    val connected = astNodes.flatMap { it.connectedNodes }.toSet()
    val nodes = (astNodes + connected).distinct()
    val idMap = nodes.persist(projectId)

    log.info(
        "Persisting {} nodes: AST nodes ({}), other nodes ({})",
        nodes.size,
        astNodes.size,
        connected.size,
    )

    val relationships = nodes.collectRelationships(idMap)
    log.info("Persisting {} relationships", relationships.size)
    relationships.persist(projectId)

    b.stop()
}

/**
 * Persists the current [TranslationResult] into a graph database.
 *
 * This method performs the following actions:
 * - Logs information about the number and categories of nodes (e.g., AST nodes, scopes, types,
 *   languages) and edges that are being persisted.
 * - Collects nodes that include AST nodes, scopes, types, and languages, as well as all associated
 *   edges.
 * - Persists the collected nodes and edges.
 * - Persists additional relationships between nodes, such as those related to types, scopes, and
 *   languages.
 * - Utilizes a benchmarking mechanism to measure and log the time taken to complete the persistence
 *   operation.
 *
 * This method relies on the following context and properties:
 * - The [TranslationResult.finalCtx] property for accessing the scope manager, type manager, and
 *   configuration.
 * - A [Session] context to perform persistence actions.
 */
context(Session)
private fun List<Node>.persist(projectId: String): Map<Node, String> {
    // node.properties is immutable and we need the ID for relationships.
    val idMap = WeakHashMap<Node, String>(this.size)
    val nodeLabelMap = WeakHashMap<Node, String>(this.filter { n -> n is VariableDeclaration }.size)

    this
        .filter { it::class::labels.get().any { l -> !FILTERED_NODES.contains(l) } }
        .chunked(nodeChunkSize).map { chunk ->
            val b = Benchmark(Persistable::class.java, "Persisting chunk of ${chunk.size} nodes")
            val params =
                mapOf("props" to chunk.map {
                    // it.properties (ext. from persistable.kt) is immutable
                    // so unfortunately it has to be copied.
                    val props = it.properties().toMutableMap()

                    // Contrary to the actual name, Node.id is NOT UNIQUE.
                    val id = Uuid.random().toString()
                    props["id"] = id
                    idMap[it] = id

                    /*
                    * just for the usability test / cypher generation
                    * im 200% aware that this is not the most sane approach
                    */

                    // the most rational thing is to do this in a proper pass.
                    var name = Demangle.demangle(props.getOrDefault("name", "") as String);

                    // Scope has ZERO information from within the graph
                    // except the nodes that is encased within it.
                    // ..but from a general expansion, that explodes.
                    if (it is FunctionScope) {
                        name = Demangle.demangle(it.astNode!!.name.localName);
                    }

                    props["name"] = name;
                    props["fullName"] = name;
                    props["localName"] = name;

                    if (it is FunctionDeclaration && !(FILTERED_DBG_DECLARE_FUNCS.any { s -> name.contains(s) })) {
                        // tag a node that is interesting:
                        // a node is interesting if it:
                        //   - is a variabledeclaration
                        //   - has a corresponding @llvm.dbg.declare
                        //   - does NOT come from std:: or core::.
                        it.blocks.forEach { b ->
                            b.nodes
                                .filter { n -> n is CallExpression && n.name.toString().equals("llvm.dbg.declare") }
                                .forEach { n ->
                                    // from llvm.debug.declare, the first argument is (metadata <type> <reg>, ...
                                    // but this isn't interpreted properly when creating the graph. so, the first argument's node
                                    // which is SUPPOSED to point back to the REAL node just points to unknown.
                                    // we could walk back the EOG, but I haven't really found the best way to get
                                    // back to the variabledeclaration since it may be directly or through assignexprs, etc.

                                    // the approach i do right now to avoid handling every case:
                                    // since it is guaranteed that llvm.dbg.declare's first arg is
                                    // present within the same block, i just search for the name immediately following the %.
                                    val declareNode = n as CallExpression
                                    val code = declareNode.arguments[0].code
                                    val split = code!!.split("%")
                                    val varName = split.getOrNull(split.size - 1) ?: return@forEach

                                    // find node:
                                    val node: VariableDeclaration? = b.nodes.find { blockNode ->
                                        blockNode is VariableDeclaration && blockNode.name.localName.equals(varName)
                                    } as VariableDeclaration?

                                    if (node == null) return@forEach

                                    // since this isn't time to label the node, we wait for later.
                                    // though, we'll save the reference to it.
                                    nodeLabelMap[node] = "TrackedVariable"
                                }
                        }
                    }

                    // tag main:
                    var extraLabels = mutableSetOf<String>()
                    if (name.endsWith("::main")) {
                        extraLabels.add("MainFunctionDeclaration");
                    }

                    // if we were in nodelabelmap:
                    if (nodeLabelMap.contains(it)) {
                        extraLabels.add(nodeLabelMap[it]!!);
                        nodeLabelMap.remove(it);
                    }

                    // While we're here, set projectId on properties to avoid doing an extra pass later.
                    props["projectId"] = projectId

                    mapOf("labels" to it::class.labels + extraLabels) + props
                })
            this@Session.executeWrite { tx ->
                tx.run(
                        """
                       UNWIND ${"$"}props AS map
                       WITH map, apoc.map.removeKeys(map, ['labels']) AS properties
                       CALL apoc.create.node(map.labels, properties) YIELD node
                       RETURN node
                       """,
                        params,
                    )
                    .consume()
            }
            b.stop()
        }
    return idMap
}

/**
 * Persists a collection of edges into a Neo4j graph database within the context of a [Session].
 *
 * This method ensures that the required index for node IDs is created before proceeding with
 * relationship creation. The edges are subdivided into chunks, and for each chunk, the
 * relationships are created in the database. Neo4j does not support multiple labels on edges, so
 * each edge is duplicated for each assigned label. The created relationships are associated with
 * their respective nodes and additional properties derived from the edges.
 *
 * Constraints:
 * - The session context is required to execute write transactions.
 * - Edges should define their labels and properties for appropriate persistence.
 *
 * Mechanisms:
 * - An index for [Node] IDs is created (if not already existing) to optimize matching operations.
 * - Edges are chunked to avoid overloading transactional operations.
 * - Relationship properties and labels are mapped before using database utilities for creation.
 */
context(Session)
private fun Collection<Relationship>.persist(projectId: String) {
    // Create an index for the "id" field of node, because we are "MATCH"ing on it in the edge
    // creation. We need to wait for this to be finished
    this@Session.executeWrite { tx ->
        tx.run("CREATE INDEX IF NOT EXISTS FOR (n:Node) ON (n.id)").consume()
    }

    this.chunked(edgeChunkSize).map { chunk -> this@Session.createRelationships(chunk, projectId) }
}

/**
 * Creates relationships in a graph database based on provided properties.
 *
 * @param props A list of maps, where each map represents properties of a relationship including
 *   keys such as `startId`, `endId`, and `type`. The `startId` and `endId` identify the nodes to
 *   connect, while `type` defines the type of the relationship. Additional properties for the
 *   relationship can also be included in the map.
 */
private fun Session.createRelationships(props: List<Relationship>, projectId: String) {
    val b = Benchmark(Persistable::class.java, "Persisting chunk of ${props.size} relationships")
    val filteredProps = props
        .filter { it["type"] !in FILTERED_EDGES }
    val params = mapOf(
        "props" to filteredProps,
        "projectId" to projectId,
    )
    executeWrite { tx ->
        tx.run(
                """
            UNWIND ${'$'}props AS map
            MATCH (s:Node {id: map.startId, projectId: ${'$'}projectId})
            MATCH (e:Node {id: map.endId, projectId: ${'$'}projectId})
            WITH s, e, map, apoc.map.removeKeys(map, ['startId', 'endId', 'type']) AS properties
            CALL apoc.create.relationship(s, map.type, properties, e) YIELD rel
            RETURN rel
            """
                    .trimIndent(),
                params,
            )
            .consume()
    }
    b.stop()
}

/**
 * Returns all [Node] objects that are connected with this node with some kind of relationship
 * defined in [schemaRelationships].
 */
val Persistable.connectedNodes: IdentitySet<Node>
    get() {
        val nodes = identitySetOf<Node>()

        for (entry in this::class.schemaRelationships) {
            val value = entry.value.call(this)
            if (value is EdgeCollection<*, *>) {
                nodes += value.toNodeCollection()
            } else if (value is List<*>) {
                nodes += value.filterIsInstance<Node>()
            } else if (value is Node) {
                nodes += value
            }
        }

        return nodes
    }

private fun List<Node>.collectRelationships(idMap: Map<Node, String>): List<Relationship> {
    val relationships = mutableListOf<Relationship>()

    for (node in this) {
        for (entry in node::class.schemaRelationships) {
            val value = entry.value.call(node)
            if (value is EdgeCollection<*, *>) {
                relationships +=
                    value.map { edge ->
                        mapOf(
                            "startId" to idMap[edge.start],
                            "endId" to idMap[edge.end],
                            "type" to entry.key,
                        ) + edge.properties()
                    }
            } else if (value is List<*>) {
                relationships +=
                    value.filterIsInstance<Node>().map { end ->
                        mapOf(
                            "startId" to idMap[node],
                            "endId" to idMap[end],
                            "type" to entry.key,
                        )
                    }
            } else if (value is Node) {
                relationships +=
                    mapOf(
                        "startId" to idMap[node],
                        "endId" to idMap[value],
                        "type" to entry.key,
                    )
            }
        }
    }
    return relationships
}
