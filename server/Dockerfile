# ─────────────────────────────────────────────────────────
# SocialCrypt Server — Dockerfile
# Works on HuggingFace Spaces, Railway, Fly.io, etc.
# ─────────────────────────────────────────────────────────

FROM node:20-alpine

WORKDIR /app

# Copy the unified server (detects /data vs ./data automatically)
COPY server.js .

# Persistent storage support (HuggingFace Spaces mounts /data)
RUN mkdir -p /data && chmod 777 /data

EXPOSE 7860

CMD ["node", "server.js"]
