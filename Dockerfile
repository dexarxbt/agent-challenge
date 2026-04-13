FROM node:22-slim

WORKDIR /app

# Install bun globally (very fast, <10mb) because elizaos internally relies on it
# Doing it this way skips the 4000+ second apt-get install freeze!
RUN npm install -g bun

# Copy package info only
COPY package.json ./

# NPM is specifically much more resilient to network drops/packet loss than Bun.
# This prevents the "Integrity check failed for tarball" error entirely.
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy rest of source
COPY . .

# Fix PGlite/SQLite DB permissions locally
RUN mkdir -p /app/.eliza/.elizadb && chmod -R 777 /app/.eliza

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV ELIZAOS_TELEMETRY_DISABLED=true

# Launch shell script correctly
CMD ["/bin/sh", "node_modules/.bin/elizaos", "start", "--character", "./characters/solana-whale.agent.json"]