"""
FastAPI back-end:
POST /convert   (form field 'code')
Returns JSON with stdout / stderr / link.
"""
import subprocess, tempfile, pathlib, os, sys
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j import GraphDatabase
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO)

#Env variables 
NEO4J_HOST = os.getenv("NEO4J_HOST", "neo4j")
NEO4J_HTTP_PORT = os.getenv("NEO4J_HTTP_PORT", "7474")
NEO4J_BROWSER_HOST = os.getenv("NEO4J_BROWSER_HOST", "localhost")
NEO4J_URL = f"http://{NEO4J_BROWSER_HOST}:{NEO4J_HTTP_PORT}"
BACKEND_HOST = os.getenv("BACKEND_HOST", "localhost")
BACKEND_PORT = os.getenv("BACKEND_PORT", "8000")
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
import subprocess
import sys
import os

SCRIPT = "./LVing.sh"

#ensuring NEO4J_PASSWORD is set
NEO4J_PASS = os.getenv("NEO4J_PASSWORD")
if not NEO4J_PASS:
    print("ERROR: NEO4J_PASSWORD environment variable is required!", file=sys.stderr)
    sys.exit(1)

# Neo4j connection setup
NEO4J_URI = f"bolt://{NEO4J_HOST}:7687"
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")

def get_neo4j_driver():
    """Create and return Neo4j driver instance with retry logic"""
    max_retries = 30  # Try for up to 60 seconds
    retry_delay = 2   # Wait 2 seconds between retries
    
    for attempt in range(max_retries):
        try:
            logging.info(f"Attempting to connect to Neo4j (attempt {attempt + 1}/{max_retries})")
            driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
            # Test the connection
            driver.verify_connectivity()
            logging.info("Neo4j connection successful!")
            return driver
        except Exception as e:
            if attempt < max_retries - 1:
                logging.warning(f"Neo4j connection failed (attempt {attempt + 1}/{max_retries}): {e}")
                logging.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logging.error(f"Failed to connect to Neo4j after {max_retries} attempts: {e}")
                raise HTTPException(status_code=500, detail=f"Neo4j connection failed after {max_retries} attempts: {str(e)}")

# Create global driver instance with lazy initialization
neo4j_driver = None

def ensure_neo4j_connection():
    """Ensure Neo4j connection is established, with lazy initialization"""
    global neo4j_driver
    if neo4j_driver is None:
        try:
            neo4j_driver = get_neo4j_driver()
            logging.info("Neo4j driver initialized successfully")
        except Exception as e:
            logging.error(f"Neo4j driver initialization failed: {e}")
            raise e
    return neo4j_driver

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

class CypherQuery(BaseModel):
    query: str

@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "service": "LVing Backend",
        "status": "healthy",

@app.post("/convert/")
def convert_code(code: str = Form(...)):
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "snippet.rs"
        src.write_text(code)

        proc = subprocess.run(
            [SCRIPT, str(src)],
            text=True,
            capture_output=True,
            env={**os.environ, "NEO4J_PASSWORD": NEO4J_PASS}
        )

        return {
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "neo4j_browser": NEO4J_URL,
            "return_code": proc.returncode
        }

@app.get("/config")
def get_config():
    """Frontend configuration endpoint"""
    return {
        "backend_url": BACKEND_URL,
        "neo4j_url": NEO4J_URL
    }

@app.post("/cypher")
def run_cypher(query: CypherQuery):
    """Execute Cypher query against Neo4j and return formatted results"""
    
    # Ensure Neo4j connection is established
    try:
        driver = ensure_neo4j_connection()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Neo4j connection failed: {str(e)}")
    
    nodes = {}
    edges = {}  # Changed from list to dict to prevent duplicates
    
    try:
        with driver.session() as session:
            logging.info(f"Executing query: {query.query}")
            result = session.run(query.query)
            
            for record in result:
                for value in record.values():
                    # Check if it's a Node
                    if hasattr(value, "labels") and hasattr(value, "id"):
                        node_id = str(value.id)
                        if node_id not in nodes:
                            nodes[node_id] = {
                                "id": node_id,
                                "label": next(iter(value.labels), "Node"),
                                "title": dict(value.items())
                            }
                    
                    # Check if it's a Relationship
                    elif hasattr(value, "type") and hasattr(value, "start_node") and hasattr(value, "end_node"):
                        edge_id = str(value.id)
                        if edge_id not in edges:  # Prevent duplicate edges
                            edges[edge_id] = {
                                "id": edge_id,
                                "from": str(value.start_node.id),
                                "to": str(value.end_node.id),
                                "label": value.type,
                                "title": dict(value.items())
                            }
                    
                    # Check if it's a Path (contains nodes and relationships)
                    elif hasattr(value, "nodes") and hasattr(value, "relationships"):
                        # Process all nodes in the path
                        for node in value.nodes:
                            node_id = str(node.id)
                            if node_id not in nodes:
                                nodes[node_id] = {
                                    "id": node_id,
                                    "label": next(iter(node.labels), "Node"),
                                    "title": dict(node.items())
                                }
                        
                        # Process all relationships in the path
                        for rel in value.relationships:
                            edge_id = str(rel.id)
                            if edge_id not in edges:  # Prevent duplicate edges
                                edges[edge_id] = {
                                    "id": edge_id,
                                    "from": str(rel.start_node.id),
                                    "to": str(rel.end_node.id),
                                    "label": rel.type,
                                    "title": dict(rel.items())
                                }
        
        result_data = {
            "nodes": list(nodes.values()),
            "edges": list(edges.values())  # Convert dict values to list
        }
        
        logging.info(f"Query returned {len(result_data['nodes'])} nodes and {len(result_data['edges'])} edges")
        return result_data
        
    except Exception as e:
        logging.error(f"Cypher query failed: {e}")
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")
    
    finally:
        # No need to close session, it's handled by the 'with' statement
        pass

# Cleanup function
@app.on_event("shutdown")
def shutdown_event():
    """Clean up Neo4j driver on application shutdown"""
    if neo4j_driver:
        neo4j_driver.close()
        logging.info("Neo4j driver closed")