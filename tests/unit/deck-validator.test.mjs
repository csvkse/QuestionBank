import assert from 'assert';
import { validateDeckHealth } from '../../shared/deck-validator.js';

console.log('🧪 Testing deck-validator.js...');

// 1. 合法题库
const validDeck = {
  title: '有效题库',
  categories: [
    { id: 'c1', name: '分类1', group: '分组1' }
  ],
  entities: [
    { id: '1', categoryId: 'c1', title: 'A', answer: 'AnsA' },
    { id: '2', categoryId: 'c1', title: 'B', answer: 'AnsB' },
    { id: '3', categoryId: 'c1', title: 'C', answer: 'AnsC' },
    { id: '4', categoryId: 'c1', title: 'D', answer: 'AnsD' }
  ]
};

const res1 = validateDeckHealth(validDeck);
assert.strictEqual(res1.valid, true);
assert.strictEqual(res1.errors.length, 0);
assert.strictEqual(res1.thinCategories.length, 0);

// 2. 标题为空硬阻断
const invalidDeckTitle = { ...validDeck, title: '' };
const res2 = validateDeckHealth(invalidDeckTitle);
assert.strictEqual(res2.valid, false);
assert(res2.errors.some(e => e.includes('标题不能为空')));

// 3. 词条少于 4 条硬阻断
const invalidDeckCount = { ...validDeck, entities: [{ id: '1', categoryId: 'c1', title: 'A', answer: '1' }] };
const res3 = validateDeckHealth(invalidDeckCount);
assert.strictEqual(res3.valid, false);
assert(res3.errors.some(e => e.includes('至少 4 条')));

// 4. 薄弱分类警告 (总数>=4但分类2仅有1条)
const thinDeck = {
  title: '含薄弱分类',
  categories: [
    { id: 'c1', name: '分类1', group: '分组1' },
    { id: 'c2', name: '分类2', group: '分组1' }
  ],
  entities: [
    { id: '1', categoryId: 'c1', title: 'A', answer: 'AnsA' },
    { id: '2', categoryId: 'c1', title: 'B', answer: 'AnsB' },
    { id: '3', categoryId: 'c1', title: 'C', answer: 'AnsC' },
    { id: '4', categoryId: 'c1', title: 'D', answer: 'AnsD' },
    { id: '5', categoryId: 'c2', title: 'E', answer: 'AnsE' }
  ]
};
const res4 = validateDeckHealth(thinDeck);
assert.strictEqual(res4.valid, true); // 仍可保存，但有警告
assert.strictEqual(res4.thinCategories.length, 1);
assert.strictEqual(res4.thinCategories[0].name, '分类2');
assert(res4.warnings.some(w => w.includes('薄弱分类')));

console.log('✅ deck-validator.test.mjs PASSED!');
