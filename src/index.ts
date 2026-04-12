// @ts-nocheck
import {
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type Provider,
  type ProviderResult,
  type Plugin,
  type Action,
} from "@elizaos/core";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getText(message: Memory): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text ?? "");
  }
  return "";
}

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Solana RPC ──────────────────────────────────────────────────────────────

const RPC = "https://api.mainnet-beta.solana.com";

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: unknown };
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

// ─── Watchlist (in-memory) ───────────────────────────────────────────────────

const watchlist = new Set<string>();

// ─── Action: SCAN_WALLET ─────────────────────────────────────────────────────

const scanWalletAction: Action = {
  name: "SCAN_WALLET",
  similes: ["CHECK_WALLET", "WALLET_INFO", "ANALYZE_WALLET", "PROFILE_WALLET"],
  description: "Scan a Solana wallet address for balance and token holdings",
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = getText(message);
    return /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<boolean> => {
    const text = getText(message);
    const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (!match) {
      await callback({ text: "Could not find a valid Solana address in your message." });
      return false;
    }
    const address = match[0];
    try {
      const balResult = (await rpc("getBalance", [address])) as { value: number };
      const sol = (balResult.value / 1e9).toFixed(4);

      const tokResult = (await rpc("getTokenAccountsByOwner", [
        address,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed" },
      ])) as { value: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmountString: string } } } } } }> };

      const tokens = tokResult.value
        .slice(0, 5)
        .map((t) => {
          const info = t.account.data.parsed.info;
          return `• ${info.mint.slice(0, 8)}… — ${info.tokenAmount.uiAmountString}`;
        })
        .join("\n");

      await callback({
        text: `**Wallet: ${address.slice(0, 8)}…**\n\n💰 SOL Balance: ${sol} SOL\n\n🪙 Top Token Accounts:\n${tokens || "None found"}\n\n_Use TRACK_WALLET to add this to your watchlist._`,
      });
      return true;
    } catch (e) {
      await callback({ text: `Error scanning wallet: ${String(e)}` });
      return false;
    }
  },
  examples: [
    [
      { name: "user", content: { text: "scan wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } },
      { name: "SolScout", content: { text: "Scanning wallet..." } },
    ],
  ],
};

// ─── Action: TRACK_WALLET ────────────────────────────────────────────────────

const trackWalletAction: Action = {
  name: "TRACK_WALLET",
  similes: ["WATCH_WALLET", "ADD_WALLET", "MONITOR_WALLET"],
  description: "Add a Solana wallet to the watchlist for monitoring",
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = getText(message);
    return /track|watch|monitor/i.test(text) && /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<boolean> => {
    const text = getText(message);
    const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (!match) {
      await callback({ text: "No valid Solana address found." });
      return false;
    }
    const address = match[0];
    watchlist.add(address);
    await callback({
      text: `✅ Added **${address.slice(0, 8)}…** to your watchlist.\n\nCurrently tracking ${watchlist.size} wallet(s).`,
    });
    return true;
  },
  examples: [
    [
      { name: "user", content: { text: "track wallet 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } },
      { name: "SolScout", content: { text: "Added to watchlist!" } },
    ],
  ],
};

// ─── Action: SCAN_SMART_MONEY ────────────────────────────────────────────────

const scanSmartMoneyAction: Action = {
  name: "SCAN_SMART_MONEY",
  similes: ["SMART_MONEY", "WHALE_SCAN", "TOP_WALLETS"],
  description: "Show all tracked wallets and their current SOL balances",
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = getText(message);
    return /smart money|whale|watchlist|tracked/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<boolean> => {
    if (watchlist.size === 0) {
      await callback({ text: "Your watchlist is empty. Use TRACK_WALLET to add wallets." });
      return true;
    }
    const lines: string[] = [];
    for (const address of watchlist) {
      try {
        const result = (await rpc("getBalance", [address])) as { value: number };
        const sol = (result.value / 1e9).toFixed(4);
        lines.push(`• ${address.slice(0, 8)}… — ${sol} SOL`);
      } catch {
        lines.push(`• ${address.slice(0, 8)}… — error fetching`);
      }
    }
    await callback({ text: `**Watchlist Intelligence:**\n\n${lines.join("\n")}` });
    return true;
  },
  examples: [
    [
      { name: "user", content: { text: "show me smart money activity" } },
      { name: "SolScout", content: { text: "Here are your tracked wallets..." } },
    ],
  ],
};

// ─── Action: ANALYZE_TOKEN ───────────────────────────────────────────────────

const analyzeTokenAction: Action = {
  name: "ANALYZE_TOKEN",
  similes: ["TOKEN_INFO", "CHECK_TOKEN", "TOKEN_ANALYSIS"],
  description: "Analyze a Solana token by its mint address using Birdeye",
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = getText(message);
    return /token|mint|analyze/i.test(text) && /[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<boolean> => {
    const text = getText(message);
    const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    if (!match) {
      await callback({ text: "No valid token mint address found." });
      return false;
    }
    const mint = match[0];
    const birdeyeKey = runtime.getSetting("BIRDEYE_API_KEY");

    if (!birdeyeKey) {
      await callback({ text: `Token mint: **${mint.slice(0, 8)}…**\n\nNo Birdeye API key configured — cannot fetch price data. Add BIRDEYE_API_KEY to your .env for full token analysis.` });
      return true;
    }

    try {
      const data = (await fetchJSON(
        `https://public-api.birdeye.so/defi/token_overview?address=${mint}`
      )) as { data?: { price?: number; volume24hUSD?: number; holder?: number; liquidity?: number } };

      const d = data.data ?? {};
      await callback({
        text: `**Token Analysis: ${mint.slice(0, 8)}…**\n\n💲 Price: $${d.price?.toFixed(6) ?? "N/A"}\n📊 24h Volume: $${d.volume24hUSD?.toLocaleString() ?? "N/A"}\n👥 Holders: ${d.holder?.toLocaleString() ?? "N/A"}\n💧 Liquidity: $${d.liquidity?.toLocaleString() ?? "N/A"}`,
      });
      return true;
    } catch (e) {
      await callback({ text: `Error fetching token data: ${String(e)}` });
      return false;
    }
  },
  examples: [
    [
      { name: "user", content: { text: "analyze token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" } },
      { name: "SolScout", content: { text: "Analyzing token..." } },
    ],
  ],
};

// ─── Action: PORTFOLIO_SCAN ──────────────────────────────────────────────────

const portfolioScanAction: Action = {
  name: "PORTFOLIO_SCAN",
  similes: ["MY_PORTFOLIO", "PORTFOLIO", "HOLDINGS"],
  description: "Scan all tracked wallets and summarize their SOL holdings",
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = getText(message);
    return /portfolio|holdings|my wallets/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<boolean> => {
    if (watchlist.size === 0) {
      await callback({ text: "No wallets tracked yet. Add some with TRACK_WALLET first." });
      return true;
    }
    let total = 0;
    const lines: string[] = [];
    for (const address of watchlist) {
      try {
        const result = (await rpc("getBalance", [address])) as { value: number };
        const sol = result.value / 1e9;
        total += sol;
        lines.push(`• ${address.slice(0, 8)}… — ${sol.toFixed(4)} SOL`);
      } catch {
        lines.push(`• ${address.slice(0, 8)}… — error`);
      }
    }
    await callback({
      text: `**Portfolio Summary (${watchlist.size} wallets):**\n\n${lines.join("\n")}\n\n**Total: ${total.toFixed(4)} SOL**`,
    });
    return true;
  },
  examples: [
    [
      { name: "user", content: { text: "show my portfolio" } },
      { name: "SolScout", content: { text: "Here's your portfolio..." } },
    ],
  ],
};

// ─── Provider: Intelligence Context ─────────────────────────────────────────

const intelligenceProvider: Provider = {
  name: "SOLANA_INTELLIGENCE",
  description: "Provides real-time Solana watchlist context to the agent",
  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<ProviderResult> => {
    const count = watchlist.size;
    const addresses = [...watchlist].slice(0, 3).map((a) => a.slice(0, 8) + "…");
    return {
      text: `You are SolScout, an on-chain intelligence agent for Solana. Currently tracking ${count} wallet(s)${addresses.length ? `: ${addresses.join(", ")}` : ""}. You can scan wallets, analyze tokens, track smart money, and monitor whale movements.`,
    };
  },
};

// ─── Plugin Export ───────────────────────────────────────────────────────────

const solscoutPlugin: Plugin = {
  name: "solscout",
  description: "On-chain intelligence plugin for Solana — wallet scanning, token analysis, and whale tracking",
  actions: [
    scanWalletAction,
    trackWalletAction,
    scanSmartMoneyAction,
    analyzeTokenAction,
    portfolioScanAction,
  ],
  providers: [intelligenceProvider],
};

export default solscoutPlugin;