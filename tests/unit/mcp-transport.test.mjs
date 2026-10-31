import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserBridgeTransport, bridgeConnectionUrl, BridgeCipher } from '../../platform/network/browser-bridge-transport.js';

class FakeSocket extends EventTarget {
  static instances = [];
  constructor(url, protocols) { super(); this.url = url; this.protocols = protocols; this.readyState = 1; this.bufferedAmount = 0; this.sent = []; FakeSocket.instances.push(this); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close(code = 1000) { this.readyState = 3; this.dispatchEvent(new CloseEvent('close', { code })); }
  message(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })); }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 30));

test('validates gateway origins and never adds token to URL', () => {
  const url = bridgeConnectionUrl('https://gateway.example.com.com', 'my room');
  assert.equal(url.searchParams.get('room'), 'my room'); assert.equal(url.protocol, 'wss:');
  assert.equal(url.searchParams.has('token'), false);
  for (const invalid of ['https://user:pass@gateway.example.com', 'https://gateway.example.com.com/path', 'http://remote.example', 'https://gateway.example.com.com?token=x']) assert.throws(() => bridgeConnectionUrl(invalid, 'room'));
});

test('encrypted registration, RPC result and stop ignore stale callbacks', async () => {
  const cipher = await BridgeCipher.create('test-token');
  let calls = 0;
  const adapter = { listTools: () => [{ name: 'echo', inputSchema: { type: 'object' } }], callTool: async () => { calls++; return { content: [{ type: 'text', text: 'ok' }] }; } };
  const bridge = new BrowserBridgeTransport({ adapter, WebSocketClass: FakeSocket });
  await bridge.start({ server: 'https://gateway.example.com.com', room: 'test', token: 'test-token' });
  const socket = FakeSocket.instances.at(-1);
  assert.deepEqual(socket.protocols, ['aes-256-gcm', 'test-token']);
  socket.message(await cipher.encrypt({ type: 'BRIDGE_CONNECTED', role: 'host' }));
  await tick();
  assert.equal(bridge.state, 'REGISTERED');
  assert.equal((await cipher.decrypt(socket.sent[0])).tools.length, 1);
  socket.message(await cipher.encrypt({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: {} } }));
  await tick(); assert.equal(calls, 1);
  assert.equal((await cipher.decrypt(socket.sent.at(-1))).result.content[0].text, 'ok');
  bridge.stop();
  socket.message(await cipher.encrypt({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo' } }));
  await tick(); assert.equal(calls, 1); assert.equal(bridge.state, 'DISABLED');
});

test('cipher rejects tampered envelopes', async () => {
  const cipher = await BridgeCipher.create('test-token');
  const message = await cipher.encrypt({ value: 42 }); message.tag = btoa('0000000000000000');
  await assert.rejects(cipher.decrypt(message));
});

test('a queued write past its deadline is rejected before execution', async t => {
  const cipher = await BridgeCipher.create('test-token'); let calls = 0, release;
  const adapter = { listTools: () => [], callTool: async () => { calls++; await new Promise(resolve => { release = resolve; }); return { content: [] }; } };
  const bridge = new BrowserBridgeTransport({ adapter, WebSocketClass: FakeSocket, requestTimeoutMs: 10 });
  t.after(() => bridge.stop());
  await bridge.start({ server: 'https://gateway.example.com.com', room: 'test', token: 'test-token' });
  const socket = FakeSocket.instances.at(-1);
  socket.message(await cipher.encrypt({ type: 'BRIDGE_CONNECTED', role: 'host' })); await tick();
  socket.message(await cipher.encrypt({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'write' } })); await tick();
  socket.message(await cipher.encrypt({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'write' } })); await tick();
  release(); await tick();
  assert.equal(calls, 1);
  assert.equal((await cipher.decrypt(socket.sent.at(-1))).error.code, -32000);
  bridge.stop();
});
