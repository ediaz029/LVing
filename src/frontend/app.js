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
  unsafecell: `use std::sync::Arc;
use std::thread;
use std::cell::UnsafeCell;

struct SharedData {
    value: UnsafeCell<i32>,
}

unsafe impl Send for SharedData {}
unsafe impl Sync for SharedData {}

fn main() {
    let data = Arc::new(SharedData {
        value: UnsafeCell::new(42),
    });

    let handles: Vec<_> = (0..2)
        .map(|_| {
            let data = Arc::clone(&data);
            thread::spawn(move || {
                unsafe {
                    // directly modify the value inside UnsafeCell
                    let value_ptr = data.value.get();
                    *value_ptr += 1; // modify the value concurrently -> data race
                    println!("Value modified in thread: {}", *value_ptr);
                }
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }
}`,
  buffer_overflow: `#![allow(unused)]
use std::fmt::Debug;

// Unsafe pointer arithmetic leading to buffer overflow
unsafe fn get_by_index<T>(slice: &[T], index: isize) -> *const T {
    slice.as_ptr().offset(index)
}

fn merge<T: Debug, F>(list: &mut [T], start: usize, mid: usize, end: usize, compare: &F) 
where 
    F: Fn(&T, &T) -> bool, 
{ 
    let mut left = Vec::with_capacity(mid - start + 1); 
    let mut right = Vec::with_capacity(end - mid); 
    unsafe { 
        let mut start = start; 
        while start <= mid { 
            left.push(get_by_index(list, start as isize).read()); // potential overflow
            start += 1; 
        } 
        while start <= end { 
            right.push(get_by_index(list, start as isize).read()); // potential overflow
            start += 1; 
        } 
    } 
    
    println!("Merge operation with potential buffer overflow completed");
}

fn main() {
    let mut data = vec![3, 1, 4, 1, 5, 9, 2, 6];
    merge(&mut data, 0, 3, 7, &|a, b| a < b);
}`,
  cell_race: `#![forbid(unsafe_code)] // The vulnerability exists despite no unsafe code

// Minimal mocks for missing crates
mod abox {
    use std::sync::{Arc, Mutex};
    pub struct AtomicBox<T>(Arc<Mutex<T>>);
    impl<T: Clone> AtomicBox<T> {
        pub fn new(t: &T) -> Self {
            AtomicBox(Arc::new(Mutex::new(t.clone())))
        }
        pub fn get(&self) -> T {
            let guard = self.0.lock().unwrap();
            (*guard).clone()
        }
    }
}

mod crossbeam_utils {
    pub mod thread {
        pub fn scope<F, R>(f: F) -> R 
        where F: FnOnce(&Scope) -> R {
            f(&Scope)
        }
        pub struct Scope;
        impl Scope {
            pub fn spawn<F, T>(&self, f: F) -> std::thread::JoinHandle<T>
            where F: FnOnce(&Scope) -> T, F: Send + 'static, T: Send + 'static {
                std::thread::spawn(move || f(&Scope))
            }
        }
    }
}

#[derive(Debug, Clone, Copy)]
enum RefOrInt<'a> { Ref(&'a u64), Int(u64) }
static SOME_INT: u64 = 123;

fn main() {
    let cell = std::cell::Cell::new(RefOrInt::Ref(&SOME_INT));
    let atomic_box = abox::AtomicBox::new(&cell);

    crossbeam_utils::thread::scope(|s| {
        s.spawn(move |_| {
            let smuggled_cell = atomic_box.get();
            loop {
                smuggled_cell.set(RefOrInt::Ref(&SOME_INT));
                smuggled_cell.set(RefOrInt::Int(0xdeadbeef)); // race condition
            }
        });
        
        println!("Cell race condition example");
    });
}`,
  uninit_memory: `use std::io::{self, Read, BufRead};
use std::cmp;

struct AccReader<R> {
    source: R,
    buf: Vec<u8>,
    pos: usize,
    inc: usize,
}

impl<R: Read> AccReader<R> {
    fn new(source: R) -> Self {
        AccReader {
            source,
            buf: Vec::new(),
            pos: 0,
            inc: 64,
        }
    }
}

impl<R: Read> BufRead for AccReader<R> { 
    fn fill_buf(&mut self) -> io::Result<&[u8]> { 
        let available = self.buf.len() - self.pos;
        if available == 0 { 
            let old_len = self.buf.len(); 
            self.buf.reserve(self.inc); 
            unsafe { 
                self.buf.set_len(old_len + self.inc); // uninitialized memory exposure
            } 

            let (read, error) = match self.source.read(&mut self.buf[self.pos..]) { 
                Ok(n) => (n, None), 
                Err(e) => (0, Some(e)), 
            }; 
            unsafe { 
                self.buf.set_len(old_len + read); 
            } 

            if let Some(e) = error { 
                Err(e) 
            } else { 
                Ok(&self.buf[self.pos..]) 
            } 
        } else { 
            Ok(&self.buf[self.pos..]) 
        } 
    } 

    fn consume(&mut self, amt: usize) { 
        self.pos = cmp::min(self.pos + amt, self.buf.len()); 
    } 
}

fn main() {
    let data = b"Hello, world!";
    let mut reader = AccReader::new(&data[..]);
    println!("Uninitialized memory access example");
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
MATCH path = (v)-[:DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`;

// Additional example queries for different edge types
const CYPHER_EXAMPLES = {
  all_edges: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG|EOG|AST|REFERS_TO|PDG|USAGE|SCOPE*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  dfg_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:DFG*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  eog_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:EOG*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  ast_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:AST*1..6]-(access)
WHERE (access:BinaryOperator OR access:UnaryOperator)
RETURN path`,
  
  refers_to: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:REFERS_TO*1..3]-(ref)
RETURN path`,
  
  pdg_only: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:PDG*1..6]-(dep)
RETURN path`,
  
  usage_scope: `MATCH (v:ValueDeclaration)
WHERE v.code CONTAINS 'sendable_ptr'
WITH v
MATCH path = (v)-[:USAGE|SCOPE*1..4]-(related)
RETURN path`,
  
  full_context: `MATCH (start)
