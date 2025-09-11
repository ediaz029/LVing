"""
FastAPI back-end:
POST /convert   (form field 'code')
Returns JSON with stdout / stderr / link.
"""
from ConnectionCypher import CONNECTION_CYPHER

import subprocess, tempfile, pathlib, os, sys, requests, base64
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from neo4j import GraphDatabase
import logging
import time
import requests
import base64
import re

VAR_DECLARATION_PATTERNS = [
    r'let\s*(\s*(mut\s*(\w+))\s*:\s*[^=]+?\s*=\s*(?!\s*[\(\{]).+?);', # Typed Mutable
    r'let\s*(\s*(mut\s*(\w+))\s*=\s*(?!\s*[\(\{]).+?);', # Mutable
    r'let\s*(\s*((\w+))\s*:\s*[^=]+?\s*=\s*(?!\s*[\(\{]).+?);', # Typed Immutable
    r'let\s*(\s*((\w+))\s*=\s*(?!\s*[\(\{]).+?);' # Immutable
]

# Set up logging
logging.basicConfig(level=logging.INFO)

#Env variables 
NEO4J_HOST = os.getenv("NEO4J_HOST", "neo4j")
NEO4J_HTTP_PORT = os.getenv("NEO4J_HTTP_PORT", "7474")
NEO4J_BROWSER_HOST = os.getenv("NEO4J_BROWSER_HOST", "localhost")
NEO4J_URL = f"http://{NEO4J_BROWSER_HOST}:{NEO4J_HTTP_PORT}"
BACKEND_HOST = os.getenv("BACKEND_HOST", os.getenv("NEO4J_IP", "localhost"))
BACKEND_PORT = os.getenv("BACKEND_PORT", "8000")
BACKEND_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}"
import time
import asyncio

SCRIPT = "./LVing.sh"
ANNOTATION_MACRO_LOC = pathlib.Path(__file__).parent / "AnnotationMacro.rs"
ANNOTATION_MACRO_LOC = ANNOTATION_MACRO_LOC.resolve()

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

def filter_technical_output(output):
    """Filter technical output to show only user-relevant information"""
    if not output:
        return ""
    
    lines = output.split('\n')
    filtered_lines = []
    
    # Skip very technical lines but keep important ones
    skip_patterns = [
        'org.neo4j',
        'java.lang',
        'at com.github',
        'INFO  [',
        'DEBUG [',
        'WARN  [',
        'Exception in thread',
        'Caused by:',
        '\tat ',  # Stack trace lines
        'SLF4J:',
        'log4j',
        'WARNING: An illegal reflective access',
    ]
    
    keep_patterns = [
        '»',  # Our custom script messages
        '✓',  # Success indicators
        'ERROR:',
        'nodes',
        'edges',
        'CPG',
        'LLVM-IR',
        'Neo4j',
        'Processing',
        'Finished',
        'Done',
        'Graph contains:',  # Our new validation messages
        'Validating',
        'Waiting for Neo4j to commit',
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Always keep lines with our keep patterns
        if any(pattern in line for pattern in keep_patterns):
            filtered_lines.append(line)
            continue
            
        # Skip lines with technical patterns
        if any(pattern in line for pattern in skip_patterns):
            continue
            
        # Keep other short, non-technical lines
        if len(line) < 100 and not line.startswith('    '):
            filtered_lines.append(line)
    
    return '\n'.join(filtered_lines[:10])  # Limit to 10 lines max

def extract_success_details(stdout, stderr):
    """Extract relevant success information from output"""
    details = []
    
    # Look for node/edge counts
    all_output = stdout + stderr
    lines = all_output.split('\n')
    
    for line in lines:
        if 'nodes' in line.lower() and 'edges' in line.lower():
            details.append(line.strip())
        elif '✓' in line:
            details.append(line.strip())
        elif 'successfully' in line.lower() and len(line) < 80:
            details.append(line.strip())
    
    if not details:
        return "Code Property Graph has been successfully exported to Neo4j"
    
    return ' | '.join(details[:3])  # Limit to 3 most relevant details

def extract_error_details(stderr, stdout):
    """Extract the most relevant error information"""
    error_lines = []
    all_output = stderr + stdout
    
    lines = all_output.split('\n')
    
    for line in lines:
        line = line.strip()
        if any(keyword in line.lower() for keyword in ['error:', 'exception', 'failed', 'cannot', 'unable']):
            # Clean up common technical prefixes
            cleaned = line.replace('ERROR:', '').replace('Exception:', '').strip()
            if len(cleaned) > 10 and len(cleaned) < 150:  # Reasonable length
                error_lines.append(cleaned)
    
    if not error_lines:
        return "Analysis failed due to an unknown error. Please check your Rust code syntax."
    
    return ' | '.join(error_lines[:2])  # Show max 2 error lines

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

def replace_declaration(match: re.Match):
    # group(0) will return the whole string.
    # group(1) is the mutable keyword, variable name, operator, and expression.
    # group(2) is the variable name and mutable keyword.
    # group(3) is the variable name ALONE.
    return f"annotate!({match.group(1)}, \"{match.group(3)}\", line!());"

def parse(code: str):
    """
    Updates code's header to include the link_llvm_intrinsics feature
    and import the AnnotationMacro.rs. 

    Automatically wraps annotate! around select variable declarations.
    """
    header = f"#![feature(link_llvm_intrinsics)]\ninclude!(\"{ANNOTATION_MACRO_LOC}\");\n"
    code = header + code
    for pattern_regex in VAR_DECLARATION_PATTERNS:
        pattern = re.compile(pattern_regex, re.S)
        code = pattern.sub(replace_declaration, code)
    return code

def link_annotation_nodes() -> str:
    try:
        driver = ensure_neo4j_connection()
    except Exception as e:
        # It's not necessarily a CRITICAL error if we fail here.
        # ..because we're assuming that our CPG is within Neo4J.
        # The only thing the user would miss out on is the annotation links.
        return "[FAILED] Annotation Link: Could not connect to Neo4J."

    with driver.session() as session:
        result = session.run(CONNECTION_CYPHER)
        for n in result:
            print (n.keys(), n.values())
        return "[SUCCESS] Annotation Link success!"

    return "[FAILED] Annotation Link: Could not properly run link cypher."

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
        "status": "healthy",
        "service": "LVing Backend",
        "neo4j_url": NEO4J_URL
    }

