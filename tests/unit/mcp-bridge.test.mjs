import test from 'node:test';
import assert from 'node:assert/strict';
import { McpToolAdapter } from '../../features/mcp-bridge/tool-adapter.js';
import { DeckToolExecutor } from '../../features/ai-agent/tool-executor.js';
import { DeckVersionController } from '../../features/deck-manager/deck-versioning.js';
import { serializeDeckToMarkdown } from '../../shared/markdown-ast.js';
import { StorageAdapter } from '../../platform/storage/local-storage-adapter.js';

export function bridgeFixture() {
  const storage = new StorageAdapter();
  const deck = { id: 'custom', title: '测试库', categories: [{ id: 'c', name: '分类' }], layers: [{ level: 1, name: '基础' }], entities: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, categoryId: 'c', layer: 1, title: `知识${i}`, prompt: `问题${i}`, answer: `答案${i}` })) };
  const app = { storage, state: { customDecks: [deck], deckStates: {}, activeDeckId: 'custom' },
    getAllDecks() { return this.state.customDecks; }, getDeckState() { return { totalAttempts: 0 }; },
    saveUserData() { storage.saveCustomDecks(this.state.customDecks); }, renderAllViews() {} };
  app.deckVersioning = new DeckVersionController(app);
  return { app, adapter: new McpToolAdapter(new DeckToolExecutor(app)) };
}

test('all 21 tools execute real business paths with canonical aliases and auto-healing', async () => {
  const { app, adapter } = bridgeFixture();
  const covered = new Set();
  const call = async (name, args = {}) => {
    const result = await adapter.callTool(name, args);
    assert.notEqual(result.isError, true, JSON.stringify(result));
    covered.add(name); return JSON.parse(result.content[0].text);
  };
  assert.equal(adapter.listTools().length, 21);
  await call('tool_list_decks');
  await call('tool_get_deck', { deckId: 'custom' });
  await call('tool_search_entities', { query: '知识' });
  await call('tool_get_deck_guide', { deckId: 'custom' });
  const created = await call('tool_create_deck', { ...structuredClone(app.state.customDecks[0]), title: '新库' });
  assert.notEqual(created.deckId, 'custom');
  await call('tool_import_markdown_deck', { markdownText: serializeDeckToMarkdown(app.state.customDecks[0]) });
  await call('tool_update_deck_meta', { deckId: 'custom', title: '更新库' });
  await call('tool_add_entities', { deckId: 'custom', entities: [{ id: 'new', categoryId: 'c', layer: 1, title: '新题', prompt: '问', answer: '答' }] });
  await call('tool_update_entity', { deckId: 'custom', entityId: 'new', updates: { answer: '新答' } });
  await call('tool_delete_entity', { deckId: 'custom', entityId: 'new' });
  await call('tool_update_deck_guide', { deckId: 'custom', guide: { summary: '摘要', markdown: '### 章节\n内容' } });
  await call('tool_patch_deck_guide', { deckId: 'custom', operation: 'update_summary', summary: '更新摘要' });
  await call('tool_delete_deck_guide', { deckId: 'custom' });
  await call('tool_batch_update_entities', { deckId: 'custom', updates: [{ id: 'e0', answer: '修改' }] });
  await call('tool_batch_delete_entities', { deckId: 'custom', entityIds: ['e5'] });
  const snap = await call('tool_create_deck_snapshot', { deckId: 'custom', note: '基线' });
  await call('tool_list_deck_versions', { deckId: 'custom' });
  await call('tool_rollback_deck_version', { deckId: 'custom', versionId: snap.versionId });
  await call('tool_delete_deck', { deckId: created.deckId });
  await call('tool_get_runtime_context');
  await call('tool_get_mode_specifications', { mode: 'ALL' });
  assert.equal(covered.size, 21);
  assert.equal(app.state.customDecks[0].entities.length, 5);

  // 验证 Canonical 别名调用与标题脏字符自愈
  const canonicalRes = await adapter.callTool('list_decks', {});
  assert.notEqual(canonicalRes.isError, true);
  const addRes = await adapter.callTool('add_entities', {
    deckId: 'custom',
    entities: [{ id: 'kana_ne', categoryId: 'c', layer: 1, title: '【ね 的读音 】', prompt: '问', answer: '答' }]
  });
  assert.notEqual(addRes.isError, true);
  const parsedAdd = JSON.parse(addRes.content[0].text);
  assert.ok(parsedAdd.suggestedNextActions, '应包含 suggestedNextActions 行动建议');
  const addedKana = app.state.customDecks[0].entities.find(e => e.id === 'kana_ne');
  assert.equal(addedKana.title, 'ね', '标题噪音应自动剥离为纯净词干');
});

test('invalid edits roll back and operation IDs deduplicate only the same intent', async () => {
  const { app, adapter } = bridgeFixture();
  const before = structuredClone(app.state);
  const bad = await adapter.callTool('tool_update_entity', { deckId: 'custom', entityId: 'e0', updates: { answer: '' } });
  assert.equal(bad.isError, true); assert.deepEqual(app.state, before);
  const args = { deckId: 'custom', entities: [{ id: 'new', categoryId: 'c', layer: 1, title: '新题', prompt: '问', answer: '答' }] };
  const first = await adapter.callTool('tool_add_entities', args, { operationId: 'op1' });
  assert.deepEqual(await adapter.callTool('tool_add_entities', args, { operationId: 'op1' }), first);
  assert.equal(app.state.customDecks[0].entities.length, 7);
  assert.equal((await adapter.callTool('tool_add_entities', { ...args, entities: [] }, { operationId: 'op1' })).isError, true);
  assert.equal((await adapter.callTool('unknown', {})).isError, true);
  assert.equal((await adapter.callTool('tool_create_deck', { title: 1 })).isError, true);
});

test('storage failure never reports success and restores page state', async () => {
  const map = new Map();
  globalThis.localStorage = { getItem: key => map.get(key) ?? null, setItem(key, value) { if (key.includes('user_decks')) throw new Error('quota'); map.set(key, value); }, removeItem: key => map.delete(key) };
  try {
    const { app, adapter } = bridgeFixture(); const before = structuredClone(app.state);
    const result = await adapter.callTool('tool_update_deck_meta', { deckId: 'custom', title: '失败' });
    assert.equal(result.isError, true); assert.deepEqual(app.state, before);
  } finally { delete globalThis.localStorage; }
});

test('large write returns a success receipt after committing, not a false failure', async () => {
  const { app, adapter } = bridgeFixture();
  const markdown = 'x'.repeat(270 * 1024);
  const result = await adapter.callTool('tool_update_deck_guide', { deckId: 'custom', guide: { summary: '大导学', markdown } });
  assert.notEqual(result.isError, true);
  assert.equal(app.state.customDecks[0].guide.markdown.length, markdown.length);
  assert.ok(result.content[0].text.length < 1024);
});
