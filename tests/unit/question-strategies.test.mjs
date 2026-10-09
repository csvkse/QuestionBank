/**
 * Unit Tests: Question Queue Strategies, Specifications, and Distractor Pipeline
 * tests/unit/question-strategies.test.mjs
 */

import assert from 'assert';
import {
  MistakeCardSpecification,
  DueCardSpecification,
  RustyCardSpecification,
  MasteredCardSpecification,
  calculateUnifiedMetrics,
  strategyFactory,
  DailyReviewQueueStrategy,
  WeaknessQueueStrategy,
  CampaignSteppedQueueStrategy,
  CategoryDrillQueueStrategy,
  SandboxCustomQueueStrategy
} from '../../shared/question-strategies/index.js';
import { generateDistractors } from '../../shared/distractor-sampler.js';

console.log('🧪 Testing question-strategies and distractor-pipeline...');

// Mock Deck & Entities
const mockDeck = {
  id: 'deck_test',
  title: '测试动词与状态码混合题库',
  categories: [
    { id: 'cat_ic', name: 'IC 特例', group: '一、规则板块' },
    { id: 'cat_ing', name: 'ING 规则', group: '一、规则板块' },
    { id: 'cat_http', name: 'HTTP 异常', group: '二、网络板块' }
  ],
  entities: [
    { id: 'v1', categoryId: 'cat_ic', layer: 3, title: 'panic', answer: 'panicking', confusedWith: 'v2' },
    { id: 'v2', categoryId: 'cat_ic', layer: 3, title: 'picnic', answer: 'picnicked', confusedWith: 'v1' },
    { id: 'v3', categoryId: 'cat_ic', layer: 3, title: 'mimic', answer: 'mimicking' },
    { id: 'v4', categoryId: 'cat_ic', layer: 3, title: 'frolic', answer: 'frolicking' },
    { id: 'v5', categoryId: 'cat_ing', layer: 1, title: 'work', answer: 'working' },
    { id: 'v6', categoryId: 'cat_ing', layer: 2, title: 'run', answer: 'running' },
    { id: 'h1', categoryId: 'cat_http', layer: 3, title: '401', answer: '未认证', confusedWith: 'h2' },
    { id: 'h2', categoryId: 'cat_http', layer: 3, title: '403', answer: '禁止访问', confusedWith: 'h1' },
    { id: 'h3', categoryId: 'cat_http', layer: 1, title: '404', answer: '资源未找到' },
    { id: 'h4', categoryId: 'cat_http', layer: 1, title: '500', answer: '服务器错误' }
  ]
};

// ==================== 1. 规约模式单元测试 ====================
console.log('  Testing Specifications...');

// 1.1 MistakeCardSpecification
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy(null), false, 'Null card is not mistake');
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy({ attempts: 0, wrong: 0 }), false, 'Unseen card is not mistake');
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy({ attempts: 5, wrong: 0 }), false, 'Zero wrong is not mistake');
// 做错1次，共答10次，错误率10% <= 25%，且 Level 为 2 (>1) -> 判定为已纠正，非错题
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy({ attempts: 10, wrong: 1, level: 2 }), false, 'Low error rate and level 2 is resolved');
// 做错1次，共答2次，错误率50% >= 25% -> 判定为错题
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy({ attempts: 2, wrong: 1, level: 1 }), true, 'High error rate is mistake');
// 做错1次，Level 仅为 1 -> 浅层记忆错题
assert.strictEqual(MistakeCardSpecification.isSatisfiedBy({ attempts: 5, wrong: 1, level: 1 }), true, 'Level <= 1 with wrong is mistake');

// 1.2 DueCardSpecification
const now = Date.now();
assert.strictEqual(DueCardSpecification.isSatisfiedBy(null), false);
assert.strictEqual(DueCardSpecification.isSatisfiedBy({ nextReviewAt: now - 3600000 }, now), true, 'Past timestamp is due');
assert.strictEqual(DueCardSpecification.isSatisfiedBy({ nextReviewAt: now + 86400000 * 5 }, now), false, 'Future timestamp is not due');