@app.post("/convert/")
def convert_code(code: str = Form(...)):
    with tempfile.TemporaryDirectory() as tmp:
        code = parse(code)
        src = pathlib.Path(tmp) / "snippet.rs"
        src.write_text(code)

        proc = subprocess.run(
            [SCRIPT, str(src)],
            text=True,
            capture_output=True,
            env={**os.environ, "NEO4J_PASSWORD": NEO4J_PASS}
        )

        # Enhanced response handling for different scenarios
        response_data = {
            "neo4j_browser": NEO4J_URL,
            "return_code": proc.returncode
        }

        # Process and filter output for user-friendly display
        filtered_stdout = filter_technical_output(proc.stdout)
        filtered_stderr = filter_technical_output(proc.stderr)

        # Add contextual information based on exit code
        if proc.returncode == 2:
            # Empty CPG results
            response_data["analysis_status"] = "empty"
            response_data["user_message"] = "Analysis completed but produced no graph data"
            response_data["details"] = "The Rust code was too simple for meaningful analysis. Try adding functions, data structures, or control flow."
            response_data["stdout"] = ""  # Hide technical output for empty results
            response_data["stderr"] = ""  # Hide stderr for empty results - user doesn't need to see warnings
        elif proc.returncode == 0:
            # Successful analysis - but we need to verify it actually worked
            response_data["analysis_status"] = "success"
            response_data["user_message"] = "Code analysis completed successfully!"
            
            # Extract success details, but provide fallback if validation failed
            success_details = extract_success_details(proc.stdout, proc.stderr)
            if "Graph contains:" in success_details:
                response_data["details"] = success_details
            else:
                # Validation might have failed, but CPG export probably succeeded
                response_data["details"] = "Code Property Graph exported to Neo4j successfully!"

            response_data["stdout"] = filtered_stdout
            response_data["stderr"] = ""  # Hide stderr on success to reduce noise
        else:
            # Error occurred
            response_data["analysis_status"] = "error"
            response_data["user_message"] = "Analysis failed"
            response_data["details"] = extract_error_details(proc.stderr, proc.stdout)
            response_data["stdout"] = filtered_stdout
            response_data["stderr"] = filtered_stderr

        # Once we have the CPG within Neo4J, we need to link our annotation nodes 
        # to the node its actually annotating.
        # XXX: LVing.sh actually doesn't return 0..which is why I have this here.
        link_details = link_annotation_nodes()
        response_data["details"] += link_details

        # Debug logging to help troubleshoot
        logging.info(f"Analysis completed - Status: {response_data.get('analysis_status', 'unknown')}, Return code: {proc.returncode}")
        if proc.returncode == 0:
            logging.info(f"Success details: {response_data.get('details', 'none')}")

        return response_data

@app.get("/config")
def get_config():
    """Frontend configuration endpoint"""
    return {
        "backend_url": BACKEND_URL,
        "neo4j_url": NEO4J_URL
    }

@app.get("/data-status")
def check_data_status():
    """Check if Neo4j contains any CPG data"""
    
    try:
        # Query Neo4j to check for any nodes
        auth_header = base64.b64encode(f"neo4j:{NEO4J_PASS}".encode()).decode()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth_header}"
        }
        
        query_data = {
            "statements": [{"statement": "MATCH (n) RETURN count(n) as nodeCount LIMIT 1"}]
        }
        
        response = requests.post(
            f"http://{NEO4J_HOST}:{NEO4J_HTTP_PORT}/db/data/transaction/commit",
            json=query_data,
            headers=headers,
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("results") and len(data["results"]) > 0:
                node_count = data["results"][0]["data"][0]["row"][0] if data["results"][0]["data"] else 0
                has_data = node_count > 0
                return {
                    "has_data": has_data,
                    "node_count": node_count,
                    "status": "connected"
                }
        
        return {"has_data": False, "node_count": 0, "status": "query_failed"}
        
    except Exception as e:
        return {"has_data": False, "node_count": 0, "status": "connection_failed", "error": str(e)}

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