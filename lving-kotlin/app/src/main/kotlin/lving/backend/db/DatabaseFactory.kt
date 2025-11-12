package lving.backend.db

import kotlinx.coroutines.Dispatchers
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction

object DatabaseFactory {
    fun init() {
        val driverClassName = "org.sqlite.JDBC"
        val jdbcURL = "jdbc:sqlite:./storage/projects.db"
        val database = Database.connect(jdbcURL, driverClassName)
        transaction(database) {
            SchemaUtils.create(Projects)
        }
    }

    suspend fun <T> dbQuery(block: suspend () -> T): T =
        newSuspendedTransaction(Dispatchers.IO) { block() }
}

object Projects : Table() {
    val id = varchar("id", 36)
    val name = varchar("name", 255)
    val status = varchar("status", 50)
    val sourceCodePath = varchar("source_code_path", 1024)
    val llvmIrPath = varchar("llvm_ir_path", 1024).nullable()
    val createdAt = long("created_at")
    val analysisResult = text("analysis_result").nullable()
    val trackedNodes = text("tracked_nodes").nullable()

    override val primaryKey = PrimaryKey(id)
}
