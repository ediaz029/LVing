document.getElementById("codeForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const submitButton = e.target.querySelector('button[type="submit"]');
  const resultElement = document.getElementById("result");
  
  // Update UI
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";
  resultElement.textContent = "Analyzing code...";
  
  try {
    const formData = new FormData(e.target);
    const res = await fetch("http://localhost:8000/convert/", {
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
    // Reset UI
    submitButton.disabled = false;
    submitButton.textContent = "Convert & Export to Neo4j";
  }
};

// Simple health check on page load
window.addEventListener('load', async () => {
  try {
    const response = await fetch("http://localhost:8000/");
    if (response.ok) {
      console.log("[SUCCESS] Backend connected");
    }
  } catch (error) {
    console.warn("[WARNING] Backend not accessible:", error.message);
  }
});