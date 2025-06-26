// Global variable to store backend URL
let BACKEND_URL = "http://localhost:8000"; // fallback default

document.getElementById("codeForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const submitButton = e.target.querySelector('button[type="submit"]');
  const resultElement = document.getElementById("result");
  
  submitButton.disabled = true;
  submitButton.textContent = "Processing...";
  resultElement.textContent = "Analyzing code...";
  
  try {
    const formData = new FormData(e.target);
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