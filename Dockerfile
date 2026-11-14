# ==========================================
# Stage 1: Build Frontend (React + Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy frontend manifest files
COPY frontend/package*.json ./frontend/

# Install frontend dependencies
RUN npm --prefix frontend install

# Copy frontend source code and compile production bundle
COPY frontend/ ./frontend/
RUN npm --prefix frontend run build

# ==========================================
# Stage 2: Production Cloud Server
# ==========================================
FROM node:20-bookworm-slim AS runner

# Install native archive extraction binaries & multimedia decoders
RUN apt-get update && apt-get install -y --no-install-recommends \
    p7zip-full \
    ffmpeg \
    wget \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root manifest and install server production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code
COPY server/ ./server/

# Copy compiled production UI assets from frontend-builder stage
COPY --from=frontend-builder /app/public ./public

# Set production environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    TORRENT_PORT=51413 \
    DHT_PORT=6881 \
    MAX_CONNS=150 \
    MAX_STORAGE_GB=8

# Persistent volumes for downloads and metadata state
VOLUME ["/app/downloads", "/app/data"]

# Expose HTTP web server & BitTorrent P2P swarm ports
EXPOSE 3000
EXPOSE 51413
EXPOSE 51413/udp

# Healthcheck for Railway, Render, and Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

# Start server with V8 420MB heap ceiling (prevents OOM on constrained cloud instances)
CMD ["node", "--max-old-space-size=420", "server/index.js"]
