import { DeckVersionController } from '../../features/deck-manager/deck-versioning.js';
import { DeckToolExecutor } from '../../features/ai-agent/tool-executor.js';

console.log('🧪 Testing deck-versioning.js, batch ops, and guide CRUD...');

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

function createMockApp() {
  const customDeck = {
    id: 'deck_custom_test',
    title: '测试自定义题库',
    icon: '🧪',
    categories: [{ id: 'cat_1', name: '分类1', group: '大组1' }],
    entities: [
      { id: 'ent_1', categoryId: 'cat_1', layer: 1, title: '考点1', prompt: 'P1', answer: 'A1' },
      { id: 'ent_2', categoryId: 'cat_1', layer: 1, title: '考点2', prompt: 'P2', answer: 'A2' },
      { id: 'ent_3', categoryId: 'cat_1', layer: 1, title: '考点3', prompt: 'P3', answer: 'A3' },
      { id: 'ent_4', categoryId: 'cat_1', layer: 1, title: '考点4', prompt: 'P4', answer: 'A4' }
    ],
    guide: { summary: '初始导学', markdown: '### 初始章节\n内容' }
  };

  const storageData = { versions: {}, trash: [] };
  const mockStorage = {
    loadDeckVersions() { return storageData.versions; },
    saveDeckVersions(v) { storageData.versions = v; },
    loadRecycleBin() { return storageData.trash; },
    saveRecycleBin(t) { storageData.trash = t; },
    saveActiveDeckId(id) { mockApp.state.activeDeckId = id; }
  };

  const mockApp = {
    storage: mockStorage,
    state: {
      activeDeckId: 'deck_custom_test',
      customDecks: [customDeck],
      deckStates: {
        deck_custom_test: {
          cards: {
            ent_1: { attempts: 5, level: 3 },
            ent_2: { attempts: 2, level: 1 }
          }
        }
      }
    },
    getAllDecks() {
      return [{ id: 'deck_verbs', title: '英语动词', entities: [] }, ...this.state.customDecks];
    },
    getDeckState(id) { return this.state.deckStates[id] || { totalAttempts: 0, cards: {} }; },
    saveUserData() { this.saved = true; },
    renderAllViews() { this.rendered = true; }
  };

  mockApp.deckVersioning = new DeckVersionController(mockApp);
  return { mockApp, customDeck };
}

// 1. 测试快照创建与滚动上限 (10个)
{
  const { mockApp, customDeck } = createMockApp();
  const dvc = mockApp.deckVersioning;

  // 内置题库保护
  assert(dvc.createSnapshot({ id: 'deck_verbs' }) === null, 'Built-in decks should not create snapshots');

  // 创建 12 个快照
  for (let i = 1; i <= 12; i++) {
    dvc.createSnapshot(customDeck, { note: `快照 #${i}` });
  }

  const versions = dvc.getVersions('deck_custom_test');
  assert(versions.length === 10, 'Should enforce max 10 rolling snapshots limit');
  assert(versions[0].versionName === '快照 #12', 'Newest snapshot should be at head');
}

// 2. 测试版本回滚与孤立学习状态协同
{
  const { mockApp, customDeck } = createMockApp();
  const dvc = mockApp.deckVersioning;

  // 建立基线快照 v1 (4题)
  const snap1 = dvc.createSnapshot(customDeck, { note: 'v1基线' });

  // 模拟题库演进：增加 ent_5 并答题
  customDeck.entities.push({ id: 'ent_5', categoryId: 'cat_1', layer: 1, title: '考点5', prompt: 'P5', answer: 'A5' });
  mockApp.state.deckStates.deck_custom_test.cards.ent_5 = { attempts: 1, level: 1 };
  assert(customDeck.entities.length === 5, 'Deck has 5 entities now');

  // 回滚回 v1
  const rollRes = dvc.rollbackToVersion('deck_custom_test', snap1.versionId);
  assert(rollRes.success === true, 'Rollback should succeed');
  assert(mockApp.state.customDecks[0].entities.length === 4, 'Deck should be restored to 4 entities');
  assert(mockApp.state.deckStates.deck_custom_test.cards.ent_5 === undefined, 'Orphaned card ent_5 state should be safely pruned');
  assert(mockApp.state.deckStates.deck_custom_test.cards.ent_1.attempts === 5, 'Retained card state should persist');
}

