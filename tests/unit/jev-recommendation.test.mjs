import assert from 'assert';

// Mock localStorage for Node.js unit test runtime
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.get(k) || null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear()
};

import { JevClient, DEFAULT_JEV_CONFIG } from '../../features/jev/index.js';

console.log('🧪 Testing jev-recommendation (JevClient & heuristics)...');

// 1. 测试默认配置与初始化
{
  memStore.clear();
  const client = new JevClient();
  const config = client.getConfig();

  assert.strictEqual(config.enabled, false, '默认远程接口必须为关闭状态');
  assert.strictEqual(config.fallbackPolicy, 'heuristic', '默认降级策略必须为本地启发式推荐');
  assert.strictEqual(config.endpoint, '', '默认端点必须为空');
}

// 2. 测试本地启发式推荐核心风险矩阵 (Heuristic Evaluation)
{
  memStore.clear();
  const client = new JevClient();

  const mockPanorama = [
    {
      id: 'cat_healthy',
      name: '规则健全模块',
      total: 30,
      learned: 28,
      mastered: 25,
      dueCount: 0,
      mistakeCount: 0,
      coveragePercent: 93
    },
    {
      id: 'cat_high_risk',
      name: '危机板块 (高到期+高错题)',
      total: 30,
      learned: 15,
      mastered: 2,
      dueCount: 8,
      mistakeCount: 6,
      coveragePercent: 50
    },
    {
      id: 'cat_newbie',
      name: '未开拓新模块',
      total: 20,
      learned: 2,
      mastered: 0,
      dueCount: 0,
      mistakeCount: 0,
      coveragePercent: 10
    }
  ];

  const rec = client.runHeuristicEvaluation(mockPanorama, { id: 'test_deck', title: '测试题库' });
  assert.ok(rec, '必须生成推荐结果');
  assert.strictEqual(rec.targetCategoryId, 'cat_high_risk', '风险最高的板块必须被优先推荐');
  assert.strictEqual(rec.urgency, 'HIGH', '高到期高错题板块紧急度必须为 HIGH');
  assert.strictEqual(rec.suggestedAction, 'sandbox', '推荐行为必须为 sandbox');
  assert.ok(rec.reason.includes('8 个待复习点') || rec.reason.includes('6 处错题'), '原因描述必须包含具体数据指标');
}

// 3. 测试规约：“若没配置 Jev 且设为不推荐 (silent)，则返回 null”
{
  memStore.clear();
  const client = new JevClient();
  client.saveConfig({ enabled: false, fallbackPolicy: 'silent' });

  const mockPanorama = [
    { id: 'cat_1', name: '模块一', total: 10, learned: 5, dueCount: 2, mistakeCount: 1 }
  ];

  const rec = await client.evaluate(mockPanorama, { id: 'deck_1' });
  assert.strictEqual(rec, null, '未配置 JEV 且 policy 为 silent 时，必须返回 null (不推荐)');
}

// 4. 测试规约：“若没配置 Jev 但采用降级方案 (heuristic)，自动输出本地推荐”
{
  memStore.clear();
  const client = new JevClient();
  client.saveConfig({ enabled: false, fallbackPolicy: 'heuristic' });

  const mockPanorama = [
    { id: 'cat_1', name: '薄弱语法', total: 20, learned: 5, mastered: 1, dueCount: 5, mistakeCount: 3, coveragePercent: 25 }
  ];

  const rec = await client.evaluate(mockPanorama, { id: 'deck_1' });
  assert.ok(rec, '未配置 JEV 时采用降级方案必须输出推荐');
  assert.strictEqual(rec.isFallback, true, 'isFallback 必须为 true');
  assert.strictEqual(rec.source, 'heuristic', 'source 必须为 heuristic');
  assert.strictEqual(rec.targetCategoryId, 'cat_1', '目标分类 ID 必须匹配');
}

// 5. 测试配置保存、重置与持久化
{
  memStore.clear();
  const client = new JevClient();
  client.saveConfig({
    enabled: true,
    endpoint: 'https://api.my-jev.com/recommend',
    apiKey: 'sk-test-token-1234',
    fallbackPolicy: 'silent'
  });

  const updatedConfig = client.getConfig();
  assert.strictEqual(updatedConfig.enabled, true);
  assert.strictEqual(updatedConfig.endpoint, 'https://api.my-jev.com/recommend');
  assert.strictEqual(updatedConfig.apiKey, 'sk-test-token-1234');
  assert.strictEqual(updatedConfig.fallbackPolicy, 'silent');

  // 跨实例读取持久化
  const client2 = new JevClient();
  assert.strictEqual(client2.getConfig().endpoint, 'https://api.my-jev.com/recommend');

  // 重置
  client2.resetConfig();
  assert.strictEqual(client2.getConfig().enabled, false);
  assert.strictEqual(client2.getConfig().fallbackPolicy, 'heuristic');
}

