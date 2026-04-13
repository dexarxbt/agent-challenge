FROM node:23-alpine AS base

# Install bash only
RUN apk add --no-cache bash

# Install bun via npm (no GitHub download needed)
RUN npm install -g bun

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

WORKDIR /app

# Copy everything including your local node_modules
COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000

CMD ["pnpm", "start"]