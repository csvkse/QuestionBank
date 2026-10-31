// Uses the reference repository's existing local Wrangler test gateway and SDK.
// Default: local gateway. --public explicitly opts into an existing remote
// gateway using PYW_MCP_SERVER/KEY/ROOM; it never deploys or changes credentials.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BrowserBridgeTransport } from '../../platform/network/browser-bridge-transport.js';
import { McpToolAdapter } from '../../features/mcp-bridge/tool-adapter.js';
import { DeckToolExecutor } from '../../features/ai-agent/tool-executor.js';
import { DeckVersionController } from '../../features/deck-manager/deck-versioning.js';
import { StorageAdapter } from '../../platform/storage/local-storage-adapter.js';
import { serializeDeckToMarkdown } from '../../shared/markdown-ast.js';
import { createDevServer } from '../../scripts/dev-server.mjs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const root = process.env.PROXYBYCF_ROOT;
if (!root) throw new Error('Set PROXYBYCF_ROOT to the ProxyByCF checkout with installed example test dependencies');
const { startWorker, connectConsumer, key: localKey, until } = await import(pathToFileURL(path.join(root, 'examples/mcp-bridge-client/test/helpers.mjs')));
const publicMode = process.argv.includes('--public');
const key = publicMode ? process.env.PYW_MCP_KEY : localKey;
if (publicMode && (!key || new URL(process.env.PYW_MCP_SERVER).protocol !== 'https:')) throw new Error('Public test requires PYW_MCP_KEY and HTTPS PYW_MCP_SERVER');
const browserClient = process.argv.includes('--browser-client');
const worker = browserClient || publicMode ? null : await startWorker();
const base = publicMode ? process.env.PYW_MCP_SERVER : browserClient ? process.env.MCP_TEST_GATEWAY : `http://${worker.address}:${worker.port}`;
const room = publicMode ? process.env.PYW_MCP_ROOM || `knowledge-arena-public-${randomUUID()}` : 'knowledge-arena-local-test';
let publicAgent;
async function connectTestConsumer() {
  if (!publicMode) return connectConsumer(base, room);
  const require = createRequire(path.join(root, 'examples/mcp-bridge-client/package.json'));
  const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
  const { SSEClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/sse.js')));
  const { Agent, fetch: publicFetch } = await import(pathToFileURL(require.resolve('undici')));
  publicAgent = new Agent({ connections: 8, pipelining: 1, allowH2: false });
  const headers = { Authorization: `Bearer ${key}` };
  const fetch = (input, init) => publicFetch(input, { ...init, dispatcher: publicAgent });
  const client = new Client({ name: 'knowledge-arena-public-validation', version: '1.0.0' });
  await client.connect(new SSEClientTransport(new URL(`/mcp/sse?room=${encodeURIComponent(room)}`, base), {
    fetch, requestInit: { headers }, eventSourceInit: { fetch: (input, init) => fetch(input, { ...init, headers: { ...init?.headers, ...headers } }) }
  }), { timeout: 20000 });
  return { client };
}
if (process.argv.includes('--serve')) {
  const server = createDevServer();
  const configPath = `/__mcp-test-${randomUUID()}`;
  const handler = server.listeners('request')[0];
  server.removeAllListeners('request');
  server.on('request', (req, res) => {
    if (req.url !== configPath) return handler(req, res);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ server: base, room, token: key }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  console.log(JSON.stringify({ base, room, configPath, page: `http://127.0.0.1:${server.address().port}/index.html` }));
  process.on('SIGINT', async () => { server.close(); await worker?.stop(); process.exit(0); });
} else {
  const data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const storage = new StorageAdapter();
  const app = { storage, state: { customDecks: [], deckStates: {}, activeDeckId: 'none' },
    getAllDecks() { return this.state.customDecks; }, getDeckState() { return { totalAttempts: 0 }; },
    saveUserData() { storage.saveCustomDecks(this.state.customDecks); }, renderAllViews() {} };
  app.deckVersioning = new DeckVersionController(app);
  const host = new BrowserBridgeTransport({ adapter: new McpToolAdapter(new DeckToolExecutor(app)) });
  let client;
  try {
    if (!browserClient) {
      await host.start({ server: base, room, token: key });
      await until(() => host.state === 'REGISTERED', 10000);
    }
    ({ client } = await connectTestConsumer());
    const tools = (await client.listTools()).tools; assert.equal(tools.length, 19);
    const seen = new Set(), durations = [];
    const call = async (name, args = {}) => {
      const start = performance.now();
      const result = await client.callTool({ name, arguments: args });
      durations.push(performance.now() - start);
      assert.notEqual(result.isError, true, JSON.stringify(result)); seen.add(name);
      return JSON.parse(result.content[0].text);
    };
    const draft = { title: '桥接测试', categories: [{ id: 'c', name: '分类' }], layers: [{ level: 1, name: '基础' }], entities: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, categoryId: 'c', layer: 1, title: `知识${i}`, prompt: '问', answer: '答' })) };
    const created = await call('tool_create_deck', draft), deckId = created.deckId;
    await call('tool_list_decks'); await call('tool_get_deck', { deckId }); await call('tool_get_deck_guide', { deckId }); await call('tool_search_entities', { query: '知识' });
    await call('tool_update_deck_meta', { deckId, title: '已修改' });
    const extra = { id: 'extra', categoryId: 'c', layer: 1, title: '新题', prompt: '问', answer: '答' };
    await call('tool_add_entities', { deckId, entities: [extra] });
    await call('tool_update_entity', { deckId, entityId: 'extra', updates: { answer: '新答案' } });
    await call('tool_delete_entity', { deckId, entityId: 'extra' });
    await call('tool_update_deck_guide', { deckId, guide: { summary: '摘要', markdown: '### 章节\n内容' } });
    await call('tool_patch_deck_guide', { deckId, operation: 'append_section', heading: '新章节', content: '内容' });
    await call('tool_delete_deck_guide', { deckId });
    await call('tool_batch_update_entities', { deckId, updates: [{ id: 'e0', answer: '批量答案' }] });
    await call('tool_batch_delete_entities', { deckId, entityIds: ['e5'] });
    const snapshot = await call('tool_create_deck_snapshot', { deckId, note: '快照' });
    await call('tool_list_deck_versions', { deckId });
    await call('tool_rollback_deck_version', { deckId, versionId: snapshot.versionId });
    const imported = await call('tool_import_markdown_deck', { markdownText: serializeDeckToMarkdown(await call('tool_get_deck', { deckId })) });
    await call('tool_delete_deck', { deckId: imported.deckId });
    assert.equal(seen.size, 19);
    if (!browserClient) assert.equal(storage.loadCustomDecks()[0].entities.length, 5);
    assert.equal((await call('tool_get_deck', { deckId })).entities.length, 5);
    assert.equal((await client.callTool({ name: 'tool_update_entity', arguments: { deckId, entityId: 'missing', updates: { answer: 'x' } } })).isError, true);
    console.log(JSON.stringify({ transport: `official SDK SSE -> ${publicMode ? 'public ProxyByCF' : 'local ProxyByCF Worker DO'} -> encrypted native WebSocket -> real executor`, browserClient, publicMode, origin: base, room, deckId, tools: seen.size, verifiedTools: [...seen], milliseconds: { min: Math.min(...durations), max: Math.max(...durations), mean: durations.reduce((a, b) => a + b, 0) / durations.length } }));
  } catch (error) {
    if (!publicMode) throw error;
    // SDK exceptions can include the gateway's returned endpoint URL, so do
    // not print raw public errors or assertion payloads containing credentials.
    console.error(JSON.stringify({ ok: false, publicMode, error: error?.name || 'Error' }));
    process.exitCode = 1;
  } finally { host.stop(); await client?.close(); await worker?.stop(); await publicAgent?.close(); delete globalThis.localStorage; }
}
