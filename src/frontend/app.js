// Cache-busting enabled - this should always load the latest version
console.log("🚀 RVing Frontend loaded - Version: 2024-01-18-cache-busting-fix");
console.log("📅 Timestamp:", new Date().toISOString());

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

// Cypher example - beginner-friendly queries
const CYPHER_EXAMPLE = `// Start with simple queries:
MATCH (n) RETURN n LIMIT 10

// Find specific node types:
// MATCH (v:ValueDeclaration) RETURN v LIMIT 5

// Explore relationships:
// MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 10

// Advanced: Find data flow patterns:
// MATCH (v:ValueDeclaration)
// WHERE v.code CONTAINS 'sendable_ptr'
// WITH v
// MATCH path = (v)-[:DFG*1..6]-(access)
// RETURN path`;

// Initialize CodeMirror editor
let codeEditor;
let cypherEditor;

// Function to initialize editors
function initializeEditors() {
  console.log("🎛️ Initializing CodeMirror editors...");
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
    
    console.log("✅ CodeMirror editors initialized successfully");

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
}

// Initialize editors when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditors);
} else {
  // DOM is already ready, initialize immediately
  initializeEditors();
}

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
    
    // Debug: Log the response to understand what we're getting
    console.log("Backend response:", json);
    
    let output = "";
    
    // Handle different analysis statuses with clean, user-friendly messages
    if (json.analysis_status === "empty") {
      output += "📊 " + json.user_message + "\n\n";
      output += "💡 " + json.details + "\n\n";
      output += "🔧 Suggestions for meaningful analysis:\n";
      output += "   • Add function definitions and calls\n";
      output += "   • Use data structures (Vec, HashMap, structs)\n";
      output += "   • Include control flow (if/else, match, loops)\n";
      output += "   • Add error handling (Result, Option)\n";
      output += "   • Use external crates\n\n";
      // Don't show technical output for empty results - it's confusing
    } else if (json.analysis_status === "success") {
      output += "🎉 " + json.user_message + "\n";
      if (json.details) {
        output += "📈 " + json.details + "\n";
      }
      output += "\n🎮 Ready to explore! Use the Cypher query panel on the right to analyze your code graph.\n";
      output += "💡 Please select a query.\n";
      // Show minimal technical details for success
      if (json.stdout && json.stdout.trim() && json.stdout.includes("✓")) {
        output += "\n📋 " + json.stdout.trim() + "\n";
      }
    } else if (json.analysis_status === "error") {
      output += "❌ " + json.user_message + "\n";
      if (json.details) {
        output += "🔍 Issue: " + json.details + "\n";
      }
      output += "\n💭 Common solutions:\n";
      output += "   • Check Rust syntax errors\n";
      output += "   • Ensure Neo4j is running\n";
      output += "   • Try simpler code first\n\n";
      // Show technical output for errors to help debugging
      if (json.stdout && json.stdout.trim()) {
        output += "\n📋 Technical Details:\n" + json.stdout.trim() + "\n";
      }
    } else {
      // Fallback for backward compatibility
      if (json.return_code !== 0) {
        output += "⚠️ Analysis completed with warnings\n";
      } else {
        output += "✅ Analysis completed successfully\n";
      }
      // Show technical output for fallback cases
      if (json.stdout && json.stdout.trim()) {
        output += "\n📋 Process Details:\n" + json.stdout.trim() + "\n";
      }
    }

    resultElement.textContent = output;
    
  } catch (error) {
    console.error("Analysis failed:", error);
    resultElement.textContent = `❌ Connection Error: ${error.message}\n\n🔧 Please check:\n   • Backend service is running\n   • Network connectivity\n   • Rust code syntax is valid`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Convert & Export to Neo4j";
  }
};

