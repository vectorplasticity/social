# ─────────────────────────────────────────────────────────
# SocialCrypt Server — Dockerfile
# 
# Build & Run locally:
#   docker build -t socialcrypt .
#   docker run -d -p 3000:3000 -v data:/app/data socialcrypt
#
# Deploy to HuggingFace Spaces:
#   1. Create a Space → Docker SDK
#   2. Push this repo (Dockerfile + server.js)
#   3. Set port to 7860 in Space settings
#   4. Done!
#
# Deploy to Railway / Fly.io / Render:
#   Just connect the GitHub repo → auto-detects Dockerfile
# ─────────────────────────────────────────────────────────

# ── Stage 1: Base ───────────────────────────────────────
FROM node:20-alpine AS base

# Add tini for proper signal handling (SIGTERM → graceful shutdown)
RUN apk add --no-cache tini

WORKDIR /app

# ── Stage 2: Runtime ────────────────────────────────────
FROM base AS release

# Copy only the server script (no npm dependencies — it's pure Node.js stdlib!)
COPY server.js .

# Create the data volume mount point
RUN mkdir -p /app/data

# Use a non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

# Expose the port (default 3000, override with PORT env var)
EXPOSE 3000

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Run the server
CMD ["node", "server.js"]
