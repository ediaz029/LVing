# RVing - Rust Vulnerability Detection Framework
A comprehensive static analysis tool for identifying memory safety and concurrency vulnerabilities in Rust programs through graph-based visualization and analysis.

## Overview
**RVing** is a static analysis framework for detecting memory safety and concurrency vulnerabilities in Rust programs through graph-based program representation. This tool constructs Code Property Graphs (CPGs) from LLVM Intermediate Representation, enabling systematic analysis of low-level memory operations and vulnerability patterns. Built on the Fraunhofer Institute's CPG library, RVing provides a scalable platform for automated vulnerability detection and interactive program exploration via Neo4j graph visualization.

---

## Prerequisites
- **Docker & Docker Compose**: Install [Docker](https://docs.docker.com/get-docker/) (includes Docker Compose)

---

**Key Files:**
- **docker-compose.yml**: Orchestrates backend, frontend, and Neo4j services
- **.env**: Environment variables (Neo4j credentials)

---

## Environment Variables

Create a `.env` file in the project root with your Neo4j credentials:

```env
NEO4J_PASSWORD=your_password_here
NEO4J_IP=your_neo4j_ip_here
```
---

# Getting Started

## 1. Setup Environment
```bash
git clone <repository-url>
cd RVing
cp .env.template .env
# Edit .env with your Neo4j credentials
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
