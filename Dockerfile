FROM oven/bun:1

WORKDIR /app

# Install pnpm using bun (no npm needed)
RUN bun install -g pnpm

COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV ELIZAOS_TELEMETRY_DISABLED=true

CMD ["bun", "run", "start"]