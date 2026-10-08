import assert from 'assert';
import { generateDistractors, shuffleOptions } from '../../shared/distractor-sampler.js';

console.log('🧪 Testing distractor-sampler.js...');

const testEntities = [
  { id: '1', categoryId: 'c1', answer: 'picnicking' },
  { id: '2', categoryId: 'c1', answer: 'panicking' },
  { id: '3', categoryId: 'c1', answer: 'frolicking' },
  { id: '4', categoryId: 'c1', answer: 'mimicking' },
  { id: '5', categoryId: 'c2', answer: 'running' }
];

// 1. 同胞充足采样
const target = testEntities[0];
const options = generateDistractors(target, testEntities);
assert.strictEqual(options.length, 4, 'Should generate 4 options');
assert(options.includes('picnicking'), 'Must contain the correct answer');

// 2. 选项不重复
const uniqueOptions = new Set(options);
assert.strictEqual(uniqueOptions.size, 4, 'All 4 options must be distinct');

// 3. 数组乱序
const original = [1, 2, 3, 4, 5];
const shuffled = shuffleOptions(original);
assert.strictEqual(shuffled.length, 5);
assert.deepStrictEqual([...shuffled].sort(), original);

console.log('✅ distractor-sampler.test.mjs PASSED!');
