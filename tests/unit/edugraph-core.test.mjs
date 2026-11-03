/**
 * Unit Test: EduGraph-Native 3.0 Core Engine & Assessment Probe Visitors
 * tests/unit/edugraph-core.test.mjs
 */

import assert from 'assert';
import {
  ConceptNode,
  CapsuleNode,
  EduGraphEdge,
  EduGraph,
  InterleavedSprintVisitor,
  DiscriminationProbeVisitor
} from '../../shared/edugraph/index.js';

console.log('🧪 Testing edugraph-core.test.mjs (First-Principles EduGraph 3.0 & Visitors)...');

// 1. 测试 ConceptNode 多模态节点建模
const node301 = new ConceptNode({
  id: 'c_301',
  name: '301 Moved Permanently',
  definition: '永久重定向，搜索引擎将权重完全转移至新 URL',
  phonetics: { text: '301 Moved Permanently', ipa: '/muːvd ˈpɜːrmənəntli/', lang: 'en-US', tts_clean: '301 Moved Permanently' },
  layer: 1,
  properties: { statusFamily: '3xx' }
});

const node302 = new ConceptNode({
  id: 'c_302',
  name: '302 Found',
  definition: '临时重定向，搜索引擎依然保留原 URL 权重',
  phonetics: { text: '302 Found', ipa: '/faʊnd/', lang: 'en-US', tts_clean: '302 Found' },
  layer: 1,
  properties: { statusFamily: '3xx' }
});

const node307 = new ConceptNode({
  id: 'c_307',
  name: '307 Temporary Redirect',
  definition: '严格保持原请求方法 (如 POST 不变) 的临时重定向',
  layer: 2
});

assert.strictEqual(node301.id, 'c_301');
assert.strictEqual(node301.phonetics.lang, 'en-US');
assert.strictEqual(node301.layer, 1);

// 2. 测试 CapsuleNode 一等公民超节点
const capsuleRedirects = new CapsuleNode({
  id: 'cap_redirects_1',
  title: 'HTTP 重定向对偶深度辨析',
  taxonomyId: 'tax_http',
  layer: 1,
  conceptIds: ['c_301', 'c_302', 'c_307']
});
assert.strictEqual(capsuleRedirects.conceptIds.length, 3);

// 3. 测试 EduGraph 属性图构建与 O(1) 索引
const graph = new EduGraph({ id: 'graph_network', title: '计算机网络核心图谱' });
graph.addNode(node301);
graph.addNode(node302);
graph.addNode(node307);
graph.addCapsule(capsuleRedirects);

// 添加对偶对比边
graph.addEdge({
  source: 'c_301',
  target: 'c_302',
  type: 'CONTRASTS_WITH',
  properties: { dimension: '重定向持久性 (永久 vs 临时)' }
});

graph.addEdge({
  source: 'c_302',
  target: 'c_307',
  type: 'CONTRASTS_WITH',
  properties: { dimension: '请求方法是否允许被客户端修改为 GET' }
});

// O(1) 邻接查询
const contrastSiblingsOf301 = graph.getContrastSiblings('c_301');
assert.strictEqual(contrastSiblingsOf301.length, 1);
assert.strictEqual(contrastSiblingsOf301[0].id, 'c_302');

// 4. 测试悬垂边防御门禁 (Dangling Edge Guard)
assert.throws(() => {
  graph.addEdge({ source: 'c_301', target: 'c_non_existent', type: 'CONTRASTS_WITH' });
}, /悬垂边拒绝/, '向不存在的节点连边必须被强行拦截');

// 5. 测试 Kahn 算法拓扑死锁防御门禁 (DAG Cycle Deadlock Guard)
const nodeA = graph.addNode({ id: 'node_A', name: 'TCP 协议基础' });
const nodeB = graph.addNode({ id: 'node_B', name: 'HTTP 协议基础' });
const nodeC = graph.addNode({ id: 'node_C', name: 'WebSocket 双向通信' });

graph.addEdge({ source: 'node_A', target: 'node_B', type: 'PREREQUISITE_OF' }); // A -> B
graph.addEdge({ source: 'node_B', target: 'node_C', type: 'PREREQUISITE_OF' }); // B -> C

// 验证自环防御 (A -> A)
assert.throws(() => {
  graph.addEdge({ source: 'node_A', target: 'node_A', type: 'PREREQUISITE_OF' });
}, /拓扑死锁/, '自前置依赖环路必须被拒绝');

// 验证多跳闭环防御 (C -> A 导致 A -> B -> C -> A)
assert.throws(() => {
  graph.addEdge({ source: 'node_C', target: 'node_A', type: 'PREREQUISITE_OF' });
}, /拓扑死锁/, '多日前置依赖闭环必须被立即检测并拒绝');

// 6. 测试级联一致性删除 (Cascading Mutation Policy)
assert.strictEqual(graph.nodes.has('node_B'), true);
graph.removeNode('node_B');
assert.strictEqual(graph.nodes.has('node_B'), false);
// 验证关联边自动熔断
assert.strictEqual(graph.getPrerequisites('node_C').length, 0, '删除 B 后，C 的前置依赖必须自动熔断');
assert.strictEqual(graph.outgoing.get('node_A').filter(e => e.target === 'node_B').length, 0, '删除 B 后，A 的出度边必须清理');

// 7. 测试 Visitor Pattern: InterleavedSprintVisitor 题目探针编译器
const sprintVisitor = new InterleavedSprintVisitor('cap_redirects_1');
const probes = graph.accept(sprintVisitor);
assert.strictEqual(probes.length, 3, '交错冲关必须为胶囊内 3 个概念动态生成 3 道题');
probes.forEach(probe => {
  assert.strictEqual(probe.options.length, 3, '干扰项必须来自同胞概念');
  assert.strictEqual(probe.options.includes(probe.correctAnswer), true);
  assert.strictEqual(probe.options[probe.correctIndex], probe.correctAnswer);
});

// 8. 测试 Visitor Pattern: DiscriminationProbeVisitor 对偶辨析探针
const contrastVisitor = new DiscriminationProbeVisitor('c_301', 'c_302');
const discriminationProbe = graph.accept(contrastVisitor);
assert.strictEqual(discriminationProbe.type, 'DISCRIMINATION_PROBE');
assert.strictEqual(discriminationProbe.dimension, '重定向持久性 (永久 vs 临时)');
assert.ok(discriminationProbe.prompt.includes('重定向持久性'));

console.log('✅ edugraph-core.test.mjs PASSED!');
