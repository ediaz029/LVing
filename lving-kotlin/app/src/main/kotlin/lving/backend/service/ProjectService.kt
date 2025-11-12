package lving.backend.service

import lving.backend.db.DatabaseFactory.dbQuery
import lving.backend.db.NewProject
import lving.backend.db.Project
import lving.backend.db.Projects
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.update
import org.jetbrains.exposed.sql.select
import java.io.File
import java.util.UUID
import kotlin.concurrent.thread
import kotlinx.coroutines.runBlocking

class ProjectService {

    private fun toProject(row: ResultRow): Project =
        Project(
            id = row[Projects.id],
            name = row[Projects.name],
            status = row[Projects.status],
            sourceCodePath = row[Projects.sourceCodePath],
            llvmIrPath = row[Projects.llvmIrPath],
            createdAt = row[Projects.createdAt],
            analysisResult = row[Projects.analysisResult],
            trackedNodes = row[Projects.trackedNodes],
        )

    suspend fun getAllProjects(): List<Project> = dbQuery {
        Projects.selectAll().map(::toProject)
    }

    suspend fun createProject(newProject: NewProject): Project {
        val projectId = UUID.randomUUID().toString()
        val projectFolder = File("./storage/projects/$projectId")
        projectFolder.mkdirs()
        val sourceFile = projectFolder.resolve("source.rs")
        sourceFile.writeText(newProject.sourceCode)

        return dbQuery {
            val inserted = Projects.insert {
                it[id] = projectId
                it[name] = newProject.name
                it[status] = "CREATED"
                it[sourceCodePath] = sourceFile.absolutePath
                it[createdAt] = System.currentTimeMillis()
            }
            toProject(inserted.resultedValues!!.first())
        }
    }

    suspend fun getProject(id: String): Project? = dbQuery {
        Projects.select { Projects.id eq id }.map(::toProject).singleOrNull()
    }

    suspend fun updateProjectStatus(id: String, status: String, llvmIrPath: String? = null) {
        dbQuery {
            Projects.update({ Projects.id eq id }) {
                it[Projects.status] = status
                if (llvmIrPath != null) {
                    it[Projects.llvmIrPath] = llvmIrPath
                }
            }
        }
    }

    suspend fun updateTrackedNodes(id: String, nodes: String? = null) {
        dbQuery {
            Projects.update({ Projects.id eq id }) {
                it[Projects.trackedNodes] = nodes;
            }
        }
    }

    fun startAnalysis(projectId: String) {
        thread {
            runBlocking {
                updateProjectStatus(projectId, "ANALYZING_RUSTC")

                val project = getProject(projectId)
                if (project == null) {
                    updateProjectStatus(projectId, "ERROR_NOT_FOUND")
                    return@runBlocking
                }

                val sourceFile = File(project.sourceCodePath)
                val irPath = sourceFile.parentFile.resolve("${sourceFile.nameWithoutExtension}.ll")

//                val rustcProcess = ProcessBuilder()
//                    .command("rustc", "--emit=llvm-ir", irPath.absolutePath, "-o", irPath.absolutePath)
//                    .redirectErrorStream(true)
//                    .start()

                val rustcProcess = ProcessBuilder(
                    "rustc", "--emit=llvm-ir", "-g", "-C", "debuginfo=2",
                     "-o", irPath.absolutePath, sourceFile.absolutePath
                ).redirectErrorStream(true).start()

                val rustcExitCode = rustcProcess.waitFor()

                if (rustcExitCode != 0) {
                    val errorOutput = rustcProcess.inputStream.bufferedReader().readText()
                    println("rustc error: $errorOutput")
                    updateProjectStatus(projectId, "ERROR_RUSTC")
                    return@runBlocking
                }

                updateProjectStatus(projectId, "ANALYZING_CPG", irPath.absolutePath)

                try {
                    val cpgService = CpgService()
                    cpgService.runCpgAnalysis(projectId, irPath)
                    updateProjectStatus(projectId, "COMPLETED")

                    val nodes = cpgService.getTrackedNodes(projectId)
                    updateTrackedNodes(projectId, nodes);
                } catch (e: Exception) {
                    println("CPG analysis failed: ${e.message}")
                    e.printStackTrace()
                    updateProjectStatus(projectId, "ERROR_CPG")
                }
            }
        }
    }

    suspend fun getSourceCode(id: String): String? {
        val project = getProject(id) ?: return null
        val sourceFile = File(project.sourceCodePath)
        return if (sourceFile.exists()) {
            sourceFile.readText()
        } else {
            null
        }
    }

    suspend fun getLlvmIr(id: String): String? {
        val project = getProject(id) ?: return null
        if (project.llvmIrPath == null) return null
        val irFile = File(project.llvmIrPath)
        return if (irFile.exists()) {
            irFile.readText()
        } else {
            null
        }
    }
}

