# RVing - Rust Vulnerability Detection Framework
A graph-based visualization tool that detects hidden concurrency vulnerabilities in Rust programs by analyzing code at the LLVM Intermediate Representation (IR) level.

---

## Prerequisites

- **Docker**: Install [Docker](https://docs.docker.com/get-docker/).
- **Docker Compose**: Comes bundled with Docker Desktop on Windows/Mac. On Linux, install separately if needed.

---


**Key Files:**

- **docker-compose.yml**: Defines the `backend` and `frontend` services.
- **.env**: Contains environment variables like `NEO4J_IP`, `NEO4J_USER`, `NEO4J_PASS`.
- **src/backend/Dockerfile**: Builds the Python backend image.
- **src/frontend/Dockerfile**: Builds the Vue (Vite) frontend image.

---

## Environment Variables

Create a `.env` file in the project root with your Neo4j credentials:

```env
NEO4J_IP=your.neo4j.external.ip
NEO4J_USER=neo4j
NEO4J_PASS=your_password
```
---

# Running the Containers

## 1. Clone this Repository
If you haven’t already, clone this repository.  

## 2. Navigate to the Project Root
Ensure you are in the directory where `docker-compose.yml` is located.  

## 3. Build and Start the Containers
Run the following command:  

```bash
docker-compose up --build
```
## This Will
- Build the **FASTAPI backend** image.  
- Build the **frontend** image.  
- Start both containers on a Docker network (`app-network`).  
