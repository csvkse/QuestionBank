import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CursorConfigAdapter,
  ClaudeDesktopAdapter,
  ClineConfigAdapter,
  WindsurfConfigAdapter,
  ClaudeCodeCliAdapter,
  ClientConfigRegistry
} from '../../features/mcp-bridge/client-adapters.js';

test('CursorConfigAdapter formats valid SSE configuration with Authorization header', () => {
  const adapter = new CursorConfigAdapter();
  const jsonStr = adapter.formatConfig({
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'sk-proj-test-secret-key-1234567890',
    includeToken: true
  });
  const parsed = JSON.parse(jsonStr);
  assert.ok(parsed.mcpServers['knowledge-arena']);
  assert.equal(parsed.mcpServers['knowledge-arena'].url, 'https://gateway.example.com.com.com/mcp/sse?room=test');
  assert.equal(parsed.mcpServers['knowledge-arena'].headers.Authorization, 'Bearer sk-proj-test-secret-key-1234567890');
});

test('ClaudeDesktopAdapter formats valid stdio command configuration using mcp-remote', () => {
  const adapter = new ClaudeDesktopAdapter();
  const jsonStr = adapter.formatConfig({
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'sk-proj-test-secret-key-1234567890',
    includeToken: true
  });
  const parsed = JSON.parse(jsonStr);
  const server = parsed.mcpServers['knowledge-arena'];
  assert.equal(server.command, 'npx');
  assert.deepEqual(server.args, [
    '-y',
    'mcp-remote',
    'https://gateway.example.com.com.com/mcp/sse?room=test',
    '--header',
    'Authorization:Bearer sk-proj-test-secret-key-1234567890'
  ]);
  // Crucial syntax invariant: no spaces between Authorization and Bearer for CLI parser compatibility
  assert.ok(server.args[4].startsWith('Authorization:Bearer'));
});

test('ClineConfigAdapter formats valid SSE configuration with type and autoApprove list', () => {
  const adapter = new ClineConfigAdapter();
  const jsonStr = adapter.formatConfig({
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'sk-proj-test-secret-key-1234567890',
    includeToken: true
  });
  const parsed = JSON.parse(jsonStr);
  const server = parsed.mcpServers['knowledge-arena'];
  assert.equal(server.type, 'sse');
  assert.equal(server.url, 'https://gateway.example.com.com.com/mcp/sse?room=test');
  assert.equal(server.disabled, false);
  assert.ok(Array.isArray(server.autoApprove));
  assert.ok(server.autoApprove.includes('tool_get_overview'));
});

test('WindsurfConfigAdapter formats valid SSE configuration using serverUrl field', () => {
  const adapter = new WindsurfConfigAdapter();
  const jsonStr = adapter.formatConfig({
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'sk-proj-test-secret-key-1234567890',
    includeToken: true
  });
  const parsed = JSON.parse(jsonStr);
  const server = parsed.mcpServers['knowledge-arena'];
  assert.equal(server.serverUrl, 'https://gateway.example.com.com.com/mcp/sse?room=test');
  assert.equal(server.headers.Authorization, 'Bearer sk-proj-test-secret-key-1234567890');
});

test('ClaudeCodeCliAdapter formats valid claude mcp add command', () => {
  const adapter = new ClaudeCodeCliAdapter();
  const cmd = adapter.formatConfig({
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'sk-proj-test-secret-key-1234567890',
    includeToken: true
  });
  assert.ok(cmd.startsWith('claude mcp add --transport sse knowledge-arena'));
  assert.ok(cmd.includes('https://gateway.example.com.com.com/mcp/sse?room=test'));
  assert.ok(cmd.includes('Authorization: Bearer sk-proj-test-secret-key-1234567890'));
});

test('Adapters mask token with <YOUR_TOKEN> when includeToken is false', () => {
  const registry = new ClientConfigRegistry();
  for (const client of registry.listClients()) {
    const generated = registry.generate(client.id, {
      endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
      token: 'sk-proj-test-secret-key-1234567890',
      includeToken: false
    });
    assert.ok(generated.code.includes('<YOUR_TOKEN>'), `${client.id} should mask token`);
    assert.ok(!generated.code.includes('sk-proj-test-secret-key-1234567890'), `${client.id} should not expose secret`);
  }
});

test('ClientConfigRegistry lists supported clients and defaults to cursor on unknown ID', () => {
  const registry = new ClientConfigRegistry();
  const clients = registry.listClients();
  assert.equal(clients.length, 5);
  const fallback = registry.generate('unknown-client', {
    endpointUrl: 'https://gateway.example.com.com.com/mcp/sse?room=test',
    token: 'tok'
  });
  assert.equal(fallback.id, 'cursor');
});
