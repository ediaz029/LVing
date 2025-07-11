// Global variable to store backend URL
let BACKEND_URL = "http://localhost:8000"; // fallback default

// Example Rust codes
const EXAMPLES = {
  datarace: `use std::thread;
use std::sync::Arc;

// create a wrapper struct for a raw pointer
struct SendablePtr(*mut i32);

unsafe impl Send for SendablePtr {}

fn main() {
    let data = Arc::new(42);
    let raw_data = Arc::into_raw(data) as *mut i32;

    let handles: Vec<_> = (0..2)
        .map(|_| {
            // create a new SendablePtr to pass to each thread
            let sendable_ptr = SendablePtr(raw_data);
            thread::spawn(move || {
                unsafe {
                    *sendable_ptr.0 += 1; // modify the value concurrently -> data race
                    println!("Value modified in thread: {}", *sendable_ptr.0);
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }
}`,
  fibonacci: `fn fibonacci(n: u32) -> u32 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    for i in 0..10 {
        println!("{}: {}", i, fibonacci(i));
    }
}`
};

// Utility to get backend URL for cypher endpoint
function getCypherEndpoint() {
  // If you need to change this to a full URL, do it here
  return `${BACKEND_URL}/cypher`;
}

// Cypher example
const CYPHER_EXAMPLE = `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`;

// Initialize CodeMirror editor
let codeEditor;
let cypherEditor;

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Create CodeMirror editor with simple configuration
    codeEditor = CodeMirror(document.getElementById("codeEditor"), {
      value: "// Paste your Rust code here...\n\nfn main() {\n    println!(\"Hello, world!\");\n}",
      mode: "rust",
      theme: "monokai",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      extraKeys: {
        "Tab": function(cm) {
          cm.replaceSelection("    ", "end");
        }
      }
    });
    
    // Set editor height
    codeEditor.setSize("100%", "500px");

    // Example button logic
    document.querySelectorAll('.example-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const example = this.getAttribute('data-example');
        if (EXAMPLES[example]) {
          codeEditor.setValue(EXAMPLES[example]);
        }
      });
    });

    // Cypher CodeMirror setup
    cypherEditor = CodeMirror(document.getElementById("cypherEditor"), {
      value: CYPHER_EXAMPLE,
      mode: "cypher",
      theme: "monokai",
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      extraKeys: {
        "Tab": function(cm) {
          cm.replaceSelection("  ", "end");
        }
      }
    });
    cypherEditor.setSize("100%", "120px");

  } catch (error) {
    console.error("Failed to load CodeMirror:", error);
    // Fallback to simple textarea if CodeMirror fails
    const container = document.getElementById("codeEditor");
    container.innerHTML = '<textarea style="width:100%;height:500px;font-family:monospace;padding:10px;border:none;outline:none;" placeholder="// Paste your Rust code here...\n\nfn main() {\n    println!(\"Hello, world!\");\n}"></textarea>';
    // Example button logic for fallback
    document.querySelectorAll('.example-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const example = this.getAttribute('data-example');
        const textarea = container.querySelector('textarea');
        if (EXAMPLES[example] && textarea) {
          textarea.value = EXAMPLES[example];
        }
      });
    });
  }
});

document.getElementById("codeForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const submitButton = e.target.querySelector('button[type="submit"]');
  const resultElement = document.getElementById("result");
  
  // Get code from the editor
  let code;
  if (codeEditor && codeEditor.getValue) {
    code = codeEditor.getValue();
  } else {
    // Fallback for simple textarea
    const textarea = document.querySelector('#codeEditor textarea');
    code = textarea ? textarea.value : '';
  }
  
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";
  resultElement.textContent = "Analyzing code...";
  
  try {
    const formData = new FormData();
    formData.append("code", code);
    
    const res = await fetch(`${BACKEND_URL}/convert/`, {
      method: "POST", 
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const json = await res.json();
    
    let output = "";
    if (json.return_code !== 0) {
      output += "[WARNING] Analysis completed with warnings:\n";
    } else {
      output += "[SUCCESS] Analysis completed successfully:\n";
    }
    
    if (json.stderr) {
      output += "\n[ANALYSIS OUTPUT]\n" + json.stderr + "\n";
    }
    
    if (json.stdout) {
      output += "\n[PROCESS LOG]\n" + json.stdout + "\n";
    }
    
    if (json.neo4j_browser) {
      output += `\n[NEO4J BROWSER] View results at: ${json.neo4j_browser}\n`;
      output += "Username: neo4j | Password: [your configured password]";
    }
    
    resultElement.textContent = output;
    
  } catch (error) {
    console.error("Analysis failed:", error);
    resultElement.textContent = `[ERROR] ${error.message}\n\nPlease check:\n- Backend service is running\n- Rust code syntax is valid\n- Network connectivity`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Convert & Export to Neo4j";
  }
};

// Run Cypher Query and visualize
const runCypherBtn = document.getElementById('runCypherBtn');
if (runCypherBtn) {
  runCypherBtn.addEventListener('click', async () => {
    const query = cypherEditor.getValue();
    const graphDiv = document.getElementById('graphResult');
    graphDiv.innerHTML = '<div style="color:#fff;padding:1rem;">Running query...</div>';
    try {
      const res = await fetch(getCypherEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();
      if (!data.nodes || !data.edges) throw new Error('Invalid data format from backend');
      renderGraph(data, graphDiv);
    } catch (e) {
      graphDiv.innerHTML = `<div style='color:#f66;padding:1rem;'>${e.message}</div>`;
    }
  });
}

// Render Neo4j result as a graph using vis-network
function renderGraph(data, container) {
  // Clear previous graph
  container.innerHTML = '';
  // Expecting data: { nodes: [{id, label, ...}], edges: [{from, to, label, ...}] }
  const nodes = new vis.DataSet(data.nodes || []);
  const edges = new vis.DataSet(data.edges || data.relationships || []);
  const network = new vis.Network(
    container,
    { nodes, edges },
    {
      nodes: { shape: 'dot', size: 20, font: { color: '#fff' }, color: { background: '#007acc', border: '#fff' } },
      edges: { color: { color: '#fff' }, arrows: 'to', font: { color: '#fff' } },
      layout: { improvedLayout: true },
      physics: { enabled: true }
    }
  );
}

window.addEventListener('load', async () => {
  // Try to load configuration from backend
  try {
    const configResponse = await fetch(`${BACKEND_URL}/config`);
    if (configResponse.ok) {
      const config = await configResponse.json();
      BACKEND_URL = config.backend_url;
      console.log("[SUCCESS] Backend config loaded:", config);
    }
  } catch (error) {
    console.warn("[WARNING] Could not load backend config, using fallback URL:", BACKEND_URL);
  }

  // Test backend connectivity
  try {
    const response = await fetch(`${BACKEND_URL}/`);
    if (response.ok) {
      console.log("[SUCCESS] Backend connected");
    }
  } catch (error) {
    console.warn("[WARNING] Backend not accessible:", error.message);
  }
});