// Run Cypher Query and visualize with enhanced data checking
const runCypherBtn = document.getElementById('runCypherBtn');
if (runCypherBtn) {
  runCypherBtn.addEventListener('click', async () => {
    const graphDiv = document.getElementById('graphResult');
    
    // First, check if Neo4j has any data
    try {
      const statusResponse = await fetch(`${BACKEND_URL}/data-status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        
        if (!statusData.has_data) {
          graphDiv.innerHTML = `
            <div style="color: #ff6b6b; padding: 20px; text-align: center; background: #2a2a2a; border-radius: 8px;">
              <h4>📊 No Data Available</h4>
              <p>Neo4j database is empty. Please convert and export some Rust code first.</p>
              <p style="margin-top: 15px; color: #999;">
                <strong>Quick Start:</strong><br>
                1️⃣ Paste Rust code in the left panel<br>
                2️⃣ Click "Convert & Export to Neo4j"<br>
                3️⃣ Wait for success message<br>
                4️⃣ Then run your Cypher queries here
              </p>
            </div>
          `;
          return;
        }
        
        console.log(`✅ Found ${statusData.node_count} nodes in Neo4j - ready for queries`);
      }
    } catch (error) {
      console.warn("Could not check data status:", error.message);
      // Proceed anyway - might be a network issue
    }

    // Execute the query if data exists
    const query = cypherEditor.getValue().trim();
    
    if (!query) {
      graphDiv.innerHTML = `
        <div style="color: #ffa726; padding: 20px; text-align: center; background: #2a2a2a; border-radius: 8px;">
          <h4>✏️ Empty Query</h4>
          <p>Please write a Cypher query in the editor above</p>
          <p style="color: #999; margin-top: 10px;">
            Example: <code style="background: #444; padding: 2px 6px; border-radius: 3px;">MATCH (n) RETURN n LIMIT 10</code>
          </p>
        </div>
      `;
      return;
    }

    graphDiv.innerHTML = '<div style="color:#4ecdc4;padding:1rem;text-align:center;background:#2a2a2a;border-radius:8px;">🔍 Executing query...</div>';
    
    try {
      const res = await fetch(getCypherEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Query failed: ${errorData}`);
      }
      
      const data = await res.json();
      
      if (!data.nodes && !data.edges) {
        throw new Error('Query returned no graph data');
      }

      if (data.nodes.length === 0 && data.edges.length === 0) {
        graphDiv.innerHTML = `
          <div style="color: #ffa726; padding: 20px; text-align: center; background: #2a2a2a; border-radius: 8px;">
            <h4>📭 No Results</h4>
            <p>Your query executed successfully but returned no data</p>
            <p style="color: #999; margin-top: 10px;">
              Try a broader query like: <code style="background: #444; padding: 2px 6px; border-radius: 3px;">MATCH (n) RETURN n LIMIT 10</code>
            </p>
          </div>
        `;
        return;
      }

      // Render the interactive graph
      renderGraph(data, graphDiv);
      
      // Show query stats
      const statsDiv = document.createElement('div');
      statsDiv.style.cssText = 'color: #4ecdc4; padding: 10px; text-align: center; font-size: 12px;';
      statsDiv.innerHTML = `📊 Found ${data.nodes.length} nodes and ${data.edges.length} edges`;
      graphDiv.appendChild(statsDiv);
      
    } catch (e) {
      console.error('Query execution failed:', e);
      graphDiv.innerHTML = `
        <div style='color:#ff6b6b;padding:20px;text-align:center;background:#2a2a2a;border-radius:8px;'>
          <h4>❌ Query Error</h4>
          <p>${e.message}</p>
          <p style="color: #999; margin-top: 10px; font-size: 12px;">
            Check your Cypher syntax and try again
          </p>
        </div>
      `;
    }
  });
}

// Render Neo4j result as a graph using vis-network
function renderGraph(data, container) {
  // Clear previous graph
  container.innerHTML = '';
  
  // Expecting data: { nodes: [{id, label, ...}], edges: [{from, to, label, ...}] }
  const nodes = new vis.DataSet(data.nodes.map(node => ({
    ...node,
    label: node.label || 'Node',
    title: JSON.stringify(node.title || {}, null, 2), // Tooltip with node properties
    font: { color: '#ffffff', size: 14 },
    color: {
      background: getNodeColor(node.label),
      border: '#ffffff',
      highlight: { background: '#ffa726', border: '#ff9800' }
    }
  })));
  
  const edges = new vis.DataSet((data.edges || data.relationships || []).map(edge => ({
    ...edge,
    label: edge.label || edge.type || '',
    title: JSON.stringify(edge.title || {}, null, 2), // Tooltip with edge properties
    color: { color: '#b0bec5', highlight: '#4ecdc4' },
    arrows: { to: { enabled: true, scaleFactor: 1.2 } },
    font: { color: '#ffffff', size: 12, strokeWidth: 2, strokeColor: '#000000' }
  })));

  const options = {
    nodes: {
      shape: 'dot',
      size: 25,
      borderWidth: 2,
      shadow: true
    },
    edges: {
      width: 2,
      shadow: true,
      smooth: { type: 'continuous' }
    },
    layout: {
      improvedLayout: true,
      clusterThreshold: 150
    },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.01,
        springLength: 100,
        springConstant: 0.08
      },
      maxVelocity: 50,
      minVelocity: 0.1,
      timestep: 0.35,
      stabilization: { iterations: 150 }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      hideEdgesOnDrag: true,
      hideNodesOnDrag: false
    }
  };

  const network = new vis.Network(container, { nodes, edges }, options);
  
  // Add interaction handlers
  network.on("click", function (params) {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      const node = nodes.get(nodeId);
      console.log('Clicked node:', node);
    }
  });

  // Fit the network in the container after stabilization
  network.once("stabilizationIterationsDone", function () {
    network.fit({
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });
  });
}

// Helper function to assign colors based on node type
function getNodeColor(nodeType) {
  const colors = {
    'ValueDeclaration': '#4fc3f7',
    'FunctionDeclaration': '#66bb6a',
    'CallExpression': '#ff8a65',
    'BinaryOperator': '#ba68c8',
    'VariableDeclaration': '#29b6f6',
    'Field': '#26c6da',
    'Literal': '#ffab40',
    'MethodDeclaration': '#ab47bc',
    'Block': '#8d6e63',
    'IfStatement': '#ff7043',
    'ForStatement': '#7986cb',
    'WhileStatement': '#42a5f5'
  };
  return colors[nodeType] || '#78909c'; // Default gray for unknown types
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