// 6. 测试纯前端零后端模式 (Zero Backend Pure Client-Side Mode)
{
  const client = new JevClient();
  const target = 'https://api.typesafe.ai/v1/systemone';
  
  // 默认零后端直连：返回原始 URL，不依赖任何本地 proxy
  const resolvedDirect = client.buildEndpointUrl(target);
  assert.strictEqual(resolvedDirect, target, '纯前端模式下默认直接直连目标端点，不依赖任何本地后端');

  // 配置可选云端代理前缀 (如 Cloudflare Worker)
  client.saveConfig({ corsProxyPrefix: 'https://my-worker.workers.dev/?url=' });
  const resolvedProxied = client.buildEndpointUrl(target);
  assert.strictEqual(
    resolvedProxied,
    `https://my-worker.workers.dev/?url=${encodeURIComponent(target)}`,
    '配置云端代理前缀时正确拼装'
  );
}

// 7. 测试自定义 JEV 模型配置与默认模型
{
  memStore.clear();
  const client = new JevClient();
  assert.strictEqual(client.getConfig().model, 'jev-latest', '默认模型必须为 jev-latest');

  client.saveConfig({ model: 'jev-preview' });
  assert.strictEqual(client.getConfig().model, 'jev-preview', '支持保存并读取自定义模型 jev-preview');

  client.saveConfig({ model: 'my-custom-jev' });
  assert.strictEqual(client.getConfig().model, 'my-custom-jev', '支持保存任意自定义模型标识');
}

// 8. 测试 TypeSafe SystemOne 协议交互 (testConnection 与 evaluate)
{
  memStore.clear();
  const client = new JevClient();
  const originalFetch = globalThis.fetch;

  let lastFetchUrl = '';
  let lastFetchBody = null;
  let lastFetchHeaders = null;

  globalThis.fetch = async (url, options) => {
    lastFetchUrl = url;
    lastFetchHeaders = options?.headers || {};
    lastFetchBody = JSON.parse(options?.body || '{}');

    // SystemOne 握手测试响应
    if (lastFetchBody.questions?.ping) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: lastFetchBody.model,
          answers: { ping: { type: 'noul', value: true } }
        })
      };
    }

    // SystemOne 推荐响应
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: lastFetchBody.model,
        answers: {
          target_category: {
            type: 'choice',
            choice: 'cat_high_risk',
            confidence: 0.96
          },
          urgency: {
            type: 'choice',
            choice: 'HIGH',
            confidence: 0.9
          }
        }
      })
    };
  };

  try {
    // 8.1 testConnection 测试
    const connResult = await client.testConnection('https://api.typesafe.ai/v1/systemone', 'test-token-xyz', 'jev-preview');
    assert.strictEqual(connResult.success, true, '握手测试必须成功');
    assert.strictEqual(lastFetchBody.model, 'jev-preview', '握手请求必须带上指定的自定义模型');
    assert.ok(lastFetchBody.questions?.ping, '握手请求必须包含符合规范的 questions.ping');
    assert.strictEqual(lastFetchHeaders['Authorization'], 'Bearer test-token-xyz', '必须带上 Bearer Token');

    // 8.2 evaluate 测试
    client.saveConfig({
      enabled: true,
      endpoint: 'https://api.typesafe.ai/v1/systemone',
      apiKey: 'test-token-xyz',
      model: 'jev-preview'
    });

    const mockPanorama = [
      { id: 'cat_healthy', name: '健康板块', coveragePercent: 90 },
      { id: 'cat_high_risk', name: '薄弱板块', coveragePercent: 30, dueCount: 5, mistakeCount: 4 }
    ];

    const rec = await client.evaluate(mockPanorama, { id: 'deck_1', title: '测试卡组' });
    assert.ok(rec, '必须生成推荐');
    assert.strictEqual(rec.source, 'remote', 'source 必须为 remote');
    assert.strictEqual(rec.targetCategoryId, 'cat_high_risk', '解析出的目标分类必须匹配 SystemOne answers.target_category.choice');
    assert.strictEqual(rec.urgency, 'HIGH', '紧急度必须正确识别');
    assert.strictEqual(rec.priorityScore, 96, '置信度转换为优先级分数 (0.96 -> 96)');
    assert.ok(rec.headline.includes('jev-preview'), '标题中必须包含当前模型名称');
    assert.ok(rec.headline.includes('薄弱板块'), '标题中必须包含推荐板块名称');
    assert.ok(rec.reason.includes('掌握度 30%'), '推荐理由应包含掌握度指标');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('✅ jev-recommendation.test.mjs PASSED!');
