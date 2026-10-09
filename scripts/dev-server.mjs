/**
 * Local Development & Universal Reverse Proxy Server
 * Zero-dependency native Node.js HTTP server for:
 * 1. Serving static assets (eliminating origin: 'null' and file:// sandboxing)
 * 2. Transparently proxying remote APIs without CORS/Preflight constraints
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

/**
 * Handle CORS Preflight / Regular CORS response headers
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Read request body safely
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Handle reverse proxy request
 */
async function handleProxyRequest(req, res, reqUrl) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'Missing ?url= parameter',
      usage: 'Example: /api/proxy?url=https://api.example.com/v1/chat'
    }));
    return;
  }

  // Security: validate protocol to prevent non-http/https SSRF abuse
  try {
    const parsedTarget = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Invalid URL protocol: only http and https are allowed' }));
      return;
    }
  } catch (urlErr) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Malformed target URL' }));
    return;
  }

  try {
    const bodyBuffer = await readRequestBody(req);

    // Filter and sanitize forwarded headers
    const forwardedHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (!['host', 'connection', 'origin', 'referer', 'content-length'].includes(lower)) {
        forwardedHeaders[key] = value;
      }
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardedHeaders
    };

    if (bodyBuffer.length > 0 && !['GET', 'HEAD'].includes(req.method)) {
      fetchOptions.body = bodyBuffer;
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    // Forward response status and headers
    const resHeaders = {};
    upstreamRes.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      // Avoid clashing headers
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(lower)) {
        resHeaders[key] = val;
      }
    });

    resHeaders['Access-Control-Allow-Origin'] = '*';
    res.writeHead(upstreamRes.status, resHeaders);

    // Stream upstream body directly to client
    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (streamErr) {
          console.error('[DevServer Proxy] Stream pump error:', streamErr);
          res.end();
        }
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[DevServer Proxy] Forward error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({
      error: 'Upstream gateway error',
      targetUrl,
      message: err.message
    }));
  }
}

/**
 * Handle static file serving
 */
function handleStaticFile(req, res, reqUrl) {
  let pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(ROOT_DIR, pathname);

  // Security check: ensure path is within ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * Create Dev Server instance
 */
export function createDevServer() {
  return http.createServer(async (req, res) => {
    const host = req.headers.host || 'localhost';
    const reqUrl = new URL(req.url, `http://${host}`);

    // Health check endpoint
    if (reqUrl.pathname === '/api/health') {
      setCorsHeaders(res);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'ok', proxy: true, timestamp: Date.now() }));
      return;
    }

    // Reverse proxy endpoint
    if (reqUrl.pathname === '/api/proxy') {
      await handleProxyRequest(req, res, reqUrl);
      return;
    }

    // Static assets
    handleStaticFile(req, res, reqUrl);
  });
}

// Auto start if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '127.0.0.1';
  const server = createDevServer();

  function startListening(targetPort) {
    server.listen(targetPort, host, () => {
      const activePort = server.address().port;
      console.log('\n=============================================================');
      console.log('  🚀 Knowledge Arena Local Dev Server & CORS Proxy Started');
      console.log(`  🌐 Web App:    http://${host}:${activePort}`);
      console.log(`  🔄 CORS Proxy: http://${host}:${activePort}/api/proxy?url=<TARGET>`);
      console.log(`  💡 Health:     http://${host}:${activePort}/api/health`);
      console.log('=============================================================\n');
    });
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      port++;
      console.warn(`[DevServer] Port ${port - 1} is in use, retrying port ${port}...`);
      startListening(port);
    } else {
      console.error('[DevServer] Server error:', err);
    }
  });

  startListening(port);
}
