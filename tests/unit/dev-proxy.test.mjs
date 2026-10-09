import assert from 'node:assert';
import http from 'node:http';
import { createDevServer } from '../../scripts/dev-server.mjs';

/**
 * Dev Server & Reverse Proxy Unit Tests
 */
async function runTests() {
  console.log('🧪 Testing dev-server.mjs reverse proxy & CORS handling...');

  // 1. 创建并启动测试代理服务器 (随机可用端口)
  const proxyServer = createDevServer();
  await new Promise(resolve => proxyServer.listen(0, resolve));
  const proxyPort = proxyServer.address().port;
  const proxyBase = `http://127.0.0.1:${proxyPort}`;

  // 2. 创建一个虚拟目标测试服务器模拟上游 API
  const upstreamServer = http.createServer(async (req, res) => {
    // 模拟服务端：不处理 OPTIONS (返回 405)
    if (req.method === 'OPTIONS') {
      res.writeHead(405, { 'Allow': 'POST' });
      res.end('Method Not Allowed');
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Echo-Auth': req.headers['authorization'] || ''
        });
        res.end(JSON.stringify({
          ok: true,
          receivedBody: JSON.parse(body || '{}'),
          echoToken: req.headers['authorization']
        }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve => upstreamServer.listen(0, resolve));
  const upstreamPort = upstreamServer.address().port;
  const upstreamUrl = `http://127.0.0.1:${upstreamPort}/test-endpoint`;

  try {
    // Test 1: Health check endpoint
    const healthRes = await fetch(`${proxyBase}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'Health check should return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok', 'Health status should be ok');
    assert.strictEqual(healthData.proxy, true, 'Proxy flag should be true');
    console.log('  ✓ /api/health endpoint functional');

    // Test 2: CORS Preflight OPTIONS to /api/proxy
    const preflightRes = await fetch(`${proxyBase}/api/proxy?url=${encodeURIComponent(upstreamUrl)}`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });

    assert.strictEqual(preflightRes.status, 204, 'Proxy should handle OPTIONS with 204 No Content');
    assert.strictEqual(preflightRes.headers.get('access-control-allow-origin'), '*', 'Should set Allow-Origin: *');
    assert.ok(preflightRes.headers.get('access-control-allow-methods'), 'Should set Allow-Methods');
    console.log('  ✓ /api/proxy intercepts and resolves OPTIONS preflight with 204 and CORS headers');

    // Test 3: Proxy POST request forwarding
    const postRes = await fetch(`${proxyBase}/api/proxy?url=${encodeURIComponent(upstreamUrl)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-secret-token'
      },
      body: JSON.stringify({ query: 'mastery panorama', deckId: 'deck_1' })
    });

    assert.strictEqual(postRes.status, 200, 'Proxied POST request should succeed');
    assert.strictEqual(postRes.headers.get('access-control-allow-origin'), '*', 'Proxied response should have CORS header');
    const postData = await postRes.json();
    assert.strictEqual(postData.ok, true, 'Upstream response should be received');
    assert.strictEqual(postData.echoToken, 'Bearer test-secret-token', 'Authorization header should be forwarded');
    assert.strictEqual(postData.receivedBody.deckId, 'deck_1', 'Request body should be forwarded');
    console.log('  ✓ /api/proxy correctly forwards POST payload and headers without preflight failure');

    console.log('✅ dev-server.mjs reverse proxy tests PASSED!\n');
  } finally {
    proxyServer.close();
    upstreamServer.close();
  }
}

runTests().catch(err => {
  console.error('❌ dev-proxy.test.mjs FAILED:', err);
  process.exit(1);
});
