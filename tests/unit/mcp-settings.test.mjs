import test from 'node:test';
import assert from 'node:assert/strict';
import { McpPreferences, mcpPresentation, createClientEndpoint } from '../../features/mcp-bridge/settings-model.js';
import { McpBridgeController } from '../../features/mcp-bridge/controller.js';

test('remembered connection fields exclude tokens and tolerate unavailable storage', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const prefs = new McpPreferences(() => storage);
  prefs.save({server:'https://gateway.example.com.com',room:'my room',token:'secret'});
  assert.deepEqual(prefs.load(), {server:'https://gateway.example.com.com',room:'my room'});
  assert.ok(![...data.values()].join('').includes('secret'));
  prefs.clear(); assert.equal(prefs.load(), null);
  const blocked = new McpPreferences(() => { throw new Error('blocked'); });
  assert.equal(blocked.load(), null); assert.equal(blocked.save({}), false);
});

test('persisting token when rememberToken is true obfuscates token and loads correctly', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const prefs = new McpPreferences(() => storage);
  prefs.save({server:'https://gateway.example.com.com',room:'my room',token:'sk-proj-test-secret-key-1234567890',rememberToken:true});
  const loaded = prefs.load();
  assert.equal(loaded.server, 'https://gateway.example.com.com');
  assert.equal(loaded.room, 'my room');
  assert.equal(loaded.token, 'sk-proj-test-secret-key-1234567890');
  assert.equal(loaded.rememberToken, true);
  // Ensure the raw secret token is never stored as plaintext in localStorage
  assert.ok(![...data.values()].join('').includes('sk-proj-test-secret-key-1234567890'));
  prefs.clear();
  assert.equal(prefs.load(), null);
});

test('connection state derives field locking and endpoint generation never carries credentials', () => {
  for (const state of ['CONNECTING','REGISTERING','REGISTERED','READY','BACKOFF']) assert.equal(mcpPresentation(state).locked, true);
  for (const state of ['DISABLED','FAILED','DISPLACED']) assert.equal(mcpPresentation(state).locked, false);
  assert.equal(createClientEndpoint('wss://gateway.example.com/bridge', 'a b'), 'https://gateway.example.com.com/mcp/sse?room=a+b');
  assert.throws(() => createClientEndpoint('https://user:secret@gateway.example.com', 'a'));
});

test('disconnect while waiting for the browser lock cannot start a late connection', async () => {
  const names = ['document','location','navigator','isSecureContext'];
  const saved = names.map(name => [name,Object.getOwnPropertyDescriptor(globalThis,name)]);
  const elements = new Map(['mcp-server','mcp-room','mcp-token','mcp-status','mcp-client-config'].map(id=>[id,{value:id==='mcp-server'?'https://gateway.example.com.com':id==='mcp-room'?'room':'test-token',textContent:''}]));
  let grant, starts=0;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:id=>elements.get(id)}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'https:'}});
  Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request(_name,_opts,callback){grant=callback;return Promise.resolve();}}}});
  try {
    const controller = new McpBridgeController({});
    controller.transport = {state:'DISABLED',stop(){},async start(){starts++;}};
    const connecting=controller.connect(); controller.disconnect(); grant({}); await connecting;
    assert.equal(starts,0);
  } finally { for(const [name,descriptor] of saved) { if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]; } }
});
