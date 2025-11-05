# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY app/frontend/package*.json ./
RUN npm install
COPY app/frontend/ .
RUN npm run build

# Stage 2: Build Backend
FROM gradle:8.5-jdk21-alpine AS backend-builder
WORKDIR /home/gradle/src

# Copy only gradle files first for dependency caching
COPY settings.gradle.kts .
COPY app/build.gradle.kts ./app/
COPY gradle ./gradle
COPY gradlew* ./

# Download dependencies (this layer will be cached)
RUN gradle :app:dependencies --no-daemon

# Now copy the rest of the source code
COPY app/src ./app/src

# Copy built frontend from the previous stage
COPY --from=frontend-builder /app/dist ./app/src/main/resources/static

# Build the application
RUN gradle :app:installDist --no-daemon

# Stage 3: Final Image
FROM eclipse-temurin:21-jre

# Install rustc and LLVM development libraries for CPG
RUN apt-get update && \
    apt-get install -y curl build-essential llvm-16 llvm-16-dev && \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.55.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Set Java library path to include LLVM libraries
ENV LD_LIBRARY_PATH="/usr/lib/llvm-16/lib:${LD_LIBRARY_PATH}"

WORKDIR /app
COPY --from=backend-builder /home/gradle/src/app/build/install/app ./
# Create storage directory for projects (will be mounted as volume)
RUN mkdir -p ./storage/projects
EXPOSE 8080
CMD ["./bin/app"]
