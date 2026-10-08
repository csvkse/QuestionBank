import assert from 'assert';
import { calculateNextReview, calculateDeckCoverage } from '../../shared/sm2-scheduler.js';

console.log('🧪 Testing sm2-scheduler.js...');

// 1. 首次正确答题
const card0 = { level: 0, attempts: 0, correct: 0, wrong: 0 };
const updated1 = calculateNextReview(card0, true);
assert.strictEqual(updated1.attempts, 1);
assert.strictEqual(updated1.correct, 1);
assert.strictEqual(updated1.level, 1);
assert(updated1.nextReviewAt > Date.now());

// 2. 连续答对升级
const updated2 = calculateNextReview(updated1, true);
assert.strictEqual(updated2.level, 2);
assert.strictEqual(updated2.correct, 2);

// 3. 答错降级与惩罚
const updated3 = calculateNextReview(updated2, false);
assert.strictEqual(updated3.wrong, 1);
assert.strictEqual(updated3.level, 1);
assert(updated3.nextReviewAt <= Date.now() + 5 * 3600 * 1000);

// 4. 覆盖率统计
const sampleEntities = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }];
const cardStates = {
  e1: { attempts: 2, level: 4 },
  e2: { attempts: 1, level: 1 }
};
const stats = calculateDeckCoverage(sampleEntities, cardStates);
assert.strictEqual(stats.total, 4);
assert.strictEqual(stats.practiced, 2);
assert.strictEqual(stats.mastered, 1);
assert.strictEqual(stats.coveragePercent, 50);

console.log('✅ sm2-scheduler.test.mjs PASSED!');
