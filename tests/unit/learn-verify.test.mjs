/**
 * Unit Test: Learn & Verify Feature Suite
 * Test: tests/unit/learn-verify.test.mjs
 */

import assert from 'assert';
import {
  LearnVerifyStateMachine,
  LearnVerifyState,
  LearnVerifyNodeAdapter,
  HierarchicalLayerProgressionStrategy,
  CategoryMasteryProgressionStrategy,
  SiblingChoiceVerificationStrategy
} from '../../features/learn-verify/index.js';
import { BUILTIN_DECKS } from '../../shared/builtin-decks.js';

console.log('🧪 Testing Learn & Verify (FSM, Adapters, Strategies)...');

const demoDeck = BUILTIN_DECKS[0]; // 英语动词形态
const demoDeckState = {
  cards: {
    'v_picnic': { level: 0, attempts: 0, correct: 0, wrong: 0 },
    'v_panic': { level: 2, attempts: 3, correct: 2, wrong: 1 }
  }
};

// 1. 测试 LearnVerifyNodeAdapter
{
  const picnicEntity = demoDeck.entities.find(e => e.id === 'v_picnic');
  const node = LearnVerifyNodeAdapter.adapt(picnicEntity, demoDeck, demoDeckState);

  assert.strictEqual(node.id, 'v_picnic');
  assert.strictEqual(node.title, 'picnic');
  assert.strictEqual(node.isNew, true, 'picnic should be identified as new');
  assert.strictEqual(node.layer, 3);
  assert.strictEqual(node.encoding.answer, 'picnicked');
  assert.ok(Array.isArray(node.verification.options), 'Verification should have options array');
  assert.strictEqual(node.verification.options.length, 4, 'Verification should have 4 options');
  assert.ok(node.verification.options.includes('picnicked'), 'Options must contain correct answer');
  console.log('  ✓ LearnVerifyNodeAdapter correctly adapts entity');
}

// 2. 测试策略模式
{
  const strategyL3 = new HierarchicalLayerProgressionStrategy(3, { maxQuota: 5 });
  const nodesL3 = strategyL3.prepareNodes(demoDeck, demoDeckState);
  assert.ok(nodesL3.length > 0, 'Layer 3 nodes should not be empty');
  assert.ok(nodesL3.every(n => n.layer === 3), 'All prepared nodes must belong to Layer 3');
  // picnic (level 0) 应该排在 panic (level 2) 前面
  const picnicIdx = nodesL3.findIndex(n => n.id === 'v_picnic');
  const panicIdx = nodesL3.findIndex(n => n.id === 'v_panic');
  if (picnicIdx !== -1 && panicIdx !== -1) {
    assert.ok(picnicIdx < panicIdx, 'New node should be prioritized over practiced node');
  }

  assert.strictEqual(strategyL3.canUnlockNextTier({ accuracy: 80 }), true);
  assert.strictEqual(strategyL3.canUnlockNextTier({ accuracy: 75 }), false);

  const catStrategy = new CategoryMasteryProgressionStrategy('CAT_IC_SPECIAL');
  const catNodes = catStrategy.prepareNodes(demoDeck, demoDeckState);
  assert.ok(catNodes.length > 0, 'Category nodes should be populated');
  assert.ok(catNodes.every(n => n.categoryId === 'CAT_IC_SPECIAL'), 'Category nodes must belong to target category');
  console.log('  ✓ Progression Strategies prepare queues and check gates correctly');
}

// 3. 测试 SiblingChoiceVerificationStrategy
{
  const quizStrategy = new SiblingChoiceVerificationStrategy();
  assert.strictEqual(quizStrategy.evaluate('picnicked', 'picnicked'), true);
  assert.strictEqual(quizStrategy.evaluate(' PICNICKED ', 'picnicked'), true);
  assert.strictEqual(quizStrategy.evaluate('picniced', 'picnicked'), false);
  console.log('  ✓ SiblingChoiceVerificationStrategy evaluates answers accurately');
}

