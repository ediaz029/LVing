# LVing - Vulnerability Detection Framework
A comprehensive static analysis tool built for identifying memory safety and concurrency vulnerabilities in programming languages leveraging the LLVM compiler framework, with a particular interest in the Rust language, through graph-based visualization and analysis.

## Overview
**LVing** is a static analysis framework for detecting memory safety and concurrency vulnerabilities in Rust programs through graph-based program representation. This tool constructs Code Property Graphs (CPGs) from LLVM Intermediate Representation, enabling systematic analysis of low-level memory operations and vulnerability patterns. Built on the Fraunhofer Institute's CPG library, LVing provides a scalable platform for automated vulnerability detection and interactive program exploration via Neo4j graph visualization.

---

## Prerequisites
- **Docker & Docker Compose**: Install [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose)

---

**Key Files:**
- **docker-compose.yml**: Orchestrates backend, frontend, and Neo4j services
- **.env**: Environment variables (Neo4j credentials)

---

## Environment Variables

Create a `.env` file in the project root with your configuration:

```env
# Required: Neo4j password
NEO4J_PASSWORD=your_password_here

# IP address where Neo4j and backend services will be accessible
# For local development: localhost
# For remote deployment: your server's external IP
NEO4J_IP=your_neo4j_ip_here

# Backend host configuration (defaults to NEO4J_IP if not specified)
BACKEND_HOST=your_backend_ip_here
BACKEND_PORT=8000

# Neo4j browser host (what users see in browser, usually same as NEO4J_IP)
NEO4J_BROWSER_HOST=your_neo4j_ip_here
```
---

# Getting Started

## 1. Setup Environment
```bash
git clone <repository-url>
cd LVing
cp .env.example .env
# Edit .env with your configuration:
# - Set NEO4J_PASSWORD to a secure password
# - Set NEO4J_IP to your server's IP (or localhost for local development)
# - Optionally customize BACKEND_HOST if different from NEO4J_IP
```
## 2. Deploy Services
```bash
docker compose build
docker compose up
```
## 3. Access Services
- **Frontend:** http://your_ip:8080
- **Neo4j Browser:** http://your_ip:7474
- **API:** http://your_ip:8000
