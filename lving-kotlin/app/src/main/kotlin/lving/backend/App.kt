package lving.backend

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.http.content.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import lving.backend.db.DatabaseFactory
import lving.backend.routes.configureProjectRoutes

fun main() {
    embeddedServer(Netty, port = 8080, host = "0.0.0.0", module = Application::module)
        .start(wait = true)
}

fun Application.module() {
    DatabaseFactory.init()
    install(ContentNegotiation) {
        json()
    }
    routing {
        // Serve static assets (CSS, JS, images)
        static("/assets") {
            resources("static/assets")
        }
        
        // Serve specific static files
        get("/vite.svg") {
            call.respondText(
                this::class.java.classLoader.getResource("static/vite.svg")!!.readText(),
                ContentType.parse("image/svg+xml")
            )
        }
        
        // Health check endpoint
        get("/health") {
            call.respond(mapOf("status" to "healthy"))
        }

        // API routes (includes Accept header check for /projects/{id})
        configureProjectRoutes()
        
        // SPA routes for known frontend-only routes
        val indexHtml = this::class.java.classLoader.getResource("static/index.html")!!.readText()
        
        get("/") {
            call.respondText(indexHtml, ContentType.Text.Html)
        }
        
        get("/new-project") {
            call.respondText(indexHtml, ContentType.Text.Html)
        }
    }
}