WHERE start.code CONTAINS 'sendable_ptr'
WITH start
CALL {
  WITH start
  MATCH path1 = (start)-[:DFG*1..4]-(dfg_node)
  RETURN path1
  UNION
  WITH start
  MATCH path2 = (start)-[:EOG*1..3]-(eog_node)
  RETURN path2
  UNION
  WITH start
  MATCH path3 = (start)-[:AST*1..2]-(ast_node)
  RETURN path3
  UNION
  WITH start
  MATCH path4 = (start)-[:REFERS_TO]-(ref_node)
  RETURN path4
}
RETURN path1, path2, path3, path4`
};

let llvm_ir_text;

// Initialize CodeMirror editor
let codeEditor;
let defaultRustBuffer;
let rustBuffer;
let cypherEditor;
let llvmCodeEditor;

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

    // Secondary buffer so we can view code from standard lib without overwriting the current view.
    rustBuffer = CodeMirror.Doc("", "rust");

    // Code examples dropdown functionality
    const codeExamplesDropdown = document.getElementById('codeExamples');
    const codePreview = document.getElementById('codePreview');
    const previewTitle = document.getElementById('previewTitle');
    const previewCode = document.getElementById('previewCode');
    const useCodeBtn = document.getElementById('useCodeBtn');
    
    // Code example titles
    const exampleTitles = {
      datarace: '🧵 Data Race Example (SendablePtr)',
      unsafecell: '⚠️ UnsafeCell Example',
      buffer_overflow: '💥 Buffer Overflow Example (Merge Sort)',
      cell_race: '🔄 Cell Race Condition (RefOrInt)',
      uninit_memory: '🚫 Uninitialized Memory (AccReader)'
    };
    
    if (codeExamplesDropdown) {
      codeExamplesDropdown.addEventListener('change', function() {
        const selectedExample = this.value;
        
        if (selectedExample && EXAMPLES[selectedExample]) {
          // Show preview
          codePreview.style.display = 'block';
          previewTitle.textContent = exampleTitles[selectedExample] || 'Code Example';
          previewCode.textContent = EXAMPLES[selectedExample];
          
          // Store current selection for use button
          useCodeBtn.setAttribute('data-example', selectedExample);
          
          console.log('[DEBUG] Showing code preview for:', selectedExample);
        } else {
          // Hide preview if no selection
          codePreview.style.display = 'none';
        }
      });
    }

    // Use code button functionality
    if (useCodeBtn) {
      useCodeBtn.addEventListener('click', function() {
        const selectedExample = this.getAttribute('data-example');
        if (selectedExample && EXAMPLES[selectedExample]) {
          codeEditor.setValue(EXAMPLES[selectedExample]);
          console.log('[DEBUG] Used code example:', selectedExample);
          
          // Optionally hide preview after using
          codePreview.style.display = 'none';
          codeExamplesDropdown.value = '';
        }
      });
    }

    // LLVM-IR Code Editor:

    // Lightweight regex for llvm syntax (since there isn't one for codemirror)
    // tested (most of it) here: https://regex101.com/r/qV1Kkn/1
    CodeMirror.defineSimpleMode("llvm-ir", {
      start: [
        {regex: /;.*$/, token: "comment"},
        {regex: /!dbg/, token:"def"},
        {regex: /!DI\w*/, token:"def"},
        {regex: /!\d*/, token:"def"},
        {regex: /%[a-zA-Z_][\w.]*/, token: "atom"},
        {regex: /%[\d][\w.]*/, token: "atom"},
        {regex: /@[a-zA-Z_][\w.]*/, token: "def"},
        {regex: /\b(?:define|declare|private|constant|unnamed_addr|personality|nonnull|metadata|nocapture|zext|ugt|trunc|unreachable|undeftarget|distinct|align|to|ret|call|br|phi|load|store|add|mul|sub|icmp|fcmp|label|type|invoke|void|alloca|landingpad|extractvalue|getelementptr|inbounds|insertvalue|resume|hidden|internal|bitcast)\b/, token: "keyword"},
        {regex: /\bi\d+\b/, token: "type"},
        {regex: /\bfloatt?\b/, token: "type"},
        {regex: /\w*:/, token: "property"},
        {regex: /\d+/, token: "number"},
        {regex: /".*?"/, token: "string"},
      ]
    });

    llvmCodeEditor = CodeMirror(document.getElementById("llvmCodeEditor"), {
        value: "",
        mode: "llvm-ir",
        theme: "monokai",
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        readOnly: true,
    })

    // example:
    // llvmCodeEditor.markText({line: 0, ch: 0}, {line: 0, ch: 5}, {className: "styled-background"});

    // Match the Rust code's height.
    llvmCodeEditor.setSize("100%", "500px");

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

    // Query examples dropdown functionality
    const queryExamplesDropdown = document.getElementById('queryExamples');
    if (queryExamplesDropdown) {
      queryExamplesDropdown.addEventListener('change', function() {
        const selectedExample = this.value;
        if (CYPHER_EXAMPLES[selectedExample]) {
          cypherEditor.setValue(CYPHER_EXAMPLES[selectedExample]);
          console.log('[DEBUG] Loaded query example:', selectedExample);
        }
      });
    }

  } catch (error) {
    console.error("Failed to load CodeMirror:", error);
    // Fallback to simple textarea if CodeMirror fails
    const container = document.getElementById("codeEditor");
    container.innerHTML = '<textarea style="width:100%;height:500px;font-family:monospace;padding:10px;border:none;outline:none;" placeholder="// Paste your Rust code here...\n\nfn main() {\n    println!(\"Hello, world!\");\n}"></textarea>';
    
    // Fallback functionality for code examples dropdown
    const codeExamplesDropdown = document.getElementById('codeExamples');
    const codePreview = document.getElementById('codePreview');
    const previewTitle = document.getElementById('previewTitle');
    const previewCode = document.getElementById('previewCode');
    const useCodeBtn = document.getElementById('useCodeBtn');
    
    // Code example titles
    const exampleTitles = {
      datarace: '🧵 Data Race Example (SendablePtr)',
      unsafecell: '⚠️ UnsafeCell Example',
      buffer_overflow: '💥 Buffer Overflow Example (Merge Sort)',
      cell_race: '🔄 Cell Race Condition (RefOrInt)',
      uninit_memory: '🚫 Uninitialized Memory (AccReader)'
    };
    
    if (codeExamplesDropdown) {
      codeExamplesDropdown.addEventListener('change', function() {
        const selectedExample = this.value;
        
        if (selectedExample && EXAMPLES[selectedExample]) {
          // Show preview
          codePreview.style.display = 'block';
          previewTitle.textContent = exampleTitles[selectedExample] || 'Code Example';
          previewCode.textContent = EXAMPLES[selectedExample];
          
          // Store current selection for use button
          useCodeBtn.setAttribute('data-example', selectedExample);
        } else {
          // Hide preview if no selection
          codePreview.style.display = 'none';
        }
      });
    }
    
    // Use code button functionality for fallback
    if (useCodeBtn) {
      useCodeBtn.addEventListener('click', function() {
        const selectedExample = this.getAttribute('data-example');
        const textarea = container.querySelector('textarea');
        if (selectedExample && EXAMPLES[selectedExample] && textarea) {
          textarea.value = EXAMPLES[selectedExample];
          
          // Optionally hide preview after using
          codePreview.style.display = 'none';
          codeExamplesDropdown.value = '';
        }
      });
    }
  }
});

document.getElementById("codeForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const submitButton = document.querySelector("#codeFormButton");
  const resultElement = document.getElementById("result");
  
  console.log('[DEBUG] Starting code conversion');
  
  // Get code from the editor
  let code;
  if (codeEditor && codeEditor.getValue) {
    code = codeEditor.getValue();
  } else {
    // Fallback for simple textarea
    const textarea = document.querySelector('#codeEditor textarea');
    code = textarea ? textarea.value : '';
  }
  
  console.log('[DEBUG] Code length:', code.length);
  console.log('[DEBUG] Backend URL:', BACKEND_URL);
  
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";
  resultElement.textContent = "Analyzing code...";
  
  try {
    const formData = new FormData();
    formData.append("code", code);
    
    console.log('[DEBUG] Sending request to:', `${BACKEND_URL}/convert/`);
    
    const res = await fetch(`${BACKEND_URL}/convert/`, {
      method: "POST", 
      body: formData
    });
    
    console.log('[DEBUG] Convert response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.log('[DEBUG] Convert error response:', errorText);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    console.log(res.headers)

    const content_type = res.headers.get("content-type")

    // We'll still accept a pure json response:
    // though this usually just means an error so we don't process a stream.
    const boundary_match = content_type.match(/boundary=(.*)$/);
    let json = null;
    if (boundary_match) {
        const boundary = boundary_match[1];

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (value) buffer += decoder.decode(value, { stream: true });
            done = streamDone;
        }

        const parts = buffer.split(`--${boundary}`).filter(p => p.trim() && p.trim() !== "--");

        let irText = null;

        // There's two types to handle here: JSON and plain text.
        // The plain text is our IR stream. The res is our response_data.
        // There will ALWAYS be a res. irText is only available if it was successful.
        for (const part of parts) {
          const [rawHeaders, body] = part.split("\r\n\r\n");
          if (rawHeaders.includes("application/json")) {
            json = JSON.parse(body.trim());
          } else if (rawHeaders.includes("text/plain")) {
            llvm_ir_text = body.trim();
          }
        }

        // Set value of code editor:
        llvmCodeEditor.setValue(llvm_ir_text);
        parseLLVMText(llvm_ir_text);

        // For actual line -> line matches, we need to convert llvm_ir_text to an array.
        llvm_ir_text = llvm_ir_text.split("\n");

        // ..and then actually strip it
        llvm_ir_text = llvm_ir_text.map((line) => line.trim());

    } else {
        json = await res.json();
    }
    
    console.log('[DEBUG] Convert response data:', json);
    
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
    console.log('[DEBUG] Results displayed successfully');
    
  } catch (error) {
    console.error('[DEBUG] Convert error occurred:', error);
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
    await removeCodeHighlights();
    await removeManagedHighlights();

    const query = cypherEditor.getValue();
    const graphDiv = document.getElementById('graphResult');
    
    console.log('[DEBUG] Starting Cypher query execution');
    console.log('[DEBUG] Query:', query);
    console.log('[DEBUG] Endpoint:', getCypherEndpoint());
    
    graphDiv.innerHTML = '<div style="color:#fff;padding:1rem;">Running query...</div>';
    
    try {
      const res = await fetch(getCypherEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      console.log('[DEBUG] Response status:', res.status);
      console.log('[DEBUG] Response ok:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log('[DEBUG] Error response:', errorText);
        throw new Error(`Query failed: ${res.status} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log('[DEBUG] Response data:', data);
      console.log('[DEBUG] Nodes count:', data.nodes ? data.nodes.length : 'undefined');
      console.log('[DEBUG] Edges count:', data.edges ? data.edges.length : 'undefined');
      
      if (!data.nodes && !data.edges) {
        throw new Error('No data returned from query');
      }
      
      if (data.nodes && data.nodes.length === 0 && data.edges && data.edges.length === 0) {
        graphDiv.innerHTML = '<div style="color:#ffa500;padding:1rem;">Query executed successfully but returned no results. Try a different query or check if data exists in Neo4j.</div>';
        return;
      }
      
      renderGraph(data, graphDiv);
      console.log('[DEBUG] Graph rendered successfully');
      
    } catch (e) {
      console.error('[DEBUG] Error occurred:', e);
      graphDiv.innerHTML = `<div style='color:#f66;padding:1rem;'>Error: ${e.message}</div>`;
    }
  });
}

