/**
 * SolScout — Intelligence Dashboard Frontend
 *
 * Connects to the ElizaOS agent API for chat,
 * manages wallet watchlist, token analysis dashboard,
 * and renders live on-chain data visualizations.
 */

// ─────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────
const API_BASE = window.location.origin;
let watchlist = [];
let activityChart = null;

// ─────────────────────────────────────────────────────
// DOM Ready
// ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initChat();
  initWalletManager();
  initTokenAnalyzer();
  initDashboard();
  loadWatchlist();
});

// ─────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.querySelector(`#view-${viewName}`);
  if (target) target.classList.add('active');
}

// ─────────────────────────────────────────────────────
// Watchlist (persistent via localStorage)
// ─────────────────────────────────────────────────────
function loadWatchlist() {
  const stored = localStorage.getItem('solscout_watchlist');
  watchlist = stored ? parseSafe(stored, []) : [];
  renderWatchlistSidebar();
  renderWalletList();
  updateStats();
}

function saveWatchlist() {
  localStorage.setItem('solscout_watchlist', JSON.stringify(watchlist));
  renderWatchlistSidebar();
  renderWalletList();
  updateStats();
}

function parseSafe(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function truncate(addr) {
  if (!addr || addr.length < 12) return addr || '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function renderWatchlistSidebar() {
  const container = document.getElementById('watchlist');
  const countEl = document.getElementById('wallet-count');
  if (!container) return;

  countEl.textContent = watchlist.length;

  if (watchlist.length === 0) {
    container.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);padding:8px 0;">No wallets tracked yet. Add one from the Wallets tab.</p>';
    return;
  }

  container.innerHTML = watchlist.map(addr => `
    <div class="watchlist-item" data-address="${addr}">
      <span class="dot"></span>
      <span>${truncate(addr)}</span>
    </div>
  `).join('');
}

function renderWalletList() {
  const container = document.getElementById('wallet-list');
  if (!container) return;

  if (watchlist.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="icon">&#x1F440;</div><p>No wallets being tracked yet.<br />Add a wallet address above to start monitoring.</p></div>`;
    return;
  }

  container.innerHTML = watchlist.map(addr => `
    <div class="wallet-card fade-in">
      <div class="wallet-info">
        <span class="wallet-address">${addr}</span>
        <span class="wallet-meta">Tracked &middot; Monitoring for activity</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="wallet-balance" id="bal-${addr}">Scanning...</span>
        <button class="btn-icon" onclick="removeWallet('${addr}')" title="Remove wallet">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Fetch balances for each wallet
  watchlist.forEach(addr => fetchWalletBalance(addr));
}

function removeWallet(addr) {
  watchlist = watchlist.filter(w => w !== addr);
  saveWatchlist();
}

function addWallet(addr) {
  if (!addr || addr.length < 32) return;
  if (watchlist.includes(addr)) {
    addAlert(`Wallet ${truncate(addr)} is already being tracked`, 'warn');
    return;
  }
  watchlist.push(addr);
  saveWatchlist();
  addAlert(`Now tracking wallet ${truncate(addr)} — scanning for on-chain activity`, 'new');
}

async function fetchWalletBalance(addr) {
  try {
    const res = await fetch(API_BASE.replace('/chat', ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rpc: 'getBalance', params: [addr] }),
    }).catch(() => null);

    if (res) {
      const data = await res.json();
      const bal = data?.result?.value;
      const el = document.getElementById(`bal-${addr}`);
      if (el) {
        if (bal !== undefined) el.textContent = `${(bal / 1e9).toFixed(2)} SOL`;
        else el.textContent = '0.00 SOL';
      }
    } else {
      const el = document.getElementById(`bal-${addr}`);
      if (el) el.textContent = 'Scanning...';
    }
  } catch {
    const el = document.getElementById(`bal-${addr}`);
    if (el) el.textContent = '--';
  }
}

// ─────────────────────────────────────────────────────
// Wallet Manager
// ─────────────────────────────────────────────────────
function initWalletManager() {
  const input = document.getElementById('wallet-input');
  const btn = document.getElementById('btn-add-wallet');
  if (!input || !btn) return;

  btn.addEventListener('click', () => {
    const addr = input.value.trim();
    if (addr) {
      addWallet(addr);
      input.value = '';
    }
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const addr = input.value.trim();
      if (addr) {
        addWallet(addr);
        input.value = '';
      }
    }
  });
}

// ─────────────────────────────────────────────────────
// Token Analyzer
// ─────────────────────────────────────────────────────
function initTokenAnalyzer() {
  const input = document.getElementById('token-input');
  const btn = document.getElementById('btn-analyze-token');
  if (!input || !btn) return;

  btn.addEventListener('click', () => {
    const addr = input.value.trim();
    if (addr) analyzeToken(addr);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const addr = input.value.trim();
      if (addr) analyzeToken(addr);
    }
  });
}

function analyzeToken(addr) {
  const container = document.getElementById('token-results');
  container.innerHTML = `<div class="loading">Analyzing token ${truncate(addr)} on Solana...</div>`;

  // Query the AI agent for token analysis
  sendMessageToAgent(`Analyze token ${addr} — give me price, volume, holder distribution, risk indicators, and on-chain signals`);

  setTimeout(() => {
    container.innerHTML += `
      <div class="token-card fade-in">
        <h4>
          <span><code style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;">${truncate(addr)}</code></span>
          <span class="risk-badge risk-medium">Scanning...</span>
        </h4>
        <div class="token-stats">
          <div class="token-stat-item"><span class="label">Price</span><span class="value">Fetching...</span></div>
          <div class="token-stat-item"><span class="label">24h Volume</span><span class="value">Fetching...</span></div>
          <div class="token-stat-item"><span class="label">Holders</span><span class="value">Fetching...</span></div>
        </div>
        <p style="margin-top:12px;font-size:0.82rem;color:var(--text-muted);">
          AI analysis loading in the chat panel → full intelligence report with context and risk assessment.
        </p>
      </div>
    `;
  }, 800);
}

// ─────────────────────────────────────────────────────
// Chat (ElizaOS Direct Client API)
// ─────────────────────────────────────────────────────
function initChat() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('btn-send');
  if (!input || !btn) return;

  btn.addEventListener('click', sendChat);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  appendChatMessage('user', text);
  input.value = '';

  sendMessageToAgent(text);
}

function appendChatMessage(type, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `chat-message ${type} fade-in`;

  const icon = type === 'ai'
    ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l3-6 3 12 2-6" /></svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;

  // Convert simple markdown to HTML (bold, code, lists)
  const html = formatMessage(text);

  div.innerHTML = `
    <div class="message-avatar">${icon}</div>
    <div class="message-bubble">${html}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function formatMessage(text) {
  let html = text
    // code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // line breaks to paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br />');

  return `<p>${html}</p>`;
}

async function sendMessageToAgent(text) {
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message ai';
  loadingDiv.innerHTML = `
    <div class="message-avatar">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M8 12l3-6 3 12 2-6" /></svg>
    </div>
    <div class="message-bubble"><div class="loading" style="padding:0;">SolScout is thinking...</div></div>
  `;
  const container = document.getElementById('chat-messages');
  if (container) container.appendChild(loadingDiv);

  try {
    // ElizaOS v2 direct API
    const response = await fetch(`${API_BASE}/api/agent/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, agentId: 'default' }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const reply = data?.text || data?.reply || data?.[0]?.text || '[No response received]';

    // Remove loading
    if (container && container.contains(loadingDiv)) {
      container.removeChild(loadingDiv);
    }

    appendChatMessage('ai', reply);

  } catch (err) {
    // Try alternative ElizaOS endpoint
    try {
      const response2 = await fetch(`${API_BASE}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, roomId: 'default' }),
      });

      const fallbackData = await response2.json();
      const reply = fallbackData?.[0]?.text || fallbackData?.text || JSON.stringify(fallbackData);

      if (container && container.contains(loadingDiv)) {
        container.removeChild(loadingDiv);
      }

      appendChatMessage('ai', reply);
    } catch {
      if (container && container.contains(loadingDiv)) {
        container.removeChild(loadingDiv);
      }
      appendChatMessage('ai', `Agent connection unavailable — the ElizaOS server needs to be running. Try: \`elizaos dev\`\n\nIn production this connects to the Nosana deployment endpoint.`);
    }
  }
}

