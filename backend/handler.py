"""
FastAPI back-end:
POST /convert   (form field 'code')
Returns JSON with stdout / stderr / link.
"""
import subprocess, tempfile, pathlib, os, sys
from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware

# Environment variables 
NEO4J_HOST = os.getenv("NEO4J_HOST", "neo4j")
NEO4J_HTTP_PORT = os.getenv("NEO4J_HTTP_PORT", "7474")
NEO4J_URL = f"http://{NEO4J_HOST}:{NEO4J_HTTP_PORT}"
SCRIPT = "./RVing.sh"

# Critical: NEO4J_PASSWORD must be set
NEO4J_PASS = os.getenv("NEO4J_PASSWORD")
if not NEO4J_PASS:
    print("ERROR: NEO4J_PASSWORD environment variable is required!", file=sys.stderr)
    sys.exit(1)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "RVing Backend",
        "neo4j_url": NEO4J_URL
    }

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