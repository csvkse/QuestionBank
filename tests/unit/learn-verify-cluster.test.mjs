/**
 * Unit Tests: Micro-Topic Cluster Learn & Verify Engine
 * Tests/unit/learn-verify-cluster.test.mjs
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 * Strict compliance with FE-SEC-001: Zero real credentials.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TopicCapsuleAdapter,
  KnowledgeCapsule,
  InterleavedClusterQuizStrategy,
  TaxonomyCapsuleProgressionStrategy,
  TopicClusterStateMachine,
  ClusterState
} from '../../features/learn-verify/index.js';

const mockDeck = {
  id: 'test_deck_cluster',
  title: '计算机网络核心考点',
  entities: [
    { id: 'http_200', title: '200 OK', answer: '请求成功并返回实体', group: '网络协议', category: 'HTTP状态码', layer: 1, explanation: '最标准的成功响应' },
    { id: 'http_301', title: '301 Moved Permanently', answer: '永久重定向，更新搜索引擎权重', group: '网络协议', category: 'HTTP状态码', layer: 1, explanation: '旧 URL 永久下线' },
    { id: 'http_404', title: '404 Not Found', answer: '服务器无法找到请求的资源', group: '网络协议', category: 'HTTP状态码', layer: 1, explanation: '客户端路径拼写错误或资源已被删除' },
    { id: 'http_500', title: '500 Internal Error', answer: '服务器内部遇到未捕获异常', group: '网络协议', category: 'HTTP状态码', layer: 1, explanation: '服务端代码崩溃' },
    { id: 'tcp_handshake', title: 'TCP三次握手', answer: '建立面向连接的可靠传输会话', group: '网络协议', category: '传输层', layer: 1, explanation: 'SYN, SYN-ACK, ACK' }
  ]
};

test('Learn & Verify Micro-Topic Cluster Suite', async (t) => {
  await t.test('TopicCapsuleAdapter correctly constructs KnowledgeCapsule and Comparative Matrix', () => {
    const httpEntities = mockDeck.entities.slice(0, 4);
    const capsule = TopicCapsuleAdapter.adapt('HTTP状态码', 1, httpEntities, { cards: {} }, []);

    assert.ok(capsule instanceof KnowledgeCapsule);
    assert.equal(capsule.categoryName, 'HTTP状态码');
    assert.equal(capsule.layer, 1);
    assert.equal(capsule.entities.length, 4);
    assert.equal(capsule.comparativeMatrix.length, 4);

    const firstMatrixItem = capsule.comparativeMatrix[0];
    assert.equal(firstMatrixItem.title, '200 OK');
    assert.equal(firstMatrixItem.answer, '请求成功并返回实体');
    assert.ok(firstMatrixItem.anchor.length > 0);
  });

  await t.test('InterleavedClusterQuizStrategy produces mutual-exclusive sibling options', () => {
    const httpEntities = mockDeck.entities.slice(0, 4);
    const questions = InterleavedClusterQuizStrategy.generateBatch(httpEntities, mockDeck.entities);

    assert.equal(questions.length, 4);
    questions.forEach(q => {
      assert.equal(q.options.length, 4, 'Each question must have 4 options');
      assert.ok(q.options.includes(q.correctAnswer), 'Options must include the correct answer');
      assert.equal(q.options[q.correctIndex], q.correctAnswer);

      // 验证干扰项取自同胞
      const siblingAnswers = httpEntities.map(e => e.answer);
      q.options.forEach(opt => {
        assert.ok(siblingAnswers.includes(opt), `Option "${opt}" should belong to intra-cluster siblings`);
      });
    });
  });

  await t.test('TaxonomyCapsuleProgressionStrategy groups and chunks capsules properly', () => {
    const strategy = new TaxonomyCapsuleProgressionStrategy(1, { maxCapsules: 5 });
    const capsules = strategy.prepareCapsules(mockDeck, { cards: {} });

    assert.ok(capsules.length >= 2, 'Should create capsules for both HTTP状态码 and 传输层');
    const httpCapsule = capsules.find(c => c.categoryName === 'HTTP状态码');
    assert.ok(httpCapsule);
    assert.equal(httpCapsule.entities.length, 4);
    assert.equal(httpCapsule.questions.length, 4);
  });

  await t.test('TopicClusterStateMachine Happy Path (Full Mastery Flow)', () => {
    const httpEntities = mockDeck.entities.slice(0, 3);
    const questions = InterleavedClusterQuizStrategy.generateBatch(httpEntities, mockDeck.entities);
    const capsule = TopicCapsuleAdapter.adapt('HTTP状态码', 1, httpEntities, { cards: {} }, questions);

    let completedStats = null;
    const fsm = new TopicClusterStateMachine({
      capsules: [capsule],
      onCapsuleComplete: (_, stats) => { completedStats = stats; }
    });

    assert.equal(fsm.getCurrentState(), ClusterState.IDLE);
    fsm.start();
    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_ENCODING);

    fsm.startInterleavedQuiz();
    assert.equal(fsm.getCurrentState(), ClusterState.INTERLEAVED_VERIFYING);

    // 连续回答全对
    for (let i = 0; i < questions.length; i++) {
      const q = fsm.getCurrentQuestion();
      const res = fsm.submitInterleavedAnswer(q.correctIndex);
      if (i + 1 < questions.length) {
        assert.equal(res.hasNext, true);
      } else {
        assert.equal(res.hasNext, false);
      }
    }

    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_EVALUATION);
    assert.equal(fsm.remediationQueue.length, 0, 'No remediation needed for 100% accuracy');

    fsm.advanceToCheckpoint();
    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_CHECKPOINT);
    assert.ok(completedStats);
    assert.equal(completedStats.accuracy, 100);

    fsm.nextCapsule();
    assert.equal(fsm.getCurrentState(), ClusterState.SESSION_COMPLETED);
  });

  await t.test('TopicClusterStateMachine Error Remediation Flow', () => {
    const httpEntities = mockDeck.entities.slice(0, 2);
    const questions = InterleavedClusterQuizStrategy.generateBatch(httpEntities, mockDeck.entities);
    const capsule = TopicCapsuleAdapter.adapt('HTTP状态码', 1, httpEntities, { cards: {} }, questions);

    const fsm = new TopicClusterStateMachine({ capsules: [capsule] });
    fsm.start();
    fsm.startInterleavedQuiz();

    // 故意答错第 1 题
    const q1 = fsm.getCurrentQuestion();
    const wrongIdx = (q1.correctIndex + 1) % 4;
    fsm.submitInterleavedAnswer(wrongIdx);

    // 答对第 2 题
    const q2 = fsm.getCurrentQuestion();
    fsm.submitInterleavedAnswer(q2.correctIndex);

    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_EVALUATION);
    assert.equal(fsm.remediationQueue.length, 1, 'Should have 1 question in remediation queue');

    fsm.startRemediation();
    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_REMEDIATION);
    const rem = fsm.getCurrentRemediation();
    assert.ok(rem);
    assert.equal(rem.isCorrect, false);

    fsm.resolveRemediationStep();
    assert.equal(fsm.getCurrentState(), ClusterState.CAPSULE_CHECKPOINT);
  });

  await t.test('TopicClusterStateMachine rejects illegal state transitions', () => {
    const fsm = new TopicClusterStateMachine({ capsules: [] });
    assert.throws(() => fsm.startInterleavedQuiz(), /Illegal state transition/);
    assert.throws(() => fsm.submitInterleavedAnswer(0), /Cannot submit quiz/);
  });
});
