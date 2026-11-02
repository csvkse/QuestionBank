/**
 * Unit Test: Deck Tool Persistence Fidelity & Refresh Invariant (FE-PERSIST-001)
 * tests/unit/deck-tool-persistence.test.mjs
 *
 * Verifies that:
 * 1. tool_create_deck writes synchronously to underlying localStorage (not just in-memory RAM)
 * 2. WriteScheduler commits CUSTOM_DECKS and ACTIVE_DECK_ID domains
 * 3. A fresh KnowledgeMasterApp instance (simulating page reload) retains the new deck
 * 4. tool_import_markdown_deck and tool_update_deck_meta persist across reloads
 * 5. tool_delete_deck updates persistent storage reliably
 */

import assert from 'assert';
import { KnowledgeMasterApp } from '../../app/main.js';
import { serializeDeckToMarkdown } from '../../shared/markdown-ast.js';

console.log('🧪 Testing deck-tool-persistence.test.mjs (Persistence Fidelity Gate)...');

// 1. 设置原生 localStorage 模拟存储
const rawStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => rawStorage.get(k) ?? null,
  setItem: (k, v) => rawStorage.set(k, String(v)),
  removeItem: (k) => rawStorage.delete(k),
  clear: () => rawStorage.clear()
};

// 2. 模拟基础 DOM 环境
const mockElements = new Map();
function getOrCreateMockElement(id) {
  if (!mockElements.has(id)) {
    mockElements.set(id, {
      id,
      innerHTML: '',
      innerText: '',
      value: '',
      style: {},
      options: [],
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      }
    });
  }
  return mockElements.get(id);
}

globalThis.document = {
  getElementById: (id) => getOrCreateMockElement(id),
  querySelectorAll: () => []
};

// 3. 测试 tool_create_deck 真实落盘
{
  const app = new KnowledgeMasterApp();
  const executor = app.aiAgent.executor;

  const draft = {
    title: '持久化落盘门禁验证题库',
    icon: '🛡️',
    description: '验证写入与刷新后不丢失',
    categories: [{ id: 'cat_p1', name: '持久化分类', group: '系统治理' }],
    layers: [{ level: 1, name: '基础层' }],
    entities: [
      { id: 'p_e1', categoryId: 'cat_p1', layer: 1, title: '词条1', prompt: '问1', answer: '答1' },
      { id: 'p_e2', categoryId: 'cat_p1', layer: 1, title: '词条2', prompt: '问2', answer: '答2' },
      { id: 'p_e3', categoryId: 'cat_p1', layer: 1, title: '词条3', prompt: '问3', answer: '答3' },
      { id: 'p_e4', categoryId: 'cat_p1', layer: 1, title: '词条4', prompt: '问4', answer: '答4' }
    ]
  };

  const createRes = await executor.execute('tool_create_deck', draft);
  assert.equal(createRes.success, true, 'tool_create_deck 必须返回 success: true');
  assert.ok(createRes.deckId, 'tool_create_deck 必须返回 deckId');
  assert.equal(createRes.active, true, '新建题库默认应自动设为 active');

  // 门禁断言 A：底层原生 localStorage 必须已经落盘
  const rawJson = globalThis.localStorage.getItem('verbmaster_user_decks_v2');
  assert.ok(rawJson, 'localStorage 中的 verbmaster_user_decks_v2 不得为空！');
  const savedDecks = JSON.parse(rawJson);
  assert.ok(Array.isArray(savedDecks), 'savedDecks 必须为数组');
  const found = savedDecks.find(d => d.id === createRes.deckId);
  assert.ok(found, `底层存储必须已包含新建的 deckId: ${createRes.deckId}`);
  assert.equal(found.title, draft.title, '底层存储中的题库标题必须一致');
  assert.equal(found.entities.length, 4, '底层存储中的词条数必须一致');

  // 门禁断言 B：activeDeckId 也必须已落盘
  const activeDeckId = globalThis.localStorage.getItem('verbmaster_active_deck_id_v2');
  assert.equal(activeDeckId, createRes.deckId, 'activeDeckId 必须同步持久化到 localStorage');

  // 门禁断言 C：模拟用户刷新页面（重新实例化 App）
  const reloadedApp = new KnowledgeMasterApp();
  const loadedDecks = reloadedApp.getAllDecks();
  const loadedDeck = loadedDecks.find(d => d.id === createRes.deckId);
  assert.ok(loadedDeck, '页面刷新后重新初始化的 App 必须能正确加载该题库');
  assert.equal(reloadedApp.getActiveDeck().id, createRes.deckId, '刷新后激活题库必须依然为该新建题库');

  // 4. 测试 tool_update_deck_meta 真实持久化
  await executor.execute('tool_update_deck_meta', { deckId: createRes.deckId, title: '持久化题库_已改名' });
  const updatedJson = JSON.parse(globalThis.localStorage.getItem('verbmaster_user_decks_v2'));
  const updatedDeck = updatedJson.find(d => d.id === createRes.deckId);
  assert.equal(updatedDeck.title, '持久化题库_已改名', '修改元数据后 localStorage 必须即时同步更新');

  // 5. 测试 tool_import_markdown_deck 真实持久化
  const mdText = serializeDeckToMarkdown(loadedDeck);
  const importRes = await executor.execute('tool_import_markdown_deck', { markdownText: mdText });
  assert.equal(importRes.success, true, 'Markdown 导入必须成功');
  const decksAfterImport = JSON.parse(globalThis.localStorage.getItem('verbmaster_user_decks_v2'));
  assert.ok(decksAfterImport.some(d => d.id === importRes.deckId), '导入题库后 localStorage 必须包含新题库');

  // 6. 测试 tool_delete_deck 真实持久化
  await executor.execute('tool_delete_deck', { deckId: importRes.deckId });
  const decksAfterDelete = JSON.parse(globalThis.localStorage.getItem('verbmaster_user_decks_v2'));
  assert.equal(decksAfterDelete.some(d => d.id === importRes.deckId), false, '删除题库后活跃 localStorage 中不得再包含该题库');
}

console.log('✅ deck-tool-persistence.test.mjs PASSED!');
