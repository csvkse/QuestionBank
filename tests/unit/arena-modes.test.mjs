/**
 * Unit Test: Sandbox & Stepped Progress Logic
 * tests/unit/arena-modes.test.mjs
 */

import assert from 'assert';
import { SandboxConfigController } from '../../features/arena/sandbox-config.js';
import { SteppedProgressController, TIERS } from '../../features/arena/stepped-progress.js';

console.log('🧪 Testing sandbox-config.js and stepped-progress.js...');

// Mock Deck & App
const mockDeck = {
  id: 'deck_test',
  title: '测试题库',
  categories: [
    { id: 'cat_1', name: '分类一', group: '分组A' },
    { id: 'cat_2', name: '分类二', group: '分组B' }
  ],
  entities: [
    { id: 'e1', categoryId: 'cat_1', layer: 1, title: 'Item 1', answer: 'Ans 1' },
    { id: 'e2', categoryId: 'cat_1', layer: 2, title: 'Item 2', answer: 'Ans 2' },
    { id: 'e3', categoryId: 'cat_2', layer: 1, title: 'Item 3', answer: 'Ans 3' },
    { id: 'e4', categoryId: 'cat_2', layer: 3, title: 'Item 4', answer: 'Ans 4' },
    { id: 'e5', categoryId: 'cat_2', layer: 2, title: 'Item 5', answer: 'Ans 5' }
  ]
};

const mockApp = {
  getActiveDeck: () => mockDeck,
  getDeckState: () => ({ cards: { e3: { wrong: 2, level: 1 }, e1: { wrong: 0, level: 4 } } }),
  startSession: (mode, queue) => { mockApp.lastSession = { mode, queue }; },
  lastSession: null
};

// 1. Sandbox Config Test
const sandbox = new SandboxConfigController(mockApp);
sandbox.selectedCategories = new Set(['cat_1', 'cat_2']);
sandbox.selectedLayers = new Set([1, 2, 3]);

// 全部匹配 5 题
let matched = sandbox.getMatchedEntities();
assert.strictEqual(matched.length, 5, 'Initially all 5 entities should match');

// 过滤仅保留 cat_1
sandbox.toggleCategory('cat_2', false);
matched = sandbox.getMatchedEntities();
assert.strictEqual(matched.length, 2, 'Only cat_1 entities (2 items) should match');

// 过滤仅保留 Layer 1
sandbox.toggleLayer(2, false);
sandbox.toggleLayer(3, false);
matched = sandbox.getMatchedEntities();
assert.strictEqual(matched.length, 1, 'Only cat_1 + Layer 1 (1 item) should match');
assert.strictEqual(matched[0].id, 'e1', 'Should match e1');

// 测试参考知识精读的业务大组批量选择
sandbox.selectedCategories = new Set(['cat_1', 'cat_2']);
sandbox.selectedLayers = new Set([1, 2, 3]);
sandbox.selectGroupCategories('分组B', false);
assert.strictEqual(sandbox.selectedCategories.has('cat_2'), false, '分组B下的 cat_2 应被取消勾选');
assert.strictEqual(sandbox.selectedCategories.has('cat_1'), true, '分组A下的 cat_1 应仍保留');
sandbox.selectGroupCategories('分组B', true);
assert.strictEqual(sandbox.selectedCategories.has('cat_2'), true, '分组B下的 cat_2 应被重新勾选');

// 测试根据大类/小类快速打开沙盒并预选对应选项
sandbox.openModalForGroup('分组A');
assert.strictEqual(sandbox.selectedCategories.has('cat_1'), true, '大类快速打开应预选分组A中的 cat_1');
assert.strictEqual(sandbox.selectedCategories.has('cat_2'), false, '大类快速打开不应包含其他分组的 cat_2');
assert.strictEqual(sandbox.getMatchedEntities().length, 2, '分组A应精准匹配其名下的 2 道词条');

sandbox.openModalForCategory('cat_2');
assert.strictEqual(sandbox.selectedCategories.has('cat_2'), true, '小类快速打开应预选 cat_2');
assert.strictEqual(sandbox.selectedCategories.has('cat_1'), false, '小类快速打开不应包含其他小类');
assert.strictEqual(sandbox.getMatchedEntities().length, 3, 'cat_2 应精准匹配其名下的 3 道词条');

// 测试沙盒四大试炼模式 (默认、弱点、分层、极速)
// 1) 分层模式测试 (按 Layer 1 -> Layer 2 -> Layer 3 排序)
sandbox.setTrialMode('STEPPED');
let steppedQueue = sandbox.buildQueue(sandbox.getMatchedEntities());
assert.strictEqual(steppedQueue[0].layer <= steppedQueue[1].layer, true, '分层模式首题层级应不大于后续题目');
assert.strictEqual(sandbox.isShuffle, false, '分层模式应自动取消乱序');

// 2) 弱点模式测试 (错题优先排在前面)
sandbox.setTrialMode('WEAKNESS');
let weaknessQueue = sandbox.buildQueue(sandbox.getMatchedEntities());
assert.strictEqual(weaknessQueue[0].id, 'e3', '错题 e3 应被排在第一位');

// 3) 极速模式测试 (分派 SPEED_SPRINT 模式)
sandbox.setTrialMode('SPEED_SPRINT');
sandbox.startCustomQuiz();
assert.strictEqual(mockApp.lastSession.mode, 'SPEED_SPRINT', '极速模式必须分派 SPEED_SPRINT 会话');

// 4) 默认模式测试 (分派 FREE_LAB 模式)
sandbox.setTrialMode('DEFAULT');
sandbox.startCustomQuiz();
assert.strictEqual(mockApp.lastSession.mode, 'FREE_LAB', '默认模式必须分派 FREE_LAB 会话');

// 2. Stepped Progress Test
const stepped = new SteppedProgressController(mockApp);
assert.strictEqual(stepped.currentTier, 1, 'Initial tier should be 1');
assert.strictEqual(stepped.unlockedTiers.has(1), true, 'Tier 1 should be unlocked');
assert.strictEqual(stepped.unlockedTiers.has(2), false, 'Tier 2 should be initially locked');

// 测试未达 80% 晋级失败
mockApp.currentMode = 'CAMPAIGN';
let resultFail = stepped.evaluateTierResult(5, 10); // 50%
assert.strictEqual(resultFail.isPromoted, false, '50% should not promote');
assert.strictEqual(stepped.unlockedTiers.has(2), false, 'Tier 2 should still be locked');

// 测试达到 80% 晋级成功
let resultPass = stepped.evaluateTierResult(8, 10); // 80%
assert.strictEqual(resultPass.isPromoted, true, '80% should promote');
assert.strictEqual(resultPass.nextTier, 2, 'Next tier should be 2');
assert.strictEqual(stepped.unlockedTiers.has(2), true, 'Tier 2 should now be unlocked');

// 测试 Tier 3 登顶
stepped.currentTier = 3;
let resultFinal = stepped.evaluateTierResult(9, 10); // 90%
assert.strictEqual(resultFinal.isPromoted, true, 'Tier 3 at 90% should pass');
assert.strictEqual(resultFinal.nextTier, null, 'Tier 3 has no further next tier');

console.log('✅ arena-modes.test.mjs PASSED!');
