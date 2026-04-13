FROM oven/bun:1

WORKDIR /app

COPY . .

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV PATH="/root/.bun/bin:/usr/local/bin:$PATH"

CMD ["bun", "node_modules/.bin/elizaos", "start", "--character", "./characters/solana-whale.agent.json"]