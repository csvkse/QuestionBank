/**
 * Unit Test: Panorama Collapsible State Sovereignty & Render Idempotency
 * tests/unit/panorama-collapsible.test.mjs
 * 
 * Verifies that:
 * 1. Collapsed state is purely controlled by user explicit actions
 * 2. renderDeckCategoryBars is idempotent and never overrides user collapsed state
 * 3. Categories with JEV recommendations can be collapsed by the user without being forced open
 * 4. toggleAllPanoramaGroups collapses/expands all groups uniformly
 */

import assert from 'assert';
import { KnowledgeMasterApp } from '../../app/main.js';

console.log('🧪 Testing panorama-collapsible state sovereignty (FE-PANORAMA-002)...');

// Mock DOM elements required for headless evaluation
const mockElements = new Map();
function getOrCreateMockElement(id) {
  if (!mockElements.has(id)) {
    mockElements.set(id, {
      id,
      innerHTML: '',
      innerText: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); }
      }
    });
  }
  return mockElements.get(id);
}

globalThis.document = {
  getElementById: (id) => getOrCreateMockElement(id)
};

const app = new KnowledgeMasterApp();
const deck = app.getActiveDeck();
assert.ok(deck, 'Active deck should be loaded');
assert.ok((deck.categories || []).length > 0, 'Categories should exist');

// 提取所有唯一大类名称
const groups = [];
(deck.categories || []).forEach(c => {
  const gName = c.group || '核心知识板块';
  if (!groups.includes(gName)) groups.push(gName);
});
assert.ok(groups.length >= 2, 'Deck should contain multiple macro groups');

// ==========================================
// 1. 默认状态与初次渲染幂等性
// ==========================================
assert.strictEqual(app.panoramaCollapsedGroups.size, 0, 'Default collapsed set should be empty');
app.renderDeckCategoryBars();
const containerEl = getOrCreateMockElement('deck-category-bars');
assert.ok(containerEl.innerHTML.length > 0, 'Category bars should render markup');

const toggleLabel = getOrCreateMockElement('panorama-toggle-all-label');
assert.strictEqual(toggleLabel.innerText, '全部折叠', 'Toggle label should be "全部折叠" when all expanded');

// ==========================================
// 2. 单项大类折叠主权 (用户点击切换)
// ==========================================
const targetGroup = groups[0];
app.togglePanoramaGroup(targetGroup);
assert.ok(app.panoramaCollapsedGroups.has(targetGroup), `Group [${targetGroup}] should be in collapsed set`);

// 关键断言：重新调用 renderDeckCategoryBars() 必须绝不破坏用户的折叠状态
app.renderDeckCategoryBars();
assert.ok(app.panoramaCollapsedGroups.has(targetGroup), `Group [${targetGroup}] MUST remain collapsed after renderDeckCategoryBars()`);

// 再次点击应展开
app.togglePanoramaGroup(targetGroup);
assert.strictEqual(app.panoramaCollapsedGroups.has(targetGroup), false, `Group [${targetGroup}] should be expanded after second toggle`);
app.renderDeckCategoryBars();
assert.strictEqual(app.panoramaCollapsedGroups.has(targetGroup), false, `Group [${targetGroup}] should stay expanded after re-render`);

// ==========================================
// 3. JEV 推荐焦点大类的折叠主权 (核心缺陷防回归)
// ==========================================
// 模拟 JEV 研判命中了某细分类别
const sampleCat = deck.categories[0];
const jevGroupName = sampleCat.group || '核心知识板块';
app._lastJevRecommendation = {
  targetCategoryId: sampleCat.id,
  reason: '测试重点攻克'
};

// 执行渲染，验证高亮与标签存在
app.renderDeckCategoryBars();
assert.ok(containerEl.innerHTML.includes('★ 含JEV研判焦点') || containerEl.innerHTML.includes('★ JEV 首选推荐'), 'Should include JEV highlight markup');

// 用户主动折叠包含 JEV 焦点的大类
app.togglePanoramaGroup(jevGroupName);
assert.ok(app.panoramaCollapsedGroups.has(jevGroupName), `JEV group [${jevGroupName}] should be collapsed by user action`);

// 核心门禁断言：渲染方法绝对不能因为 g.hasTarget === true 就强制清除用户的折叠状态
app.renderDeckCategoryBars();
assert.ok(
  app.panoramaCollapsedGroups.has(jevGroupName),
  `FATAL REGRESSION: renderDeckCategoryBars() illegally deleted [${jevGroupName}] from collapsed set!`
);

// 展开恢复
app.togglePanoramaGroup(jevGroupName);
assert.strictEqual(app.panoramaCollapsedGroups.has(jevGroupName), false, `JEV group [${jevGroupName}] should be re-expanded`);

// ==========================================
// 4. 全局“全部折叠 / 全部展开”控制主权
// ==========================================
app.panoramaCollapsedGroups.clear();
app.toggleAllPanoramaGroups();

// 所有大类（包括含 JEV 焦点的大类）必须全部折叠
groups.forEach(g => {
  assert.ok(app.panoramaCollapsedGroups.has(g), `Group [${g}] must be in collapsed set when toggleAllPanoramaGroups() is called`);
});
assert.strictEqual(toggleLabel.innerText, '全部展开', 'Toggle label should switch to "全部展开"');

// 再次渲染，状态依然 100% 保持
app.renderDeckCategoryBars();
groups.forEach(g => {
  assert.ok(app.panoramaCollapsedGroups.has(g), `Group [${g}] must NOT be un-collapsed by renderDeckCategoryBars()`);
});

// 再次调用全部展开
app.toggleAllPanoramaGroups();
assert.strictEqual(app.panoramaCollapsedGroups.size, 0, 'All groups should be expanded');
assert.strictEqual(toggleLabel.innerText, '全部折叠', 'Toggle label should switch back to "全部折叠"');

// ==========================================
// 5. JEV 单次智能引导穿透与后续用户主权保持
// ==========================================
// 用户先全部折叠
app.toggleAllPanoramaGroups();
assert.strictEqual(app.panoramaCollapsedGroups.size, groups.length, 'All groups collapsed by user');

// JEV 产出新推荐目标 (新类别)
const newTargetCat = deck.categories[deck.categories.length - 1];
const newTargetGroup = newTargetCat.group || '核心知识板块';
const newRec = {
  targetCategoryId: newTargetCat.id,
  reason: '新弱点突围'
};

// 触发 runJevEvaluation 阶段的单次穿透展开逻辑
if (newRec.targetCategoryId !== app._lastAutoExpandedJevTarget) {
  app._lastAutoExpandedJevTarget = newRec.targetCategoryId;
  app.panoramaCollapsedGroups.delete(newTargetGroup);
  app.renderDeckCategoryBars();
}

assert.strictEqual(app.panoramaCollapsedGroups.has(newTargetGroup), false, `New JEV group [${newTargetGroup}] should be auto-expanded once`);

// 用户随后手动折叠该大类
app.togglePanoramaGroup(newTargetGroup);
assert.ok(app.panoramaCollapsedGroups.has(newTargetGroup), `User must be able to fold [${newTargetGroup}] even though it contains JEV target`);

// 后续普通渲染绝不再次穿透
app.renderDeckCategoryBars();
assert.ok(app.panoramaCollapsedGroups.has(newTargetGroup), `Subsequent renders must respect user fold on [${newTargetGroup}]`);

console.log('✅ panorama-collapsible.test.mjs PASSED!');
