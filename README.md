# RVing - Rust Vulnerability Detection Framework
A comprehensive static analysis tool for identifying memory safety and concurrency vulnerabilities in Rust programs through graph-based visualization and analysis.

## Overview
**RVing** is a static analysis framework for detecting memory safety and concurrency vulnerabilities in Rust programs through graph-based program representation. This tool constructs Code Property Graphs (CPGs) from LLVM Intermediate Representation, enabling systematic analysis of low-level memory operations and vulnerability patterns. Built on the Fraunhofer Institute's CPG library, RVing provides a scalable platform for automated vulnerability detection and interactive program exploration via Neo4j graph visualization.

---

## Prerequisites

- **Docker**: Install [Docker](https://docs.docker.com/get-docker/).
- **Docker Compose**: Comes bundled with Docker Desktop on Windows/Mac. On Linux, install separately if needed.

---


**Key Files:**

- **docker-compose.yml**: Defines the `backend` and `frontend` services.
- **.env**: Contains environment variables like `NEO4J_PASSWORD`.
- **src/backend/Dockerfile**: Builds the Python backend image.
- **src/frontend/Dockerfile**: Builds the Vue (Vite) frontend image.

---

## Environment Variables

Create a `.env` file in the project root with your Neo4j credentials:

```env
NEO4J_PASSWORD=your_password_here
NEO4J_IP=your_neo4j_ip_here
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
