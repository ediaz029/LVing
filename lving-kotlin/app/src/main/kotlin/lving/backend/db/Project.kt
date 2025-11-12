package lving.backend.db

import kotlinx.serialization.Serializable

@Serializable
data class Project(
    val id: String,
    val name: String,
    val status: String,
    val sourceCodePath: String,
    val llvmIrPath: String?,
    val createdAt: Long,
    val analysisResult: String?,
    val trackedNodes: String?
)

@Serializable
data class NewProject(
    val name: String,
    val sourceCode: String
)