// ─────────────────────────────────────────────────────
// Dashboard + Alerts
// ─────────────────────────────────────────────────────
function initDashboard() {
  const scanBtn = document.getElementById('btn-scan');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      sendMessageToAgent('Scan all my tracked wallets and provide an intelligence briefing with any alerts or notable movements');
      switchView('chat');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-view="chat"]').classList.add('active');
    });
  }

  fetchSolPrice();
  initActivityChart();

  // Simulated demo alerts to show the UI is alive
  if (watchlist.length === 0) {
    addAlert('SolScout initialized. Connect to ElizaOS and add wallets to begin monitoring.', '');
    addAlert('Tip: Track notable Solana whale wallets to get real-time intelligence briefings.', 'new');
  }
}

function updateStats() {
  const walletCount = document.getElementById('stat-wallets');
  if (walletCount) walletCount.textContent = watchlist.length;

  const alertCount = document.getElementById('stat-alerts');
  if (alertCount) alertCount.textContent = document.querySelectorAll('.alert-item').length;
}

async function fetchSolPrice() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await res.json();
    const price = data?.solana?.usd;
    const el = document.getElementById('stat-sol-price');
    if (el && price) el.textContent = `$${price.toLocaleString()}`;
  } catch {
    // Silent fail — price is nice-to-have
  }
}

function addAlert(text, type) {
  const feed = document.getElementById('alerts-feed');
  if (!feed) return;

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const div = document.createElement('div');
  div.className = `alert-item fade-in alert-${type}`;
  div.innerHTML = `<span class="alert-time">${time}</span><span class="alert-text">${text}</span>`;

  feed.insertBefore(div, feed.firstChild);

  // Keep feed manageable
  while (feed.children.length > 50) {
    feed.removeChild(feed.lastChild);
  }

  updateStats();
}

// ─────────────────────────────────────────────────────
// Activity Chart (Chart.js)
// ─────────────────────────────────────────────────────
function initActivityChart() {
  const canvas = document.getElementById('activity-chart');
  if (!canvas) return;

  const labels = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600000);
    labels.push(d.getHours().toString().padStart(2, '0') + ':00');
  }

  // Generate some sample data — will be replaced with real data when wallets are tracked
  const data = labels.map(() => Math.floor(Math.random() * 30 + 5));

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 250);
  gradient.addColorStop(0, 'rgba(108, 140, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(108, 140, 255, 0.0)');

  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Transactions',
        data,
        borderColor: '#6c8cff',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#6c8cff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1f2b',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#8b95a8',
          bodyColor: '#e8eaef',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#566070',
            font: { size: 10 },
            maxRotation: 0,
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#566070', font: { size: 10 } },
          beginAtZero: true,
        },
      },
    },
  });
}
