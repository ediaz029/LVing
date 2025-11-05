# LVing - LLVM Code Property Graph Analyzer

A code analysis platform that generates and visualizes Code Property Graphs (CPG) for Rust programs using LLVM IR. Analyze code structure and relationships through interactive graph queries.

## Tech Stack

- **Backend**: Kotlin + Ktor
- **Frontend**: React + TypeScript + Chakra UI
- **Databases**: Neo4j (graph), SQLite (metadata), Redis (cache)
- **CPG Engine**: Fraunhofer AISEC CPG library

## Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- 4GB+ RAM for containers

## Quick Start

### 1. Setup
```bash
# Clone repository
git clone <repository-url>
cd lving-kotlin

# Create .env file
echo "NEO4J_PASSWORD=your_secure_password" > .env
```

### 2. Start Application
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 3. Access
- **Application**: http://localhost:8080
- **Neo4j Browser**: http://localhost:7474 (user: neo4j, password: from .env)
- **Health Check**: http://localhost:8080/health

Wait 30-60 seconds for Neo4j to initialize on first run.

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild after code changes
docker-compose up --build

# Stop and remove all data
docker-compose down -v

# Restart specific service
docker-compose restart backend

# Access container shell
docker-compose exec backend /bin/bash
```

## Project Structure

```
lving-kotlin/
├── app/
│   ├── src/main/kotlin/lving/backend/
│   │   ├── App.kt                 # Main entry point
│   │   ├── db/                    # Database models
│   │   ├── routes/                # API endpoints
│   │   └── service/               # Business logic
│   ├── frontend/src/              # React application
│   └── build.gradle.kts           # Dependencies
├── dataset/                       # Sample Rust files
├── docker-compose.yml
├── Dockerfile
└── .env                          # Environment variables
```

## API Endpoints

### Project Management
```bash
# List projects
GET /api/projects

# Create project
POST /api/projects
{
  "name": "Project Name",
  "description": "Description",
  "sourceCode": "fn main() { ... }"
}

# Get project details
GET /api/projects/{id}

# Delete project
DELETE /api/projects/{id}
```

### Analysis & Queries
```bash
# Run CPG analysis
POST /api/projects/{id}/analyze

# Get graph visualization
GET /api/projects/{id}/graph

# Execute Cypher query
POST /api/projects/{id}/query
{
  "query": "MATCH (n:FunctionDeclaration) RETURN n LIMIT 10"
}
```

## Example Cypher Queries

```cypher
# Find all functions
MATCH (n:FunctionDeclaration) RETURN n LIMIT 20

# Find function calls
MATCH (caller:FunctionDeclaration)-[r:CALLS]->(callee:FunctionDeclaration)
RETURN caller, r, callee LIMIT 50

# Find unsafe code
MATCH (n) WHERE n.code CONTAINS 'unsafe' RETURN n

# Data flow analysis
MATCH path = (source)-[:DFG*1..5]->(sink)
RETURN path LIMIT 10
```

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process
lsof -i :8080
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "8081:8080"
```

### Container Keeps Restarting
```bash
# Check logs
docker-compose logs backend

# Common causes:
# - Neo4j not ready (wait 30-60 seconds)
# - Wrong password in .env
# - Insufficient memory (increase Docker RAM to 4GB+)
```

### Neo4j Authentication Failed
```bash
# Reset and restart
docker-compose down -v
docker-compose up -d

# Wait for initialization
docker-compose logs -f neo4j
# Look for "Started." message
```

### Frontend Not Loading
```bash
# Check static files exist
ls app/src/main/resources/static/

# Rebuild containers
docker-compose up --build
```

### Database Locked
```bash
docker-compose down
rm storage/projects.db-shm storage/projects.db-wal
docker-compose up
```

### Slow Graph Queries
Connect to Neo4j browser (http://localhost:7474) and create indexes:
```cypher
CREATE INDEX project_id FOR (n:Node) ON (n.projectId);
CREATE INDEX function_name FOR (n:FunctionDeclaration) ON (n.name);
```

For large graphs: Use `LIMIT` in queries and filter by specific node types.

## Local Development (Without Docker)

### Prerequisites
- JDK 21, Gradle 8.5+
- Node.js 20+, npm 10+
- Rust 1.55.0+, LLVM 16+
- Neo4j 5.20.0, Redis 7.2+

### Setup
```bash
# Backend
export NEO4J_HOST=localhost NEO4J_USER=neo4j NEO4J_PASSWORD=password
export REDIS_HOST=localhost
export LD_LIBRARY_PATH=/usr/lib/llvm-16/lib:$LD_LIBRARY_PATH
cd app
./gradlew run

# Frontend (in new terminal)
cd app/frontend
npm install
npm run dev
```

## Testing with Sample Files

Use files from `dataset/` directory via the web UI or API:
```bash
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"sourceCode\":\"$(cat dataset/buffer_overflow_high_rust_004.rs)\"}"
```

## License

[Add your license]

## Acknowledgments

- [Fraunhofer AISEC CPG](https://github.com/Fraunhofer-AISEC/cpg)
- [Ktor](https://ktor.io/)
- [Neo4j](https://neo4j.com/)

