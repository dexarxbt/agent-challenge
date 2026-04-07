# SolScout — On-Chain Intelligence Agent

> Track smart money, analyze tokens, and monitor whale movements on Solana — powered by ElizaOS and deployed on Nosana's decentralized GPU network.

## What It Does

SolScout is a personal AI agent that watches the Solana blockchain for you:

- **Wallet Profiling** — Enter any Solana wallet address to get a full breakdown: SOL balance, token holdings, transaction history, and activity patterns
- **Token Intelligence** — Deep token analysis with price data, volume metrics, holder distribution, liquidity assessment, and risk indicators from Birdeye API
- **Smart Money Tracking** — Add wallets to your watchlist. SolScout monitors them 24/7 and generates intelligence briefings when notable transactions occur
- **Whale Detection** — Scans for large transactions and correlates them with historical patterns to identify potentially profitable moves
- **Conversational Interface** — Ask questions in natural language, get synthesized intelligence with specific data points, not just raw numbers

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | ElizaOS v2 |
| LLM | Qwen3.5-27B-AWQ-4bit (60k context) |
| Embeddings | Qwen3-Embedding-0.6B (1024d) |
| Compute | Nosana decentralized GPU network |
| On-Chain Data | Solana JSON-RPC + Helius (optional) |
| Token Analytics | Birdeye API |
| Frontend | Custom dark-mode intelligence dashboard |
| Database | SQLite (embedded) |

## Prerequisites

- Node.js 22+
- pnpm (`npm install -g pnpm`)
- Docker (for Nosana deployment)
- Git
- (Optional) Helius API key for enriched RPC data
- (Optional) Birdeye API key for token analytics

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Nosana endpoint credentials and optional API keys:

```env
OPENAI_API_KEY=nosana
OPENAI_API_URL=https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1
MODEL_NAME=Qwen3.5-27B-AWQ-4bit
```

### 3. Run Locally

```bash
# Development mode
elizaos dev --character ./characters/solana-whale.agent.json

# Or via npm script
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) to access the built-in ElizaOS chat client.

### 4. Open the Dashboard

Open `ui/index.html` in your browser, or serve it:

```bash
npx serve ui -p 3001
```

## Custom Agent Logic

The core plugin is in `src/index.ts` — it defines:

- **5 custom actions**: `SCAN_WALLET`, `ANALYZE_TOKEN`, `TRACK_WALLET`, `SCAN_SMART_MONEY`, `PORTFOLIO_SCAN`
- **1 intelligence provider**: Injects real-time on-chain context into conversations
- **Watchlist persistence**: SQLite-backed storage for tracked wallets

### Adding New Actions

Add a new `{ name, similes, description, validate, handler, examples }` object to the `actions` array in `src/index.ts`, then reference it in the character file if needed.

## Architecture

```
├── characters/
│   └── solana-whale.agent.json   # Agent personality & behavior definition
├── src/
│   └── index.ts                   # Custom plugin: actions + intelligence provider
├── ui/
│   ├── index.html                 # Intelligence dashboard
│   ├── style.css                  # Dark theme with glass-morphism
│   └── app.js                     # Dashboard logic, chat integration, charts
├── nos_job_def/
│   └── nosana_eliza_job_definition.json  # Nosana container deployment config
├── Dockerfile                     # Container configuration
├── .env.example                   # Environment variable template
├── package.json                   # Dependencies
└── tsconfig.json                  # TypeScript configuration
```

## Deploy to Nosana

### Step 1: Build and Push Docker Image

```bash
docker build -t yourusername/solscout:latest .
docker login
docker push yourusername/solscout:latest
```

> Make sure your Docker Hub repository is **public** so Nosana nodes can pull it.

### Step 2: Update Job Definition

Edit `nos_job_def/nosana_eliza_job_definition.json` and replace `yourusername/solscout:latest` with your actual Docker Hub repository and tag.

### Step 3: Deploy

**Via Dashboard** (recommended):

1. Visit [Nosana Dashboard](https://dashboard.nosana.com/deploy)
2. Connect your Solana wallet
3. Paste the contents of `nos_job_def/nosana_eliza_job_definition.json`
4. Select `nvidia-3090` or `nvidia-rtx-4090` market
5. Click Deploy

**Via CLI**:

```bash
nosana job post \
  --file ./nos_job_def/nosana_eliza_job_definition.json \
  --market nvidia-4090 \
  --timeout 300 \
  --api <API_KEY>
```

### Step 4: Verify

Once running, visit the Nosana-provided URL to access the ElizaOS client at port 3000.

## Agent Capabilities

### Wallet Tracking Workflow

1. Enter a wallet address in the dashboard (or tell the agent to track it)
2. Agent profiles the wallet: balance, tokens, recent activity
3. Address is added to persistent watchlist (SQLite)
4. On subsequent queries, agent scans all tracked wallets and synthesizes intelligence briefings
5. Notable movements are highlighted with context — not just raw data, but *analysis*

### Token Analysis Workflow

1. Enter a token mint address
2. Agent queries Birdeye API for price, volume, holder distribution
3. Cross-references holder concentration, whale activity, and liquidity depth
4. Returns a risk assessment with specific data points and actionable context

### Intelligence Provider

The custom `intelligenceProvider` injects real-time Solana context into every relevant conversation — wallet balances, recent transaction counts, watchlist status — so the LLM always responds with current data.

## Security Notes

- Never commit `.env` files — they contain API keys and endpoint URLs
- The SQLite database stores watchlist data locally
- For production, consider mounted volumes or external database
- Birdeye and Helius API keys are optional but recommended for enriched data

## Resources

- [ElizaOS Documentation](https://elizaos.github.io/eliza/docs)
- [Nosana Documentation](https://learn.nosana.com/)
- [Nosana Dashboard](https://dashboard.nosana.com/deploy)
- [Birdeye API](https://docs.birdeye.so/)
- [Helius RPC](https://docs.helius.dev/)
- [Qwen3.5-27B on HuggingFace](https://huggingface.co/Qwen/Qwen3.5-27B)

## License

MIT