// 1.3 calculateUnifiedMetrics
const mockCards = {
  v1: { attempts: 4, correct: 2, wrong: 2, level: 1, nextReviewAt: now - 1000 }, // due, mistake
  v2: { attempts: 6, correct: 6, wrong: 0, level: 4, nextReviewAt: now + 86400000 }, // mastered, not due
  v3: { attempts: 5, correct: 5, wrong: 0, level: 3, nextReviewAt: now - 500 } // due, not mistake
};
const metrics = calculateUnifiedMetrics(mockDeck.entities, mockCards, now);
assert.strictEqual(metrics.dueCount, 2, 'Should have 2 due entities (v1, v3)');
assert.strictEqual(metrics.mistakeCount, 1, 'Should have 1 mistake entity (v1)');
assert.strictEqual(metrics.masteredCount, 1, 'Should have 1 mastered entity (v2)');
assert.strictEqual(metrics.practicedCount, 3, 'Should have 3 practiced entities');

// ==================== 2. 策略工厂与出题排队策略测试 ====================
console.log('  Testing Strategies & Factory...');

// 2.1 Factory Registry & Aliases
const stratDaily = strategyFactory.getStrategy('DAILY_REVIEW');
assert(stratDaily instanceof DailyReviewQueueStrategy, 'Should resolve DailyReviewQueueStrategy');
assert.strictEqual(strategyFactory.getStrategy('daily'), stratDaily, 'Alias daily should resolve same strategy');
assert.strictEqual(strategyFactory.getStrategy('ebbinghaus_review'), stratDaily, 'Alias ebbinghaus_review should resolve');

const stratWeakness = strategyFactory.getStrategy('WEAKNESS');
assert(stratWeakness instanceof WeaknessQueueStrategy, 'Should resolve WeaknessQueueStrategy');
assert.strictEqual(strategyFactory.getStrategy('weakness_surge'), stratWeakness, 'Alias weakness_surge should resolve');

// 2.2 防假兜底防御：0 到期题目时严格返回空数组
const emptyDueCards = {
  v1: { attempts: 1, correct: 1, wrong: 0, level: 3, nextReviewAt: now + 86400000 * 3 },
  v2: { attempts: 1, correct: 1, wrong: 0, level: 3, nextReviewAt: now + 86400000 * 3 }
};
const dailyQueueEmpty = stratDaily.buildQueue({ deck: mockDeck, deckState: { cards: emptyDueCards }, options: { targetTimestamp: now } });
assert.strictEqual(dailyQueueEmpty.length, 0, 'Zero due cards must strictly return empty queue [], never fake fallback');

// 2.3 防假兜底防御：0 错题时严格返回空数组
const zeroMistakeCards = {
  v1: { attempts: 5, correct: 5, wrong: 0, level: 3 }
};
const weakQueueEmpty = stratWeakness.buildQueue({ deck: mockDeck, deckState: { cards: zeroMistakeCards } });
assert.strictEqual(weakQueueEmpty.length, 0, 'Zero mistake cards must strictly return empty queue [], never fake fallback');

// 2.4 弱点攻坚按权重正确排队
const weightedCards = {
  v1: { attempts: 4, correct: 1, wrong: 3, level: 0 }, // 严重错题
  v2: { attempts: 10, correct: 8, wrong: 2, level: 1 }  // 次要错题
};
const weakQueue = stratWeakness.buildQueue({ deck: mockDeck, deckState: { cards: weightedCards } });
assert.strictEqual(weakQueue.length, 2, 'Should pick both mistakes');
assert.strictEqual(weakQueue[0].id, 'v1', 'v1 has higher mistake weight, must be first');

