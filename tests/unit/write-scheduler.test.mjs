/**
 * Unit Test: Write Scheduler & Dirty Domain Coalescing
 * Path: tests/unit/write-scheduler.test.mjs
 */

import { WriteScheduler, STORAGE_DOMAINS } from '../../platform/storage/write-scheduler.js';

console.log('🧪 Testing write-scheduler.js (dirty domain tracking & write coalescing)...');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

function createMockStorage() {
  const data = {};
  const writeCounts = {
    profile: 0,
    customDecks: 0,
    activeDeckId: 0,
    maskState: 0,
    deckVersions: 0,
    recycleBin: 0
  };

  return {
    data,
    writeCounts,
    saveProfile(p) { writeCounts.profile++; data.profile = JSON.stringify(p); },
    saveCustomDecks(d) { writeCounts.customDecks++; data.customDecks = JSON.stringify(d); },
    saveActiveDeckId(id) { writeCounts.activeDeckId++; data.activeDeckId = id; },
    saveMaskState(m) { writeCounts.maskState++; data.maskState = m; },
    saveDeckVersions(v) { writeCounts.deckVersions++; data.deckVersions = JSON.stringify(v); },
    saveRecycleBin(r) { writeCounts.recycleBin++; data.recycleBin = JSON.stringify(r); }
  };
}

// 1. 验证基础脏域跟踪与排他性写入
{
  const storage = createMockStorage();
  const scheduler = new WriteScheduler(storage, { debounceMs: 50, maxWaitMs: 200 });

  const mockState = {
    profile: { version: 2, deckStates: { deck_verbs: { totalAttempts: 1 } } },
    customDecks: [{ id: 'd1', title: 'Deck 1', entities: [1, 2, 3] }],
    activeDeckId: 'deck_verbs',
    maskState: true
  };

  scheduler.markDirty(STORAGE_DOMAINS.PROFILE);
  assert(scheduler.isDirty(STORAGE_DOMAINS.PROFILE), 'profile 应被标记为脏');
  assert(!scheduler.isDirty(STORAGE_DOMAINS.CUSTOM_DECKS), 'customDecks 不应被标记为脏');

  scheduler.flush(() => mockState);

  assert(storage.writeCounts.profile === 1, 'profile 应写入 1 次');
  assert(storage.writeCounts.customDecks === 0, '未变动的 customDecks 绝对零写入');
  assert(storage.writeCounts.activeDeckId === 0, 'activeDeckId 零写入');
  assert(!scheduler.isDirty(STORAGE_DOMAINS.PROFILE), '写入后 profile 脏标记应重置');
}

// 2. 验证高频做题防抖与未变题库零序列化 (核心性能防抖用例：100 次答题)
{
  const storage = createMockStorage();
  const scheduler = new WriteScheduler(storage, { debounceMs: 40, maxWaitMs: 150 });

  const largeCustomDecks = Array.from({ length: 10 }, (_, i) => ({
    id: `deck_${i}`,
    title: `题库 ${i}`,
    entities: Array.from({ length: 50 }, (_, j) => ({ id: `e_${j}`, prompt: 'Q', answer: 'A' }))
  }));

  const appState = {
    profile: { version: 2, deckStates: { deck_verbs: { totalAttempts: 0 } } },
    customDecks: largeCustomDecks,
    activeDeckId: 'deck_verbs',
    maskState: true
  };

  // 模拟连续高频答题 100 次，每次只更新 profile
  for (let i = 0; i < 100; i++) {
    appState.profile.deckStates.deck_verbs.totalAttempts++;
    scheduler.markDirty(STORAGE_DOMAINS.PROFILE);
    scheduler.schedule(() => appState);
  }

  // 检查立即统计：防抖合并进行中
  assert(scheduler.metrics.requestedSaves === 100, '应记录 100 次保存请求');
  assert(scheduler.metrics.coalescedCount >= 90, '绝大多数请求应被防抖合并');
  assert(storage.writeCounts.customDecks === 0, '答题中途 customDecks 必须零写入');

  // 等待调度执行完成
  await new Promise(r => setTimeout(r, 200));

  assert(storage.writeCounts.profile >= 1, 'profile 最终应完成提交');
  assert(storage.writeCounts.customDecks === 0, '100 次答题后 customDecks 仍然零写入！');
  assert(JSON.parse(storage.data.profile).deckStates.deck_verbs.totalAttempts === 100, '最终学习进度完整保存，零丢失');
}

// 3. 验证最大等待上限 (maxWait) 保障
{
  const storage = createMockStorage();
  const scheduler = new WriteScheduler(storage, { debounceMs: 50, maxWaitMs: 120 });

  const state = { profile: { total: 0 } };

  // 持续密集触发，超过 maxWaitMs
  const startTime = Date.now();
  let interval = setInterval(() => {
    state.profile.total++;
    scheduler.markDirty(STORAGE_DOMAINS.PROFILE);
    scheduler.schedule(() => state);
  }, 20);

  // 等待 160ms (超过 120ms 的 maxWait)
  await new Promise(r => setTimeout(r, 160));
  clearInterval(interval);

  assert(storage.writeCounts.profile >= 1, '在持续密集操作下，达到 maxWait 仍必须强制刷新落地');
  scheduler.flush(() => state);
}

// 4. 验证手动 immediate 强制同步写入
{
  const storage = createMockStorage();
  const scheduler = new WriteScheduler(storage, { debounceMs: 100, maxWaitMs: 1000 });

  const state = {
    customDecks: [{ id: 'd_new', title: '新增题库' }]
  };

  scheduler.markDirty(STORAGE_DOMAINS.CUSTOM_DECKS);
  scheduler.schedule(() => state, { immediate: true });

  assert(storage.writeCounts.customDecks === 1, 'immediate 模式应无延迟同步落地');
  assert(!scheduler.hasPendingWrites(), 'immediate 模式执行后无挂起脏写');
}

console.log('✅ write-scheduler.test.mjs PASSED!');
