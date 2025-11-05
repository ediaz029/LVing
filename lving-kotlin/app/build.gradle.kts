import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "2.1.0"
    kotlin("plugin.serialization") version "2.1.0"
    application
}

group = "lving.backend"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    // Ktor
    val ktorVersion = "2.3.12"
    implementation("io.ktor:ktor-server-core-jvm:${ktorVersion}")
    implementation("io.ktor:ktor-server-netty-jvm:${ktorVersion}")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:${ktorVersion}")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:${ktorVersion}")
    implementation("io.ktor:ktor-server-host-common-jvm:${ktorVersion}")
    implementation("ch.qos.logback:logback-classic:1.5.6")

    // Exposed ORM for SQL
    val exposedVersion = "0.52.0"
    implementation("org.jetbrains.exposed:exposed-core:${exposedVersion}")
    implementation("org.jetbrains.exposed:exposed-dao:${exposedVersion}")
    implementation("org.jetbrains.exposed:exposed-jdbc:${exposedVersion}")

    // Database Driver
    implementation("org.xerial:sqlite-jdbc:3.46.0.0")

    // Redis Client
    implementation("redis.clients:jedis:5.1.3")

    // CPG Libraries
    val cpgVersion = "10.8.0"
    implementation("de.fraunhofer.aisec:cpg-core:${cpgVersion}")
    implementation("de.fraunhofer.aisec:cpg-language-llvm:${cpgVersion}")
    implementation("de.fraunhofer.aisec:cpg-neo4j:${cpgVersion}")

    // Neo4j Java Driver
    implementation("org.neo4j.driver:neo4j-java-driver:5.22.0")
}

application {
    mainClass.set("lving.backend.AppKt")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        jvmTarget = "21"
        // Enable context receivers for CPG's persist() function
        freeCompilerArgs = listOf("-Xcontext-receivers")
    }
}
