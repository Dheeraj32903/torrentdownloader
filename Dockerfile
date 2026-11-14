# ==========================================
# Stage 1: Build Modern React Frontend
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root & frontend package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install frontend dependencies
RUN npm --prefix frontend install

# Copy frontend source code and compile production bundle
COPY frontend/ ./frontend/
RUN npm --prefix frontend run build

# ==========================================
# Stage 2: Production Cloud Server
# ==========================================
FROM node:22-alpine

# Install native archive extraction binaries & multimedia decoders
RUN apk add --no-cache 7zip ffmpeg libarchive-tools unrar wget

WORKDIR /app

# Install server production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy server application files
COPY server/ ./server/

# Copy compiled production UI assets from builder stage
COPY --from=builder /app/public ./public

# Set default cloud production environment
ENV NODE_ENV=production \
    PORT=3000 \
    TORRENT_PORT=51413 \
    DHT_PORT=6881 \
    MAX_CONNS=150 \
    MAX_STORAGE_GB=15

# Persistent volumes for downloads and metadata state
VOLUME ["/app/downloads", "/app/data"]

# Expose HTTP web server & BitTorrent P2P / DHT swarm ports
EXPOSE 3000
EXPOSE 51413/tcp
EXPOSE 51413/udp
EXPOSE 6881/udp

# Cloud container healthcheck (keeps Render / Railway instance alive)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/healthz || exit 1

# Start server with V8 420MB heap ceiling (optimizes RAM for 512MB free tier containers)
CMD ["node", "--max-old-space-size=420", "server/index.js"]