// 2.5 阶梯战役 Layer 过滤与洗牌
const stratStepped = strategyFactory.getStrategy('CAMPAIGN');
assert(stratStepped instanceof CampaignSteppedQueueStrategy);
const steppedQueue = stratStepped.buildQueue({ deck: mockDeck, options: { targetLayer: 1, quota: 8 } });
assert(steppedQueue.every(e => e.layer === 1), 'All items in Tier 1 must belong to layer 1');
assert.strictEqual(steppedQueue.length <= 8, true, 'Queue must adhere to quota limit');

// 2.6 专项速刷上下文快照
const stratDrill = strategyFactory.getStrategy('CATEGORY_DRILL');
assert(stratDrill instanceof CategoryDrillQueueStrategy);
const groupDrillQueue = stratDrill.buildQueue({ deck: mockDeck, options: { filterType: 'group', filterValue: '二、网络板块' } });
assert.strictEqual(groupDrillQueue.length, 4, 'Should precisely pick 4 HTTP entities in group 二、网络板块');
assert(groupDrillQueue.every(e => e.categoryId === 'cat_http'), 'All items must belong to cat_http');

const singleDrillQueue = stratDrill.buildQueue({ deck: mockDeck, options: { filterType: 'single', filterValue: 'v1' } });
assert.strictEqual(singleDrillQueue.length, 1);
assert.strictEqual(singleDrillQueue[0].id, 'v1');

// 2.7 沙盒分层递进模式：同层随机洗牌，跨层顺序递进
const stratSandbox = strategyFactory.getStrategy('SANDBOX_CUSTOM');
assert(stratSandbox instanceof SandboxCustomQueueStrategy);
const sandboxSteppedQueue = stratSandbox.buildQueue({
  deck: mockDeck,
  deckState: { cards: {} },
  options: {
    selectedCategories: new Set(['cat_ic', 'cat_ing', 'cat_http']),
    selectedLayers: new Set([1, 2, 3]),
    trialMode: 'STEPPED',
    questionCount: 10
  }
});
for (let i = 0; i < sandboxSteppedQueue.length - 1; i++) {
  assert(sandboxSteppedQueue[i].layer <= sandboxSteppedQueue[i + 1].layer, 'Layer must be monotonically non-decreasing');
}

// ==================== 3. 干扰项责任链管道测试 ====================
console.log('  Testing Distractor Pipeline...');

// 3.1 激活 confusedWith 强混淆关联
const targetHttp = mockDeck.entities.find(e => e.id === 'h1'); // 401 Unauthorized, confusedWith: 'h2' (403)
const httpOptions = generateDistractors(targetHttp, mockDeck.entities);
assert.strictEqual(httpOptions.length, 4, 'Must output 4 options');
assert(httpOptions.includes('未认证'), 'Must include correct answer');
assert(httpOptions.includes('禁止访问'), 'Must include strong confusedWith answer (403 禁止访问)');
// 确保非语言题库没有拼写 +s, +ed, None of the above
assert(!httpOptions.some(o => o.includes('None of the above') || o.endsWith('s') || o.endsWith('ed')), 'No absurd suffixes in concept deck');

// 3.2 语言变位同形态对齐测试
const targetPanic = mockDeck.entities.find(e => e.id === 'v1'); // panic (panicking, ending with -ing)
const panicOptions = generateDistractors(targetPanic, mockDeck.entities);
assert.strictEqual(panicOptions.length, 4, 'Must output 4 options');
assert(panicOptions.includes('panicking'), 'Must include correct answer panicking');
// 在同胞池中有 frolicking (-ing), mimicking (-ing), working (-ing) 与 picnicked (-ed)
// 语法形态对齐要求：在 -ing 题目中，不能混入 -ed 导致选项一眼秒杀
assert(!panicOptions.includes('picnicked'), 'Must NOT include past tense picnicked in -ing question');

console.log('✅ question-strategies.test.mjs PASSED!');
