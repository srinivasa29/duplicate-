# ─────────────────────────────────────────────────────────────────
# Stage 1: Builder — install ALL deps (including devDependencies)
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package*.json ./

# Install all deps (need devDependencies for any build steps)
RUN npm ci --prefer-offline

# Copy source
COPY . .

# ─────────────────────────────────────────────────────────────────
# Stage 2: Runner — lean production image
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S radar && adduser -S radar -G radar

WORKDIR /app

# Copy manifests and install ONLY production deps
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Copy source from builder
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts

# Create logs directory owned by radar user
RUN mkdir -p logs && chown -R radar:radar /app

USER radar

# Expose application port
EXPOSE 5000

# Health check — calls the root endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Start the server
CMD ["node", "server.js"]