// Render Neo4j result as a graph using vis-network
function renderGraph(data, container) {
  // Clear previous graph
  container.innerHTML = '';
  
  // Show graph controls
  const graphControls = document.getElementById('graphControls');
  if (graphControls) {
    graphControls.style.display = 'block';
  }
  
  // Store original data for filtering
  window.originalGraphData = {
    nodes: data.nodes || [],
    edges: data.edges || data.relationships || []
  };
  
  // Initial render with all data
  updateGraphDisplay(window.originalGraphData, container);
  
  // Setup filtering event listeners
  setupGraphFilters();
}

function stripWhitespace(str) {
  return str.replace(/\s+/g, " ").trim();
}

function findMultilineInstruction(code) {
    /// Attempts to match the (assumed) multi-lined code
    /// with proper indices from the llvm_ir_text array.
    /// Returns null if not found or [low, high].
    const stripped_code = stripWhitespace(code);
    const token = stripped_code.split(" ")[0];

    for (let i = 0; i < llvm_ir_text.length; i++) {
        if (!llvm_ir_text[i].includes(token)) continue;
        let combined = "";
        for (let j = i; j < llvm_ir_text.length; j++) {
            combined += " " + llvm_ir_text[j];
            if (stripWhitespace(combined).includes(stripped_code)) {
                return [i, j];
            }
            if (combined.length > stripped_code.length * 3) break;
        }
    }
    return null;
}


let titlePattern = new RegExp(/^(\w+):\s*(.*(?:\n\s+.*)*)$/, "gm");
let text_markers = null; // [rustMarker, llvmMarker]

/*
* Primary function to highlight code from the given Neo4j node data.
*
* Returns an array of the CodeMirror's marker [rustMarker, llvmMarker] WHEN onSelect=true
*   otherwise, global text_markers is set.
*/
async function highlightCorrespondingCode(node, onSelect=false) {
    // node["title"] (misnomer of the details of a node) is actually a string.
    // The only thing I am wanting from it is the "code:"'s value.
    const details = node["title"].matchAll(titlePattern);
    let llvm_line_text = ""; // NOTE: This is from the Neo4j node's "code" property.
    let found_code = false;

    for (const match of details) {
        // 3 capture groups: Full line, key, value.
        if (match[1] == "code") {
            found_code = true;
            llvm_line_text = match[2];
        }
    }

    // Though, not all nodes will have associated code.
    if (!found_code) {
        return;
    }

    // console.log(llvm_line_text);

    // HACKFIX: So it turns out that CPG->Neo4j is renumbering SOME metadata's id (!dbg !<...>) without actually telling us anything.
    // This is why directly doing .indexOf will fail here. In the future we could pry open the CPG to see why it's doing that.
    // Until then, I try to match a line in the IR code using the ENTIRE Neo4j node's code property. 
    // If that doesn't work, then it matches the line without the "!dbg !<...>".
    // and if THAT doesn't work, we can't show much here and we'll ignore a highlight.
    // however, if this DOES work, the !dbg !<...> will follow the IR's version and not what went into the db.
    let line_number = llvm_ir_text.indexOf(llvm_line_text);
    let lineRange = [0, 0];

    // Attempting match without !dbg !<...>.
    if (line_number < 0) {
        llvm_line_text = llvm_line_text.split("!dbg")[0];
        // console.log("attempting split ir code.");

        // Before checking a span, check if this is just a !dbg mismatch.
        line_number = llvm_ir_text.findIndex(str => str.includes(llvm_line_text));

        // Before resolving the metadata and doing the Rust highlight, llvm_line_text becomes
        // the line from the IR instead of what Neo4j told us.
        if (line_number >= 0) {
            // console.log("highlightCorrespondingCode: Using positive IR line:");
            // console.log("\tOld: ", llvm_line_text);
            llvm_line_text = llvm_ir_text[line_number];
            // console.log("\tNew: ", llvm_line_text);
        }

        // console.log(llvm_ir_text);
        // console.log(llvm_line_text);
        // console.log(line_number);
    }

    // It's ALSO possible that the code may span multiple lines which is what we also try to find here.
    // This is our last resort (though, in a perfect world, that dbg issue is gone and my life is easier)
    if (line_number < 0) {
        lineRange = findMultilineInstruction(llvm_line_text);
        // console.log("lineRange if multiline");
    } else {
        // We did end up finding our line number. To keep things consistent, everything is reduced down to just "lineRange".
        lineRange = [line_number-1, line_number];
    }

    // Nothing found. No highlight.
    if (!lineRange) return;

    // Rust Highlight:
    let rust_marker = await resolveRustHighlight(llvm_line_text);

    // LLVM Highlight:
    let llvm_marker = llvmCodeEditor.markText({line: lineRange[0]}, {line: lineRange[1]}, {className: "styled-background"});
    llvmCodeEditor.scrollIntoView({line: lineRange[0]}, 100);

    // If this was from a node selection (and not a hover), we'll return the marker.
    if (onSelect) return [rust_marker, llvm_marker];

    // Otherwise, it's moved onto text_markers.
    text_markers = [rust_marker, llvm_marker];
}

async function removeCodeHighlights() {
    if (!text_markers) return;
    for (marker of text_markers) {
        if (marker) marker.clear();
    }
    text_markers = null;

    // Go back to the default Rust code:
    if (defaultRustBuffer) {
        codeEditor.swapDoc(defaultRustBuffer);
    }
}

