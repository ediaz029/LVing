###############################################################################
# backend/Dockerfile
###############################################################################
FROM rust:1.55.0-slim

# ── system deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        git openjdk-17-jdk python3 python3-pip curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── clone & build Fraunhofer CPG (pinned commit) ─────────────────────────────
ARG CPG_COMMIT=4b8042a25675462d2eb852c686b1d96418785283
WORKDIR /opt
RUN git clone https://github.com/Fraunhofer-AISEC/cpg.git
WORKDIR /opt/cpg
RUN git checkout ${CPG_COMMIT}

# Kotlin stdlib override (2.0.20) – one-liner
RUN sed -i '/plugins {/a\configurations.all {\n    resolutionStrategy.force("org.jetbrains.kotlin:kotlin-stdlib:2.0.20","org.jetbrains.kotlin:kotlin-stdlib-common:2.0.20","org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.20","org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.20")\n}' \
    cpg-console/build.gradle.kts

# Build console only, skip tests
RUN ./gradlew :cpg-console:installDist -x test

# Enable **all** frontends (feeds 'y' to every prompt)
RUN yes | ./configure_frontends.sh

# ── Python FastAPI app ───────────────────────────────────────────────────────
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy pipeline script (RVing.sh) and API handler
COPY RVing.sh handler.py .

RUN chmod +x RVing.sh

# Export console in PATH
ENV PATH="/opt/cpg/cpg-console/build/install/cpg-console/bin:${PATH}"
ENV RUST_BACKTRACE=1
ENV NEO4J_URI=bolt://neo4j:7687

CMD ["uvicorn", "handler:app", "--host", "0.0.0.0", "--port", "8000"]
