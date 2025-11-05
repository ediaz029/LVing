package lving.backend.routes

import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import lving.backend.db.NewProject
import lving.backend.service.ProjectService
import lving.backend.service.CpgService
import io.ktor.http.HttpStatusCode
import java.io.File

fun Route.projectRouting() {
    val projectService = ProjectService()
    val cpgService = CpgService()

    // Code examples endpoint
    route("/examples") {
        get {
            // Use dataset directory in the project root
            val projectRoot = System.getProperty("user.dir")
            val datasetDir = File("$projectRoot/dataset")
            
            if (!datasetDir.exists() || !datasetDir.isDirectory) {
                println("ERROR: Dataset directory not found at: ${datasetDir.absolutePath}")
                println("Current working directory: $projectRoot")
                call.respond(
                    HttpStatusCode.NotFound, 
                    mapOf(
                        "error" to "Dataset directory not found",
                        "expectedPath" to datasetDir.absolutePath,
                        "workingDir" to projectRoot
                    )
                )
                return@get
            }
            
            println("Found dataset directory at: ${datasetDir.absolutePath}")
            
            val examples = datasetDir.listFiles { file -> 
                file.isFile && file.extension == "rs"
            }?.map { file ->
                val name = file.nameWithoutExtension
                val displayName = name
                    .replace("_", " ")
                    .split(" ")
                    .joinToString(" ") { it.replaceFirstChar { c -> c.uppercaseChar() } }
                
                mapOf(
                    "id" to name,
                    "name" to displayName,
                    "filename" to file.name
                )
            }?.sortedBy { it["name"] as String } ?: emptyList()
            
            println("Found ${examples.size} examples")
            call.respond(examples)
        }
        
        get("{id}") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing example ID")
            
            // Use dataset directory in the project root
            val projectRoot = System.getProperty("user.dir")
            val exampleFile = File("$projectRoot/dataset/$id.rs")
            
            if (!exampleFile.exists()) {
                println("ERROR: Example file not found: ${exampleFile.absolutePath}")
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Example not found: $id"))
                return@get
            }
            
            println("Serving example: ${exampleFile.absolutePath}")
            call.respondText(exampleFile.readText(), io.ktor.http.ContentType.Text.Plain)
        }
    }

    route("/projects") {
        get {
            call.respond(projectService.getAllProjects())
        }
        post {
            val newProject = call.receive<NewProject>()
            val project = projectService.createProject(newProject)
            call.respond(project)
        }
        get("{id}") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            
            // Check if this is a browser navigation (requesting HTML) or an API call (requesting JSON)
            val acceptHeader = call.request.headers["Accept"] ?: ""
            if (acceptHeader.contains("text/html")) {
                // Browser navigation - serve the SPA
                val indexHtml = this::class.java.classLoader.getResource("static/index.html")?.readText()
                if (indexHtml != null) {
                    call.respondText(indexHtml, io.ktor.http.ContentType.Text.Html)
                } else {
                    call.respond(HttpStatusCode.NotFound, "Index file not found")
                }
                return@get
            }
            
            // API call - return JSON
            val project = projectService.getProject(id)
            if (project != null) {
                call.respond(project)
            } else {
                call.respond(HttpStatusCode.NotFound, "Project not found")
            }
        }
        post("{id}/analyze") {
            val id = call.parameters["id"] ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            projectService.startAnalysis(id)
            call.respond(HttpStatusCode.Accepted, mapOf("message" to "Analysis started"))
        }
        get("{id}/status") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            val project = projectService.getProject(id)
            if (project != null) {
                call.respond(mapOf("status" to project.status))
            } else {
                call.respond(HttpStatusCode.NotFound, "Project not found")
            }
        }
        get("{id}/source") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            val content = projectService.getSourceCode(id)
            if (content != null) {
                call.respondText(content, io.ktor.http.ContentType.Text.Plain)
            } else {
                call.respond(HttpStatusCode.NotFound, "Source code not found")
            }
        }
        get("{id}/llvm-ir") {
            val id = call.parameters["id"] ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            val content = projectService.getLlvmIr(id)
            if (content != null) {
                call.respondText(content, io.ktor.http.ContentType.Text.Plain)
            } else {
                call.respond(HttpStatusCode.NotFound, "LLVM-IR not found or not yet generated")
            }
        }
        post("{id}/query") {
            val id = call.parameters["id"] ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing project ID")
            val queryRequest = call.receive<Map<String, String>>()
            val cypherQuery = queryRequest["query"] ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing query")
            
            try {
                val result = cpgService.executeQuery(id, cypherQuery)
                call.respond(result)
            } catch (e: Exception) {
                call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (e.message ?: "Query execution failed")))
            }
        }
    }
}

fun Route.configureProjectRoutes() {
    projectRouting()
}