async function removeManagedHighlights() {
    for (const [key, value] of node2Highlights.entries()) {
        const highlights = await value;
        highlights.forEach(h => { if(h) h.clear(); });
    }
    node2Highlights = new Map()
}

async function removeSingleManagedHighlight(objectId) {
    const highlight_arr = await node2Highlights.get(objectId);
    if (!highlight_arr) return;
    highlight_arr.forEach(marker => { if(marker) marker.clear()});
    node2Highlights.delete(objectId);
}

// Global variables for graph filtering
let currentNetwork = null;
let node2Highlights = new Map();
let allNodes = null;
let allEdges = null;

function updateGraphDisplay(data, container) {
  // Clear previous graph
  container.innerHTML = '';
  
  // Enhance nodes with better tooltips
  const enhancedNodes = (data.nodes || []).map(node => {
    // Create a rich tooltip from node properties
    let tooltipText = `Node: ${node.label}\nID: ${node.id}`;
    
    if (node.title && typeof node.title === 'object') {
      // Add key properties to tooltip
      Object.entries(node.title).forEach(([key, value]) => {
        if (key !== 'id' && value !== null && value !== undefined) {
          tooltipText += `\n${key}: ${value}`;
        }
      });
    }
    
    console.log('[DEBUG] Creating node with tooltip:', tooltipText);
    
    return {
      ...node,
      title: tooltipText,  // This creates the tooltip
      font: { color: '#fff', size: 12 },
      shape: getNodeShape(node),
      color: getNodeColor(node),
      size: 25
    };
  });
  
  // Enhance edges with tooltips and styling based on edge type
  const enhancedEdges = (data.edges || data.relationships || []).map(edge => {
    let tooltipText = `Relationship: ${edge.label}\nFrom: ${edge.from} → To: ${edge.to}`;
    
    if (edge.title && typeof edge.title === 'object') {
      Object.entries(edge.title).forEach(([key, value]) => {
        if (key !== 'id' && value !== null && value !== undefined) {
          tooltipText += `\n${key}: ${value}`;
        }
      });
    }
    
    // Get edge styling based on relationship type
    const edgeStyle = getEdgeStyle(edge);
    
    return {
      ...edge,
      title: tooltipText,
      ...edgeStyle
    };
  });
  
  allNodes = new vis.DataSet(enhancedNodes);
  allEdges = new vis.DataSet(enhancedEdges);
  
  currentNetwork = new vis.Network(
    container,
    { nodes: allNodes, edges: allEdges },
    {
      nodes: { 
        shape: 'dot', 
        size: 25, 
        font: { color: '#fff', size: 12 },
        borderWidth: 2,
        shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5 },
        chosen: true
      },
      edges: { 
        color: { color: '#fff' }, 
        arrows: 'to', 
        font: { color: '#fff', size: 10 },
        width: 2,
        smooth: { type: 'continuous' },
        chosen: true
      },
      layout: { improvedLayout: true },
      physics: { enabled: true, stabilization: { iterations: 100 } },
      interaction: {
        hover: true,
        tooltipDelay: 300,
        hideEdgesOnDrag: false,
        selectConnectedEdges: false,
        zoomView: true,
        dragView: true
      },
      configure: {
        enabled: false
      }
    }
  );

  // Add debugging for tooltip events
  currentNetwork.on("hoverNode", function (params) {
    console.log('[DEBUG] Hovering over node:', params.node);
    const nodeData = allNodes.get(params.node);
    console.log('[DEBUG] Node data:', nodeData);
    console.log('[DEBUG] Node title (tooltip):', nodeData.title);
    
    // Create custom tooltip
    showCustomTooltip(params.event, nodeData.title);

    highlightCorrespondingCode(nodeData);
  });

  currentNetwork.on("hoverEdge", function (params) {
    console.log('[DEBUG] Hovering over edge:', params.edge);
    const edgeData = allEdges.get(params.edge);
    console.log('[DEBUG] Edge data:', edgeData);
    console.log('[DEBUG] Edge title (tooltip):', edgeData.title);
    
    // Create custom tooltip
    showCustomTooltip(params.event, edgeData.title);
  });

  currentNetwork.on("blurNode", function (params) {
    hideCustomTooltip();
  });

  currentNetwork.on("blurEdge", function (params) {
    hideCustomTooltip();
  });

  // Add context menu for node expansion/removal
  currentNetwork.on("oncontext", function (params) {
    params.event.preventDefault();
    if (params.nodes.length > 0) {
      showNodeContextMenu(params.event, params.nodes[0]);
    } else {
      hideNodeContextMenu();
    }
  });

  // Hide context menu on canvas click
  currentNetwork.on("click", function (params) {
    hideNodeContextMenu();
  });

  currentNetwork.on("selectNode", async function (params) {
    // Associate the node with the highlighted code. We'll clear the hover and use our own.
    await removeCodeHighlights();
    params.nodes.forEach(object => {
        const node = allNodes.get(object);
        let highlightedCodeMarkers = highlightCorrespondingCode(node, true);
        if (highlightedCodeMarkers) {
            node2Highlights.set(node.id, highlightedCodeMarkers);
        }
    });
  });

  currentNetwork.on("deselectNode", async function (params) {
    params.previousSelection.nodes.forEach(object => {
        removeSingleManagedHighlight(object.id);
    })
  });

  console.log('[DEBUG] Network created with', enhancedNodes.length, 'nodes and', enhancedEdges.length, 'edges');
  
  // Update filter results counter
  updateFilterResults(enhancedNodes.length, window.originalGraphData.nodes.length);
}

// Custom tooltip functions
function showCustomTooltip(event, text) {
  hideCustomTooltip(); // Remove any existing tooltip
  
  const tooltip = document.createElement('div');
  tooltip.id = 'custom-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    white-space: pre-line;
    z-index: 1000;
    pointer-events: none;
    max-width: 300px;
    border: 1px solid #444;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  
  tooltip.textContent = text;
  document.body.appendChild(tooltip);
  
  // Get mouse position from different possible event properties
  let x = 0, y = 0;
  
  if (event.pointer && event.pointer.DOM) {
    x = event.pointer.DOM.x + 10;
    y = event.pointer.DOM.y - 10;
  } else if (event.event && event.event.clientX) {
    x = event.event.clientX + 10;
    y = event.event.clientY - 10;
  } else if (event.clientX !== undefined) {
    x = event.clientX + 10;
    y = event.clientY - 10;
  } else {
    // Fallback: position tooltip in center of the graph container
    const graphContainer = document.getElementById('graphResult');
    if (graphContainer) {
      const rect = graphContainer.getBoundingClientRect();
      x = rect.left + 50;
      y = rect.top + 50;
    } else {
      x = 100;
      y = 100;
    }
  }
  
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  
  console.log('[DEBUG] Custom tooltip created at', x, y, 'with text:', text);
  console.log('[DEBUG] Event object:', event);
}

async function hideCustomTooltip() {
  if (text_markers) {
    await removeCodeHighlights();

    // We're also going to move our focus back to on what's highlighted (if any nodes are selected).
    const iterator = node2Highlights.values();
    let markers = await iterator.next().value;

    // Refocus the editor on the selected markers:
    if (markers) {
        if (markers[0]) codeEditor.scrollIntoView({line: markers[0].lines[1].lineNo()}, 100);
        if (markers[1]) llvmCodeEditor.scrollIntoView({line: markers[1].lines[1].lineNo()}, 100);
    }
  }

  const existing = document.getElementById('custom-tooltip');
  if (existing) {
    existing.remove();
    console.log('[DEBUG] Custom tooltip removed');
  }
}