// 3. 测试软删除进回收站与一键还原
{
  const { mockApp } = createMockApp();
  const dvc = mockApp.deckVersioning;

  const delRes = dvc.softDeleteDeck('deck_custom_test');
  assert(delRes.success === true, 'Soft delete should succeed');
  assert(mockApp.state.customDecks.length === 0, 'Deck should be removed from active decks');
  assert(mockApp.state.activeDeckId === 'deck_verbs', 'Active deck should fallback to default');
  assert(dvc.recycleBin.length === 1, 'Recycle bin should have 1 item');

  // 从回收站还原
  const restoreRes = dvc.restoreFromRecycleBin('deck_custom_test');
  assert(restoreRes.success === true, 'Restore should succeed');
  assert(mockApp.state.customDecks.length === 1, 'Deck restored to active decks');
  assert(dvc.recycleBin.length === 0, 'Recycle bin should be empty');
}

// 4. 测试批量实体操作 (Batch Update / Batch Delete)
{
  const { mockApp } = createMockApp();
  const dvc = mockApp.deckVersioning;

  // 批量更新
  const updateRes = dvc.batchUpdateEntities('deck_custom_test', [
    { id: 'ent_1', prompt: 'New Prompt 1', layer: 2 },
    { id: 'ent_2', explanation: 'New Explanation 2' }
  ]);
  assert(updateRes.updatedCount === 2, '2 entities should be updated');
  const deck = mockApp.state.customDecks[0];
  assert(deck.entities.find(e => e.id === 'ent_1').prompt === 'New Prompt 1', 'Entity 1 updated');
  assert(deck.entities.find(e => e.id === 'ent_1').layer === 2, 'Entity 1 layer updated');

  // atomic_strict 模式检测非法 ID
  let thrown = false;
  try {
    dvc.batchUpdateEntities('deck_custom_test', [{ id: 'non_existent', prompt: 'X' }]);
  } catch (e) {
    thrown = true;
  }
  assert(thrown, 'Should throw in atomic_strict when entity id is missing');

  // 批量删除
  const delBatchRes = dvc.batchDeleteEntities('deck_custom_test', ['ent_3', 'ent_4']);
  assert(delBatchRes.deletedCount === 2, '2 entities deleted');
  assert(deck.entities.length === 2, 'Remaining 2 entities');
}

// 5. 测试导学增量修改与清空
{
  const { mockApp } = createMockApp();
  const dvc = mockApp.deckVersioning;

  // 增量追加
  dvc.patchDeckGuide('deck_custom_test', {
    operation: 'append_section',
    heading: '二、新板块',
    content: '- 核心要点'
  });
  assert(mockApp.state.customDecks[0].guide.markdown.includes('### 二、新板块'), 'Section should be appended');

  // 更新摘要
  dvc.patchDeckGuide('deck_custom_test', {
    operation: 'update_summary',
    summary: '全新一句话图式'
  });
  assert(mockApp.state.customDecks[0].guide.summary === '全新一句话图式', 'Summary updated');

  // 清空导学
  dvc.deleteDeckGuide('deck_custom_test');
  assert(mockApp.state.customDecks[0].guide === null, 'Guide should be reset to null');
}

// 6. 测试 AI Agent 工具调度链路
{
  const { mockApp } = createMockApp();
  const executor = new DeckToolExecutor(mockApp);

  // 6.1 tool_create_deck_snapshot
  const snapRes = await executor.execute('tool_create_deck_snapshot', {
    deckId: 'deck_custom_test',
    note: 'Agent Checkpoint'
  });
  assert(snapRes.success === true, 'Agent snapshot created');

  // 6.2 tool_list_deck_versions
  const listRes = await executor.execute('tool_list_deck_versions', { deckId: 'deck_custom_test' });
  assert(Array.isArray(listRes) && listRes.length > 0, 'Agent should list versions');

  // 6.3 tool_batch_update_entities
  const batchUpRes = await executor.execute('tool_batch_update_entities', {
    deckId: 'deck_custom_test',
    updates: [{ id: 'ent_1', answer: 'Updated Answer' }]
  });
  assert(batchUpRes.success === true, 'Agent batch update should succeed');

  // 6.4 tool_patch_deck_guide
  const patchRes = await executor.execute('tool_patch_deck_guide', {
    deckId: 'deck_custom_test',
    operation: 'update_summary',
    summary: 'AI 优化摘要'
  });
  assert(patchRes.guide.summary === 'AI 优化摘要', 'Agent guide patch should succeed');
}

console.log('✅ deck-versioning.test.mjs PASSED!');
