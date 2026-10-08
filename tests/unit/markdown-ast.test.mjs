import assert from 'assert';
import { parseMarkdownToDeck, serializeDeckToMarkdown } from '../../shared/markdown-ast.js';

console.log('🧪 Testing markdown-ast.js...');

const sampleMarkdown = `# ⚡ 英语动词测试库
> 测试用例说明描述

## [分组] 一、规则变化

### [分类] -ic 结尾加 k
#### [Layer 1] 基础认知
- **picnic**: picnicking / picnicked
  - *注记*: 加k规则
  - *考点*: 动词变ing/ed
  - *解析*: picnic -> picnicking
  - *误区*: 容易漏k
  - *混淆*: panic

#### [Layer 2] 规律运用
- **panic**: panicking / panicked
  - *解析*: panic -> panicking
`;

// 1. 解析测试
const deck = parseMarkdownToDeck(sampleMarkdown);
assert.strictEqual(deck.title, '英语动词测试库');
assert.strictEqual(deck.icon, '⚡');
assert.strictEqual(deck.description, '测试用例说明描述');
assert.strictEqual(deck.categories.length, 1);
assert.strictEqual(deck.categories[0].name, '-ic 结尾加 k');
assert.strictEqual(deck.categories[0].group, '一、规则变化');
assert.strictEqual(deck.entities.length, 2);

const ent1 = deck.entities[0];
assert.strictEqual(ent1.title, 'picnic');
assert.strictEqual(ent1.answer, 'picnicking / picnicked');
assert.strictEqual(ent1.layer, 1);
assert.strictEqual(ent1.subtitle, '加k规则');
assert.strictEqual(ent1.pitfalls, '容易漏k');

// 2. 序列化测试与幂等性
const serialized = serializeDeckToMarkdown(deck);
assert(serialized.includes('# ⚡ 英语动词测试库'));
assert(serialized.includes('## [分组] 一、规则变化'));
assert(serialized.includes('### [分类] -ic 结尾加 k'));
assert(serialized.includes('- **picnic**: picnicking / picnicked'));

// 3. 再次解析序列化结果
const roundtripDeck = parseMarkdownToDeck(serialized);
assert.strictEqual(roundtripDeck.title, deck.title);
assert.strictEqual(roundtripDeck.categories[0].name, deck.categories[0].name);
assert.strictEqual(roundtripDeck.categories[0].group, deck.categories[0].group);
assert.strictEqual(roundtripDeck.entities.length, deck.entities.length);

console.log('✅ markdown-ast.test.mjs PASSED!');