// Graph filtering functions
function setupGraphFilters() {
  const searchInput = document.getElementById('nodeSearch');
  const clearButton = document.getElementById('clearFilters');
  const filterCheckboxes = document.querySelectorAll('#graphControls input[type="checkbox"]');
  
  // Search input with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyGraphFilters();
      }, 300);
    });
  }
  
  // Filter checkboxes
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', applyGraphFilters);
  });
  
  // Clear filters button
  if (clearButton) {
    clearButton.addEventListener('click', clearAllFilters);
  }
  
  // Hide context menu on outside click
  document.addEventListener('click', hideNodeContextMenu);
}

// Node Context Menu Functions
function showNodeContextMenu(event, nodeId) {
  hideNodeContextMenu(); // Remove any existing menu
  
  const menu = document.createElement('div');
  menu.id = 'node-context-menu';
  menu.style.cssText = `
    position: absolute;
    background: rgba(40, 40, 40, 0.95);
    color: white;
    border: 1px solid #666;
    border-radius: 6px;
    padding: 8px 0;
    font-size: 13px;
    font-family: sans-serif;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    min-width: 160px;
    backdrop-filter: blur(5px);
  `;
  
  // Get node data for context
  const nodeData = allNodes.get(nodeId);
  const hiddenConnections = getHiddenConnections(nodeId);
  
  // Also check total connections in original data for debugging
  const totalConnections = window.originalGraphData ? 
    window.originalGraphData.edges.filter(edge => edge.from === nodeId || edge.to === nodeId).length : 0;
  
  console.log('[DEBUG] Context menu for node:', nodeId, {
    hiddenConnections: hiddenConnections.count,
    totalConnections,
    nodeData
  });
  
  // Create menu items
  const menuItems = [
    {
      label: `📈 Expand from Database`,
      action: () => expandNode(nodeId),
      enabled: true,  // Always enabled since we query database directly
      debug: `Expanding node ${nodeId} by querying all relationship types from database`
    },
    {
      label: '👁️ Expand All Connected',
      action: () => expandAllConnected(nodeId),
      enabled: true
    },
    { separator: true },
    {
      label: '🗑️ Remove from View',
      action: () => removeNodeFromView(nodeId),
      enabled: true,
      color: '#dc3545'
    },
    {
      label: '🔍 Focus on Node',
      action: () => focusOnNode(nodeId),
      enabled: true
    },
    { separator: true },
    {
      label: `📋 Copy Node ID (${nodeId})`,
      action: () => copyToClipboard(nodeId),
      enabled: true
    },
    {
      label: '🔧 Debug Node Info',
      action: () => showNodeDebugInfo(nodeId),
      enabled: true,
      color: '#17a2b8'
    }
  ];
  
  menuItems.forEach(item => {
    if (item.separator) {
      const separator = document.createElement('div');
      separator.style.cssText = 'height: 1px; background: #666; margin: 4px 8px;';
      menu.appendChild(separator);
    } else {
      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: ${item.enabled ? 'pointer' : 'not-allowed'};
        opacity: ${item.enabled ? '1' : '0.5'};
        transition: background-color 0.2s;
        color: ${item.color || 'white'};
      `;
      
      if (item.enabled) {
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = 'rgba(70, 70, 70, 0.8)';
        });
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = 'transparent';
        });
        menuItem.addEventListener('click', (e) => {
          e.stopPropagation();
          item.action();
          hideNodeContextMenu();
        });
      } else {
        // Add tooltip for disabled items to show why they're disabled
        if (item.debug) {
          menuItem.title = `Disabled: ${item.debug}`;
        }
      }
      
      menuItem.textContent = item.label;
      menu.appendChild(menuItem);
    }
  });
  
  document.body.appendChild(menu);
  
  // Position menu
  const x = event.clientX || event.pageX;
  const y = event.clientY || event.pageY;
  
  // Ensure menu stays within viewport
  const rect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let finalX = x;
  let finalY = y;
  
  if (x + rect.width > viewportWidth) {
    finalX = x - rect.width;
  }
  
  if (y + rect.height > viewportHeight) {
    finalY = y - rect.height;
  }
  
  menu.style.left = finalX + 'px';
  menu.style.top = finalY + 'px';
  
  console.log('[DEBUG] Context menu shown for node:', nodeId, 'at', finalX, finalY);
}

function hideNodeContextMenu() {
  const existing = document.getElementById('node-context-menu');
  if (existing) {
    existing.remove();
  }
}

function getHiddenConnections(nodeId) {
  if (!window.originalGraphData) {
    console.log('[DEBUG] No original graph data available');
    return { count: 0, nodes: [], edges: [] };
  }
  
  // Find all edges connected to this node in original data
  const originalConnectedEdges = window.originalGraphData.edges.filter(edge => 
    edge.from === nodeId || edge.to === nodeId
  );
  
  console.log('[DEBUG] Original connected edges for node', nodeId, ':', originalConnectedEdges.map(e => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: e.label
  })));
  
  // Find currently VISIBLE edges (what's actually shown in the graph)
  const currentlyVisibleEdges = [];
  if (allEdges) {
    const visibleEdgeIds = allEdges.getIds();
    console.log('[DEBUG] All visible edge IDs:', visibleEdgeIds);
    
    visibleEdgeIds.forEach(edgeId => {
      const edge = allEdges.get(edgeId);
      if (edge.from === nodeId || edge.to === nodeId) {
        currentlyVisibleEdges.push(edge);
      }
    });
  } else {
    console.log('[DEBUG] No allEdges dataset available');
  }
  
  console.log('[DEBUG] Currently visible edges for node', nodeId, ':', currentlyVisibleEdges.map(e => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: e.label
  })));
  
  // Calculate hidden connections (edges that exist in original data but not currently visible)
  const hiddenEdges = originalConnectedEdges.filter(originalEdge => 
    !currentlyVisibleEdges.some(visibleEdge => visibleEdge.id === originalEdge.id)
  );
  
  console.log('[DEBUG] Hidden edges for node', nodeId, ':', hiddenEdges.map(e => ({
    id: e.id,
    from: e.from,
    to: e.to,
    label: e.label
  })));
  
  // Get hidden connected nodes
  const hiddenNodeIds = new Set();
  hiddenEdges.forEach(edge => {
    const connectedNodeId = edge.from === nodeId ? edge.to : edge.from;
    hiddenNodeIds.add(connectedNodeId);
  });
  
  const hiddenNodes = window.originalGraphData.nodes.filter(node => 
    hiddenNodeIds.has(node.id)
  );
  
  const result = {
    count: hiddenEdges.length,
    nodes: hiddenNodes,
    edges: hiddenEdges
  };
  
  console.log('[DEBUG] Hidden connections summary for node', nodeId, ':', {
    originalConnectedEdges: originalConnectedEdges.length,
    currentlyVisibleEdges: currentlyVisibleEdges.length,
    hiddenEdges: hiddenEdges.length,
    hiddenNodes: hiddenNodes.length,
    result
  });
  
  return result;
}

function getCurrentFilteredData() {
  // Get currently applied filters and return filtered data
  if (!window.originalGraphData) return { nodes: [], edges: [] };
  
  const searchTerm = document.getElementById('nodeSearch')?.value.toLowerCase() || '';
  const enabledFilters = getEnabledFilters();
  
  const filteredNodes = window.originalGraphData.nodes.filter(node => {
    const matchesSearch = searchTerm === '' || nodeMatchesSearch(node, searchTerm);
    const matchesType = nodeMatchesTypeFilter(node, enabledFilters);
    return matchesSearch && matchesType;
  });
  
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = window.originalGraphData.edges.filter(edge => {
    return filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to);
  });
  
  return { nodes: filteredNodes, edges: filteredEdges };
}

function expandNode(nodeId) {
  console.log('[DEBUG] Attempting to expand node via database query:', nodeId);
  
  // Query the database directly for all connections of this node
  expandNodeFromDatabase(nodeId);
}

async function expandNodeFromDatabase(nodeId) {
  try {
    // Cypher query to get all connections for a specific node
    const expansionQuery = `
      MATCH (start)
      WHERE id(start) = ${nodeId}
      OPTIONAL MATCH path1 = (start)-[r1:DFG]-(connected1)
      OPTIONAL MATCH path2 = (start)-[r2:EOG]-(connected2)
      OPTIONAL MATCH path3 = (start)-[r3:AST]-(connected3)
      OPTIONAL MATCH path4 = (start)-[r4:REFERS_TO]-(connected4)
      OPTIONAL MATCH path5 = (start)-[r5:PDG]-(connected5)
      OPTIONAL MATCH path6 = (start)-[r6:USAGE]-(connected6)
      OPTIONAL MATCH path7 = (start)-[r7:SCOPE]-(connected7)
      WITH start, 
           collect(DISTINCT path1) + collect(DISTINCT path2) + collect(DISTINCT path3) + 
           collect(DISTINCT path4) + collect(DISTINCT path5) + collect(DISTINCT path6) + 
           collect(DISTINCT path7) as allPaths
      UNWIND allPaths as path
      WITH path WHERE path IS NOT NULL
      RETURN path
    `;
    
    console.log('[DEBUG] Expansion query:', expansionQuery);
    
    const res = await fetch(getCypherEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: expansionQuery })
    });
    
    if (!res.ok) {
      throw new Error(`Expansion query failed: ${res.status}`);
    }
    
    const expansionData = await res.json();
    console.log('[DEBUG] Expansion data received:', expansionData);
    
    if (!expansionData.nodes || expansionData.nodes.length === 0) {
      showTemporaryMessage('No additional connections found in database');
      return;
    }
    
    // Get current visible data
    const currentlyVisibleNodes = [];
    const currentlyVisibleEdges = [];
    
    if (allNodes) {
      const visibleNodeIds = allNodes.getIds();
      visibleNodeIds.forEach(id => {
        currentlyVisibleNodes.push(allNodes.get(id));
      });
    }
    
    if (allEdges) {
      const visibleEdgeIds = allEdges.getIds();
      visibleEdgeIds.forEach(id => {
        currentlyVisibleEdges.push(allEdges.get(id));
      });
    }
    
    // Merge new data with existing visible data
    const currentNodeIds = new Set(currentlyVisibleNodes.map(n => n.id));
    const currentEdgeIds = new Set(currentlyVisibleEdges.map(e => e.id));
    
    const newNodes = expansionData.nodes.filter(node => !currentNodeIds.has(node.id));
    const newEdges = (expansionData.edges || expansionData.relationships || [])
      .filter(edge => !currentEdgeIds.has(edge.id));
    
    console.log('[DEBUG] Adding to graph:', { newNodes: newNodes.length, newEdges: newEdges.length });
    
    // Update the graph with merged data
    const mergedData = {
      nodes: [...currentlyVisibleNodes, ...newNodes],
      edges: [...currentlyVisibleEdges, ...newEdges]
    };
    
    // Update the original data store to include the new data
    if (window.originalGraphData) {
      const originalNodeIds = new Set(window.originalGraphData.nodes.map(n => n.id));
      const originalEdgeIds = new Set(window.originalGraphData.edges.map(e => e.id));
      
      const nodesToAdd = newNodes.filter(node => !originalNodeIds.has(node.id));
      const edgesToAdd = newEdges.filter(edge => !originalEdgeIds.has(edge.id));
      
      window.originalGraphData.nodes.push(...nodesToAdd);
      window.originalGraphData.edges.push(...edgesToAdd);
    }
    
    updateGraphDisplay(mergedData, document.getElementById('graphResult'));
    
    showTemporaryMessage(`Expanded node: +${newNodes.length} nodes, +${newEdges.length} edges from database`);
    console.log('[DEBUG] Node expansion completed successfully');
    
  } catch (error) {
    console.error('[DEBUG] Node expansion failed:', error);
    showTemporaryMessage(`Expansion failed: ${error.message}`);
  }
}

function expandAllConnected(nodeId) {
  console.log('[DEBUG] Attempting to expand all connected for node:', nodeId);
  
  // Get all nodes connected to this node through any path length
  const connectedNodes = findAllConnectedNodes(nodeId);
  console.log('[DEBUG] Found connected nodes:', connectedNodes.length);
  
  // Get current visible data (what's actually displayed)
  const currentlyVisibleNodes = [];
  const currentlyVisibleEdges = [];
  
  if (allNodes) {
    const visibleNodeIds = allNodes.getIds();
    visibleNodeIds.forEach(nodeId => {
      currentlyVisibleNodes.push(allNodes.get(nodeId));
    });
  }
  
  if (allEdges) {
    const visibleEdgeIds = allEdges.getIds();
    visibleEdgeIds.forEach(edgeId => {
      currentlyVisibleEdges.push(allEdges.get(edgeId));
    });
  }
  
  // Get all relevant edges for the connected component
  const allConnectedNodeIds = new Set([nodeId, ...connectedNodes.map(n => n.id)]);
  const relevantEdges = window.originalGraphData.edges.filter(edge => 
    allConnectedNodeIds.has(edge.from) && allConnectedNodeIds.has(edge.to)
  );
  
  // Get all connected nodes data
  const allConnectedNodesData = [nodeId, ...connectedNodes.map(n => n.id)]
    .map(id => window.originalGraphData.nodes.find(n => n.id === id))
    .filter(Boolean);
  
  console.log('[DEBUG] Will show connected component:', {
    totalConnectedNodes: allConnectedNodesData.length,
    totalRelevantEdges: relevantEdges.length,
    currentlyVisible: { nodes: currentlyVisibleNodes.length, edges: currentlyVisibleEdges.length }
  });
  
  const expandedData = {
    nodes: allConnectedNodesData,
    edges: relevantEdges
  };
  
  updateGraphDisplay(expandedData, document.getElementById('graphResult'));
  
  showTemporaryMessage(`Expanded all connected: ${allConnectedNodesData.length} nodes, ${relevantEdges.length} edges`);
  console.log('[DEBUG] Expanded all connected for node:', nodeId, 'showing', expandedData.nodes.length, 'nodes');
}

function findAllConnectedNodes(startNodeId) {
  const visited = new Set();
  const connected = [];
  const queue = [startNodeId];
  
  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (visited.has(currentNodeId)) continue;
    
    visited.add(currentNodeId);
    if (currentNodeId !== startNodeId) {
      const node = window.originalGraphData.nodes.find(n => n.id === currentNodeId);
      if (node) connected.push(node);
    }
    
    // Find neighbors
    window.originalGraphData.edges.forEach(edge => {
      if (edge.from === currentNodeId && !visited.has(edge.to)) {
        queue.push(edge.to);
      }
      if (edge.to === currentNodeId && !visited.has(edge.from)) {
        queue.push(edge.from);
      }
    });
  }
  
  return connected;
}

function removeNodeFromView(nodeId) {
  console.log('[DEBUG] Removing node from view:', nodeId);
  
  // Get current visible data (what's actually displayed)
  const currentlyVisibleNodes = [];
  const currentlyVisibleEdges = [];
  
  if (allNodes) {
    const visibleNodeIds = allNodes.getIds();
    visibleNodeIds.forEach(id => {
      if (id !== nodeId) { // Exclude the node we're removing
        currentlyVisibleNodes.push(allNodes.get(id));
      }
    });
  }
  
  if (allEdges) {
    const visibleEdgeIds = allEdges.getIds();
    visibleEdgeIds.forEach(edgeId => {
      const edge = allEdges.get(edgeId);
      if (edge.from !== nodeId && edge.to !== nodeId) { // Exclude edges connected to the removed node
        currentlyVisibleEdges.push(edge);
      }
    });
  }
  
  updateGraphDisplay({ nodes: currentlyVisibleNodes, edges: currentlyVisibleEdges }, document.getElementById('graphResult'));
  
  showTemporaryMessage(`Removed node ${nodeId} from view`);
  console.log('[DEBUG] Removed node from view:', nodeId, 'remaining:', currentlyVisibleNodes.length, 'nodes');
}

function focusOnNode(nodeId) {
  if (currentNetwork) {
    currentNetwork.focus(nodeId, {
      scale: 1.5,
      animation: {
        duration: 1000,
        easingFunction: 'easeInOutQuad'
      }
    });

    // Highlight the node temporarily
    currentNetwork.selectNodes([nodeId]);
    setTimeout(() => {
      currentNetwork.unselectAll();
    }, 2000);
  }
  
  console.log('[DEBUG] Focused on node:', nodeId);
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('[DEBUG] Copied to clipboard:', text);
      showTemporaryMessage('Node ID copied to clipboard!');
    }).catch(err => {
      console.error('[DEBUG] Failed to copy to clipboard:', err);
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showTemporaryMessage('Node ID copied to clipboard!');
  }
}

function showTemporaryMessage(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(40, 40, 40, 0.9);
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 3000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  // Add animation keyframes
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function showNodeDebugInfo(nodeId) {
  const nodeData = allNodes ? allNodes.get(nodeId) : null;
  const originalNode = window.originalGraphData ? 
    window.originalGraphData.nodes.find(n => n.id === nodeId) : null;
  
  const totalConnections = window.originalGraphData ? 
    window.originalGraphData.edges.filter(edge => edge.from === nodeId || edge.to === nodeId) : [];
  
  const visibleConnections = allEdges ? 
    allEdges.getIds().map(id => allEdges.get(id)).filter(edge => edge.from === nodeId || edge.to === nodeId) : [];
  
  const debugInfo = {
    nodeId,
    label: nodeData?.label || 'Unknown',
    originalNodeExists: !!originalNode,
    totalConnectionsInOriginal: totalConnections.length,
    visibleConnections: visibleConnections.length,
    hiddenConnections: totalConnections.length - visibleConnections.length,
    originalDataExists: !!window.originalGraphData,
    visibleNodesCount: allNodes ? allNodes.length : 0,
    visibleEdgesCount: allEdges ? allEdges.length : 0
  };
  
  console.log('[DEBUG] Node Debug Info:', debugInfo);
  console.log('[DEBUG] Total connections:', totalConnections);
  console.log('[DEBUG] Visible connections:', visibleConnections);
  
  const debugMessage = `Node ${nodeId} (${debugInfo.label})\n` +
    `Total connections: ${debugInfo.totalConnectionsInOriginal}\n` +
    `Visible: ${debugInfo.visibleConnections}\n` +
    `Hidden: ${debugInfo.hiddenConnections}\n` +
    `Check console for details`;
  
  showTemporaryMessage(debugMessage);
}

function applyGraphFilters() {
  if (!window.originalGraphData || !allNodes || !allEdges) return;
  
  const searchTerm = document.getElementById('nodeSearch')?.value.toLowerCase() || '';
  const enabledFilters = getEnabledFilters();
  
  // Filter nodes based on search and type filters
  const filteredNodes = window.originalGraphData.nodes.filter(node => {
    // Text search across node properties
    const matchesSearch = searchTerm === '' || nodeMatchesSearch(node, searchTerm);
    
    // Type filter
    const matchesType = nodeMatchesTypeFilter(node, enabledFilters);
    
    return matchesSearch && matchesType;
  });
  
  // Get node IDs for edge filtering
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  
  // Filter edges to only show connections between visible nodes
  const filteredEdges = window.originalGraphData.edges.filter(edge => {
    return filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to);
  });
  
  // Update the graph display
  updateGraphDisplay({ nodes: filteredNodes, edges: filteredEdges }, document.getElementById('graphResult'));
  
  console.log('[DEBUG] Applied filters:', {
    searchTerm,
    enabledFilters,
    originalNodes: window.originalGraphData.nodes.length,
    filteredNodes: filteredNodes.length,
    originalEdges: window.originalGraphData.edges.length,
    filteredEdges: filteredEdges.length
  });
}

function nodeMatchesSearch(node, searchTerm) {
  // Search in node label
  if (node.label && node.label.toLowerCase().includes(searchTerm)) {
    return true;
  }
  
  // Search in node ID
  if (node.id && node.id.toString().toLowerCase().includes(searchTerm)) {
    return true;
  }
  
  // Search in node properties
  if (node.title && typeof node.title === 'object') {
    const propsString = JSON.stringify(node.title).toLowerCase();
    if (propsString.includes(searchTerm)) {
      return true;
    }
  }
  
  return false;
}

function nodeMatchesTypeFilter(node, enabledFilters) {
  const label = node.label?.toLowerCase() || '';
  
  // Check if node matches any enabled filter
  if (enabledFilters.function && (label.includes('function') || label.includes('method'))) {
    return true;
  }
  
  if (enabledFilters.variable && (label.includes('variable') || label.includes('declaration'))) {
    return true;
  }
  
  if (enabledFilters.operator && label.includes('operator')) {
    return true;
  }
  
  if (enabledFilters.literal && label.includes('literal')) {
    return true;
  }
  
  // Check for unsafe operations
  if (enabledFilters.unsafe) {
    let hasUnsafe = false;
    if (node.title && typeof node.title === 'object') {
      const props = JSON.stringify(node.title).toLowerCase();
      hasUnsafe = props.includes('unsafe') || props.includes('*mut') || props.includes('raw') || props.includes('sendable');
    }
    if (hasUnsafe) return true;
  }
  
  // "Other" category for nodes that don't match specific types
  if (enabledFilters.other) {
    const isSpecificType = label.includes('function') || label.includes('method') ||
                          label.includes('variable') || label.includes('declaration') ||
                          label.includes('operator') || label.includes('literal');
    
    if (!isSpecificType) return true;
  }
  
  return false;
}

function getEnabledFilters() {
  return {
    function: document.getElementById('filter-function')?.checked || false,
    variable: document.getElementById('filter-variable')?.checked || false,
    operator: document.getElementById('filter-operator')?.checked || false,
    literal: document.getElementById('filter-literal')?.checked || false,
    unsafe: document.getElementById('filter-unsafe')?.checked || false,
    other: document.getElementById('filter-other')?.checked || false
  };
}

function clearAllFilters() {
  // Clear search input
  const searchInput = document.getElementById('nodeSearch');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Check all filter checkboxes
  const filterCheckboxes = document.querySelectorAll('#graphControls input[type="checkbox"]');
  filterCheckboxes.forEach(checkbox => {
    checkbox.checked = true;
  });
  
  // Reapply filters (which will show everything)
  applyGraphFilters();
  
  console.log('[DEBUG] Cleared all filters');
}

function updateFilterResults(shown, total) {
  const resultsElement = document.getElementById('filterResults');
  if (resultsElement) {
    resultsElement.textContent = `Showing: ${shown}/${total} nodes`;
    
    // Color coding for filter status
    if (shown === total) {
      resultsElement.style.color = '#ccc';
    } else {
      resultsElement.style.color = '#ffc107';
    }
  }
}

// Helper function to determine node shape based on type
function getNodeShape(node) {
  const label = node.label?.toLowerCase() || '';
  if (label.includes('function') || label.includes('method')) return 'box';
  if (label.includes('variable') || label.includes('declaration')) return 'circle';
  if (label.includes('operator')) return 'diamond';
  if (label.includes('literal')) return 'triangle';
  return 'dot';  // default
}

// Helper function to determine node color based on properties
function getNodeColor(node) {
  const label = node.label?.toLowerCase() || '';
  
  // Color by node type
  if (label.includes('function')) return { background: '#28a745', border: '#fff' };
  if (label.includes('variable')) return { background: '#007acc', border: '#fff' };
  if (label.includes('operator')) return { background: '#ffc107', border: '#fff' };
  if (label.includes('literal')) return { background: '#6f42c1', border: '#fff' };
  
  // Check for unsafe or risky properties
  if (node.title && typeof node.title === 'object') {
    const props = JSON.stringify(node.title).toLowerCase();
    if (props.includes('unsafe') || props.includes('*mut') || props.includes('raw')) {
      return { background: '#dc3545', border: '#fff' };  // Red for unsafe
    }
  }
  
  return { background: '#007acc', border: '#fff' };  // Default blue
}

// Helper function to determine edge style based on relationship type
function getEdgeStyle(edge) {
  const label = edge.label?.toUpperCase() || '';
  
  // Define colors and styles for different edge types
  switch (label) {
    case 'DFG':
      return {
        color: { color: '#28a745' },  // Green for data flow
        width: 2,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
    
    case 'EOG':
      return {
        color: { color: '#007acc' },  // Blue for execution order
        width: 3,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1.2 } }
      };
    
    case 'AST':
      return {
        color: { color: '#6f42c1' },  // Purple for AST structure
        width: 1,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } }
      };
    
    case 'REFERS_TO':
      return {
        color: { color: '#ffc107' },  // Yellow for references
        width: 2,
        dashes: [5, 5],  // Dashed line
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
    
    case 'PDG':
      return {
        color: { color: '#e83e8c' },  // Pink for program dependencies
        width: 2,
        dashes: [10, 5],
        arrows: { to: { enabled: true, scaleFactor: 1.1 } }
      };
    
    case 'USAGE':
      return {
        color: { color: '#fd7e14' },  // Orange for usage
        width: 2,
        dashes: [3, 3],
        arrows: { to: { enabled: true, scaleFactor: 0.9 } }
      };
    
    case 'SCOPE':
      return {
        color: { color: '#20c997' },  // Teal for scope
        width: 1,
        dashes: [8, 4],
        arrows: { to: { enabled: true, scaleFactor: 0.8 } }
      };
    
    default:
      return {
        color: { color: '#fff' },     // Default white
        width: 2,
        dashes: false,
        arrows: { to: { enabled: true, scaleFactor: 1 } }
      };
  }
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


/*
*
* Resolving LLVM-IR Metadata
* https://llvm.org/docs/LangRef.html#specialized-metadata-nodes
*
*/

let metadataMap = new Map(); // !000 -> Object { identifier: string, data: {}}
const metadataPattern = new RegExp(/(!\d*) = (?:distinct )?!(\w*)\((.*?)\)$/, "gm");
const metaPropertyPattern = new RegExp(/(\w+): (?:"([^"]*)"|([^,)]*))/, "gm");
const singleDebugPattern = new RegExp(/(!dbg) (!\d*)/, "gm");

function createMetadataObject(key, identifier, matches) {
    let metadata = new Object({
        key: key,
        identifier: identifier,
        data: {},
    });

    // properties is an array of matches (arrays)
    // individual matches are array size 4
    // group 2 is reserved for pure strings.
    for (const match of matches) {
        metadata.data[match[1]] = match[2] ? match[2] : match[3];
    }
    console.log(metadata);
    metadataMap.set(key, metadata);
}

function parseLLVMText(ir_text) {
    const match = ir_text.matchAll(metadataPattern);
    for (const m of match) {
        const line = m[0];
        const key = m[1]; // !000
        const identifier = m[2]; // !DI...

        // We match the line for {x}: {y} patterns.
        const properties = line.matchAll(metaPropertyPattern);
        createMetadataObject(key, identifier, properties.toArray());
    }
}


/*
* Highlights the POTENTIAL equivalent Rust code from the Neo4j code property / LLVM-IR.
* Returns the marker from codeEditor.markText.
*/
async function resolveRustHighlight(instruction) {
    // "parse" instruction -> applicable metadataObject.
    if (!instruction.includes("!dbg")) return;

    const regexMatch = instruction.matchAll(singleDebugPattern);
    if (!regexMatch) return;
    
    const debug_key = regexMatch.toArray()[0][2];

    const metadata = metadataMap.get(debug_key);
    if (!metadata) {
        console.log("metadata key not tracked", debug_key);
        return;
    }

    // Don't really care about anything other than DILocation for now.
    // At least for sync part. More identifier handles would be interesting later on.
    if (!["DILocation", "DILocalVariable"].includes(metadata.identifier)) return;
    // console.log(metadata);

    // DILocalVariable has the file and line number as a property already, so we don't need to go through the scope to get it.
    let fileinfo = null;
    if (metadata.identifier == "DILocalVariable") {
        fileInfo = [resolveDIFile(metadata.data.file), metadata.data.line];
    } else {
        // Get file and line:
        fileInfo = resolveScopeAsFile(metadata);
    }

    console.log("resolveRustHighlight: fileInfo=", fileInfo);

    if (!fileInfo) return;
    const filename = fileInfo[0];
    const lineNum = fileInfo[1];

    // Handle external Rust files:
    // console.log(filename);
    if (filename.startsWith("/rustc/")) {
        const std_code = await fetchStandardLibraryCode(filename);
        if (!std_code) { return; }
        rustBuffer.setValue(std_code);
        defaultRustBuffer = codeEditor.swapDoc(rustBuffer);
    }

    codeEditor.scrollIntoView({line: lineNum}, 100);
    return codeEditor.markText({line: lineNum-2}, {line: lineNum-1}, {className: "styled-background"});
}

/*
* Fetches the given filename straight from the Rust's GitHub to display on 
* the secondary code buffer.
*/
async function fetchStandardLibraryCode(filename) {
    // Split filename by /
    const split = filename.split("rustc/");

    try {
        const response = await fetch("https://raw.githubusercontent.com/rust-lang/rust/" + split[1]);
        if (!response.ok) { return; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (value) buffer += decoder.decode(value, { stream: true });
            done = streamDone;
        }
        return buffer.trim();
    } catch (e) { console.error(e); return; }
}

/*
* Returns associated filename and line number given a metadata object.
* -> [str, int]
*/
function resolveScopeAsFile(metadata) {
    // Expecting a metadata object that has scope.
    const scope = metadata.data.scope;
    if (!scope) {
        console.log("resolveScopeAsFile: no scope");
        return;
    }

    // Scope will always link to a lexical block which will have a file prop.
    const scopeObject = metadataMap.get(scope);
    if (!scopeObject) {
        console.log("resolveScopeAsFile: scope key not tracked", scope);
        return;
    }

    console.log("resolveScopeAsFile: scopeObject=", scopeObject);
    console.log("resolveScopeAsFile: metadata=", metadata);

    const fileKey = scopeObject.data.file;
    const lineNum = metadata.data.line;
    if (!fileKey || !lineNum) {
        console.log("resolveScopeAsFile: filekey or line is null");
        console.log("resolveScopeAsFile: file=", fileKey);
        console.log("resolveScopeAsFile: lineNum", lineNum);
        return;
    }

    return [resolveDIFile(fileKey), lineNum];
}

/*
* Returns the filename as a string given a metadata key to DIFile:
*/
function resolveDIFile(key) {
    // DIFile:
    // filename, directory, checksumkind, checksum.
    const file = metadataMap.get(key);
    if (!file) {
        console.log("resolveDIFile: file key not registered ", file);
        return;
    }
    console.log("resolveDIFile:", file);
    return file.data.filename;
}
