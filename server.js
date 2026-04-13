/**
 * SolScout Server
 * Serves the UI dashboard alongside the ElizaOS agent API.
 * This allows the dashboard and AI backend to be deployed together on Nosana.
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const UI_DIR = join(process.cwd(), 'ui');
const PORT = parseInt(process.env.UI_PORT || '3001', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFile(filePath, res) {
  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch {
    res.writeHead(500);
    res.end('Server error');
  }
}

const server = createServer((req, res) => {
  // CORS headers for cross-origin when UI and API are on different ports
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy API requests to ElizaOS (running on port 3000)
  const isApiRoute = req.url === '/agents' || req.url.includes('/message') || req.url.startsWith('/api/');
  
  if (isApiRoute) {
    // Force IPv4 (127.0.0.1) instead of localhost to prevent Node 18+ returning ECONNREFUSED on IPv6 (::1)
    const elizaUrl = `http://127.0.0.1:3000${req.url}`;
    
    // Node.js native fetch requires us to consume the request stream first
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks);
      const reqInit = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'content-length'].includes(k.toLowerCase()))),
        }
      };
      
      if (req.method !== 'GET' && req.method !== 'HEAD' && bodyBuffer.length > 0) {
        reqInit.body = bodyBuffer;
      }

      fetch(elizaUrl, reqInit)
        .then(async (proxyRes) => {
          const body = await proxyRes.text();
          res.writeHead(proxyRes.status, { 'Content-Type': 'application/json' });
          res.end(body);
        })
        .catch(() => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ElizaOS backend unavailable' }));
        });
    });
    return;
  }

  // Serve static UI files
  let urlPath = req.url?.split('?')[0] || '/';
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = join(UI_DIR, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(UI_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log(`\n  SolScout Dashboard: http://localhost:${PORT}`);
  if (PORT !== 3000) {
    console.log(`  ElizaOS Agent:    http://localhost:3000`);
  }
  console.log(`  Press Ctrl+C to stop\n`);
});

export { server };
