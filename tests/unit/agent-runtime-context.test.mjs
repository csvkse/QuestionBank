/**
 * Unit Test: AI Agent Runtime Telemetry & Game Mode Specifications
 * tests/unit/agent-runtime-context.test.mjs
 */

import assert from 'assert';
import { RUNTIME_TOOL_DEFINITIONS } from '../../features/ai-agent/runtime-tool-definitions.js';
import { isRuntimeTool, executeRuntimeTool } from '../../features/ai-agent/runtime-tool-executor.js';
import { DeckToolExecutor } from '../../features/ai-agent/tool-executor.js';
import { BUILTIN_DECKS } from '../../shared/builtin-decks.js';

console.log('🧪 Testing agent-runtime-context.test.mjs (Runtime Telemetry & Mode Specs)...');

// 1. 测试工具定义与模式
assert.strictEqual(RUNTIME_TOOL_DEFINITIONS.length, 2, '必须导出 2 个运行时感知工具');
assert.strictEqual(isRuntimeTool('tool_get_runtime_context'), true);
assert.strictEqual(isRuntimeTool('tool_get_mode_specifications'), true);
assert.strictEqual(isRuntimeTool('tool_create_deck'), false);

// 2. 测试查询模式契约规范 (tool_get_mode_specifications)
const allSpecs = executeRuntimeTool(null, 'tool_get_mode_specifications', { mode: 'ALL' });
assert.strictEqual(allSpecs.status, 'success');
assert.ok(allSpecs.modes.CLUSTER_LEARN_VERIFY, '必须包含微考点学练一体契约');
assert.ok(allSpecs.modes.LADDER, '必须包含天梯模式契约');
assert.ok(allSpecs.modes.FREE_LAB, '必须包含自由沙盒契约');

const clusterSpec = executeRuntimeTool(null, 'tool_get_mode_specifications', { mode: 'CLUSTER_LEARN_VERIFY' });
assert.strictEqual(clusterSpec.status, 'success');
assert.strictEqual(clusterSpec.mode, 'CLUSTER_LEARN_VERIFY');
assert.ok(clusterSpec.specification.structureRequirements.clusterSize.includes('3~5'), '微考点必须包含 3~5 个同胞考点约束');

const invalidSpec = executeRuntimeTool(null, 'tool_get_mode_specifications', { mode: 'NON_EXISTENT' });
assert.strictEqual(invalidSpec.status, 'error');

// 3. 模拟应用运行时态势 (tool_get_runtime_context)
const mockDeck = {
  id: 'deck_mock_1',
  title: '测试微考点图谱',
  categories: [
    { id: 'cat1', name: '传输层协议', group: '网络核心' },
    { id: 'cat2', name: '薄弱单考点', group: '网络核心' }
  ],
  entities: [
    { id: 'e1', categoryId: 'cat1', title: 'TCP', answer: '面向连接' },
    { id: 'e2', categoryId: 'cat1', title: 'UDP', answer: '无连接' },
    { id: 'e3', categoryId: 'cat1', title: 'SCTP', answer: '多流' },
    { id: 'e4', categoryId: 'cat1', title: 'QUIC', answer: '基于UDP' },
    { id: 'e5', categoryId: 'cat2', title: '孤立考点', answer: '无干扰项' } // cat2 仅 1 个考点，为 thinCategory
  ]
};

const mockDeckState = {
  totalAttempts: 20,
  totalCorrect: 16,
  cards: {
    e1: { interval: 5 },
    e2: { interval: 1 } // 属于未牢固掌握
  }
};

const mockApp = {
  currentView: 'dashboard',
  state: { customDecks: [] },
  getAllDecks: () => [mockDeck],
  getActiveDeck: () => mockDeck,
  getDeckState: (id) => (id === mockDeck.id ? mockDeckState : { totalAttempts: 0, totalCorrect: 0, cards: {} }),
  clusterController: {
    fsm: {
      getCurrentCapsule: () => ({
        id: 'cap_trans_1',
        title: 'TCP vs UDP 核心区别',
        categoryName: '传输层协议',
        groupName: '网络核心',
        layer: 1,
        entities: [mockDeck.entities[0], mockDeck.entities[1]]
      }),
      currentQuestionIndex: 1
    }
  }
};

// 4. 测试运行时感知数据完整性
const contextRes = executeRuntimeTool(mockApp, 'tool_get_runtime_context', {});
assert.strictEqual(contextRes.status, 'success');
assert.strictEqual(contextRes.runtime.activeMode, 'CLUSTER_LEARN_VERIFY', '正在进行微考点冲关时必须感知出 CLUSTER_LEARN_VERIFY 模式');
assert.strictEqual(contextRes.runtime.activeCapsule.capsuleId, 'cap_trans_1');
assert.strictEqual(contextRes.runtime.telemetry.accuracyRate, '80%');
assert.strictEqual(contextRes.runtime.telemetry.thinCategoriesCount, 1, 'cat2 考点少于 4 个必须准确识别为薄弱分类');
assert.strictEqual(contextRes.runtime.telemetry.thinCategoriesNotice[0].id, 'cat2');
assert.strictEqual(contextRes.runtime.telemetry.thinCategoriesNotice[0].gap, 3, '距离 4 个考点还差 3 个');

// 5. 测试通过 DeckToolExecutor 统一调度
const executor = new DeckToolExecutor(mockApp);
const execRes = await executor.execute('tool_get_runtime_context', {});
assert.strictEqual(execRes.status, 'success');
assert.strictEqual(execRes.runtime.activeDeck.id, 'deck_mock_1');

const modeRes = await executor.execute('tool_get_mode_specifications', { mode: 'LADDER' });
assert.strictEqual(modeRes.status, 'success');
assert.strictEqual(modeRes.mode, 'LADDER');

console.log('✅ agent-runtime-context.test.mjs PASSED!');
