###############################################################################
# backend/Dockerfile - CORRECT CPG NEO4J CONSOLE
###############################################################################
FROM rust:1.55.0-slim
RUN rustup default nightly-2021-09-09

# ── system deps + Java 21 (KEEP RUST 1.55.0) ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git python3 python3-pip curl build-essential \
        netcat-openbsd wget ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Java 21 from Adoptium (works on Debian Bullseye)
RUN wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/trusted.gpg.d/adoptium.gpg && \
    echo "deb https://packages.adoptium.net/artifactory/deb bullseye main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y temurin-21-jdk && \
    rm -rf /var/lib/apt/lists/*

# Verify Java 21 installation
RUN java -version

# ── Use the updated CPG version ─────────────────────────────
WORKDIR /opt
RUN git clone https://github.com/Fraunhofer-AISEC/cpg.git
WORKDIR /opt/cpg
RUN git checkout a75a17562139ddf774b446dc584ce385cec55e4a

# --- Kotlin patch for cpg-neo4j (correct module) -------
RUN cat >> cpg-neo4j/build.gradle.kts <<'EOF'

/* --- pin Kotlin stdlib versions (Docker patch) --- */
configurations.all {
    resolutionStrategy.force(
        "org.jetbrains.kotlin:kotlin-stdlib:2.0.20",
        "org.jetbrains.kotlin:kotlin-stdlib-common:2.0.20",
        "org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.20",
        "org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.20"
    )
}
EOF

# Create gradle.properties with LLVM enabled and optimized memory settings
RUN cat > gradle.properties <<'EOF'
org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dkotlin.daemon.jvm.options=-Xmx2g
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.caching=true
systemProp.sonar.gradle.skipCompile=true
enableJavaFrontend=false
enableCXXFrontend=false
enableGoFrontend=false
enablePythonFrontend=false
enableLLVMFrontend=true
enableTypeScriptFrontend=false
enableRubyFrontend=false
enableJVMFrontend=false
enableINIFrontend=false
EOF

# builds cpg-neo4j with LLVM frontend (this is the correct console)
# Clean build cache and limit parallel workers to avoid memory issues
RUN ./gradlew clean && \
    ./gradlew :cpg-neo4j:installDist -x test --max-workers=2 && \
    ./gradlew clean

# Verify LLVM frontend is built
RUN find /opt/cpg -name "*llvm*" -type f | head -5 || echo "LLVM files check"

# ── Python FastAPI app ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# copy pipeline script (LVing.sh) and API handler
COPY LVing.sh handler.py ConnectionCypher.py AnnotationMacro.rs ./

RUN chmod +x LVing.sh

# exports cpg-neo4j console in PATH (correct path)
ENV PATH="/opt/cpg/cpg-neo4j/build/install/cpg-neo4j/bin:${PATH}"
ENV RUST_BACKTRACE=1
ENV NEO4J_URI=bolt://neo4j:7687

CMD ["uvicorn", "handler:app", "--host", "0.0.0.0", "--port", "8000"]