// 4. 测试状态机正常流转 (Happy Path)
{
  const mockNodes = [
    {
      id: 'node_1',
      title: 'Node 1',
      encoding: { answer: 'Answer 1' },
      verification: { options: ['Answer 1', 'Option 2', 'Option 3', 'Option 4'] }
    },
    {
      id: 'node_2',
      title: 'Node 2',
      encoding: { answer: 'Answer 2' },
      verification: { options: ['Answer 2', 'Option 2', 'Option 3', 'Option 4'] }
    }
  ];

  let transitionLog = [];
  const fsm = new LearnVerifyStateMachine({
    nodes: mockNodes,
    onTransition: (t) => transitionLog.push(`${t.from}->${t.to}`)
  });

  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.IDLE);
  fsm.start();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.ENCODING);
  assert.strictEqual(fsm.getCurrentNode().id, 'node_1');

  fsm.startVerification();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.VERIFYING);

  // 提交正确答案
  fsm.submitAnswer(true, { selectedAnswer: 'Answer 1' });
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.NODE_ADVANCE);

  // 推进到下一个节点
  fsm.proceedFromAdvance();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.ENCODING);
  assert.strictEqual(fsm.getCurrentNode().id, 'node_2');

  fsm.startVerification();
  fsm.submitAnswer(true, { selectedAnswer: 'Answer 2' });
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.NODE_ADVANCE);

  // 所有节点完成，进入通关门禁
  fsm.proceedFromAdvance();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.TIER_CHECKPOINT);
  assert.strictEqual(fsm.getFirstAttemptAccuracy(), 100);

  fsm.completeSession();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.COMPLETED);
  console.log('  ✓ LearnVerifyStateMachine Happy Path verified');
}

// 5. 测试错题就地干预与末尾回环 (Remediation Re-queue & First Attempt Accuracy)
{
  const mockNodes = [
    {
      id: 'node_a',
      title: 'Node A',
      encoding: { answer: 'A_ANS' },
      verification: { options: ['A_ANS', 'A_TRAP'] }
    },
    {
      id: 'node_b',
      title: 'Node B',
      encoding: { answer: 'B_ANS' },
      verification: { options: ['B_ANS', 'B_TRAP'] }
    }
  ];

  const fsm = new LearnVerifyStateMachine({ nodes: mockNodes });
  fsm.start(); // node_a in ENCODING
  fsm.startVerification();

  // 模拟 node_a 首次答错
  fsm.submitAnswer(false, { selectedAnswer: 'A_TRAP' });
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.REMEDIATION);
  assert.strictEqual(fsm.retryQueue.length, 1, 'Failed node should be queued in retryQueue');

  // 继续
  fsm.proceedFromRemediation();
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.ENCODING);
  assert.strictEqual(fsm.getCurrentNode().id, 'node_b');

  // node_b 答对
  fsm.startVerification();
  fsm.submitAnswer(true, { selectedAnswer: 'B_ANS' });
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.NODE_ADVANCE);
  fsm.proceedFromAdvance();

  // 此时 primaryQueue 已空，自动从 retryQueue 弹出 node_a 压轴复查！
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.ENCODING);
  assert.strictEqual(fsm.getCurrentNode().id, 'node_a', 'Retried node_a must re-appear');

  // 第二次答对
  fsm.startVerification();
  fsm.submitAnswer(true, { selectedAnswer: 'A_ANS' });
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.NODE_ADVANCE);
  fsm.proceedFromAdvance();

  // 全部清空，进入 TIER_CHECKPOINT
  assert.strictEqual(fsm.getCurrentState(), LearnVerifyState.TIER_CHECKPOINT);
  // 首次作答统计：node_a 错，node_b 对 -> 正确率 1 / 2 = 50%
  assert.strictEqual(fsm.getFirstAttemptAccuracy(), 50);
  console.log('  ✓ Intra-session Error Recycling & Accuracy tracking verified');
}

// 6. 测试非法跳转防御
{
  const fsm = new LearnVerifyStateMachine({ nodes: [{ id: 'n1', encoding: { answer: '1' } }] });
  fsm.start();
  assert.throws(() => {
    fsm.submitAnswer(true); // 在 ENCODING 态直接提交是非法的
  }, /Illegal submitAnswer/);
  console.log('  ✓ State Machine rejects illegal transitions');
}

console.log('✅ Learn & Verify Unit Tests PASSED!\n');
