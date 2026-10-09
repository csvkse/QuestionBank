import assert from 'assert';

// Mock localStorage for Node.js unit test runtime
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.get(k) || null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear()
};

import { AgentLoopEngine, SessionStore, AiAgentClient, renderLoadingState, renderMarkdown } from '../../features/ai-agent/index.js';

console.log('🧪 Testing agent-loop.js...');

function createMockUI() {
  return {
    render: () => {},
    renderCurrentSession: () => {},
    toggleSendButtonState: () => {}
  };
}

// 1. 测试自动多步循环 (autoApprove: true)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.autoApprove = true;

  const executedTools = [];
  const mockExecutor = {
    execute: async (name, args) => {
      executedTools.push({ name, args });
      return { success: true, count: 5 };
    }
  };

  let clientStepCalls = 0;
  const mockClient = {
    sendChatStream: async ({ messages, callbacks, step }) => {
      clientStepCalls++;
      if (step === 1) {
        await callbacks.onFinish({
          content: '第一步正在检索',
          reasoning: '第一步思考',
          toolCall: { id: 'call_1', name: 'tool_list_decks', arguments: {} }
        });
      } else if (step === 2) {
        // 验证上下文包含了第一步返回的 tool 消息
        const hasToolMsg = messages.some(m => m.role === 'tool' && m.tool_call_id === 'call_1');
        assert.strictEqual(hasToolMsg, true, '第 2 步上下文必须包含第 1 步的 tool 返回');
        await callbacks.onFinish({
          content: '第二步正在创建',
          reasoning: '第二步思考',
          toolCall: { id: 'call_2', name: 'tool_create_deck', arguments: { title: '测试' } }
        });
      } else if (step === 3) {
        // 验证上下文包含了第二步返回的 tool 消息
        const hasToolMsg2 = messages.some(m => m.role === 'tool' && m.tool_call_id === 'call_2');
        assert.strictEqual(hasToolMsg2, true, '第 3 步上下文必须包含第 2 步的 tool 返回');
        await callbacks.onFinish({
          content: '全部闭环完成！',
          reasoning: '总结思考',
          toolCall: null
        });
      }
    }
  };

  const engine = new AgentLoopEngine({
    client: mockClient,
    executor: mockExecutor,
    store,
    ui: createMockUI()
  });

  await engine.startLoop('帮我自动创建题库');

  assert.strictEqual(clientStepCalls, 3, '应当自动完成 3 步自主循环');
  assert.strictEqual(executedTools.length, 2, '应当执行 2 次工具调用');
  assert.strictEqual(executedTools[0].name, 'tool_list_decks');
  assert.strictEqual(executedTools[1].name, 'tool_create_deck');
  assert.strictEqual(engine.isRunning, false, '循环结束时 isRunning 必须为 false');
  assert.strictEqual(engine.currentStep, 3, '最终步数应为 3');
}

// 2. 测试人工批准介入与恢复 (autoApprove: false, Human-in-the-Loop)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.autoApprove = false;

  const executedTools = [];
  const mockExecutor = {
    execute: async (name, args) => {
      executedTools.push({ name, args });
      return { success: true };
    }
  };

  let clientStepCalls = 0;
  const mockClient = {
    sendChatStream: async ({ callbacks, step }) => {
      clientStepCalls++;
      if (step === 1) {
        await callbacks.onFinish({
          content: '提议创建',
          reasoning: '思考中',
          toolCall: { id: 'call_manual_1', name: 'tool_delete_deck', arguments: { deckId: 'd1' } }
        });
      } else {
        await callbacks.onFinish({
          content: '删除已确认并完成',
          reasoning: '思考中',
          toolCall: null
        });
      }
    }
  };

  const engine = new AgentLoopEngine({
    client: mockClient,
    executor: mockExecutor,
    store,
    ui: createMockUI()
  });

  await engine.startLoop('帮我删除废弃题库');

  // 此时应当在第 1 步暂停，等待用户批准
  assert.strictEqual(clientStepCalls, 1);
  assert.strictEqual(engine.isPausedForApproval, true, '未开启 autoApprove 时应挂起等待批准');
  assert.strictEqual(executedTools.length, 0, '未批准前不得执行工具');

  // 用户点击批准
  await engine.resumeWithApproval(engine.pendingAssistantMsgId, 'call_manual_1');

  // 恢复后应自动执行工具并进入下一步
  assert.strictEqual(executedTools.length, 1);
  assert.strictEqual(clientStepCalls, 2);
  assert.strictEqual(engine.isRunning, false);
  assert.strictEqual(engine.isPausedForApproval, false);
}

// 3. 测试最大步数熔断保护 (Circuit Breaker)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.autoApprove = true;

  const mockExecutor = { execute: async () => ({ ok: true }) };
  let infiniteCalls = 0;
  const mockClient = {
    sendChatStream: async ({ callbacks }) => {
      infiniteCalls++;
      await callbacks.onFinish({
        content: '无休止请求',
        toolCall: { id: 'call_inf_' + infiniteCalls, name: 'tool_list_decks', arguments: {} }
      });
    }
  };

  const engine = new AgentLoopEngine({
    client: mockClient,
    executor: mockExecutor,
    store,
    ui: createMockUI()
  });

  await engine.startLoop('测试死循环保护');

  assert.strictEqual(engine.isRunning, false, '达到 maxSteps 后必须停止');
  assert.strictEqual(engine.currentStep, 6, '熔断触发时 step 超过 maxSteps');
  assert.strictEqual(infiniteCalls, 5, '调用次数必须被限制在 maxSteps 内');
}

// 4. 测试结合真实 AiAgentClient 仿真引擎的全自动 3 步循环 (End-to-End Simulation)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.apiKey = ''; // 仿真演示模式
  store.config.autoApprove = true;

  const client = new AiAgentClient(store.config);
  const executed = [];
  const executor = {
    execute: async (name, args) => {
      executed.push({ name, args });
      return { success: true, count: 8, deckId: 'deck_docker_mock' };
    }
  };

  const engine = new AgentLoopEngine({
    client,
    executor,
    store,
    ui: createMockUI()
  });

  await engine.startLoop('为我创建一套《Docker 容器实战》考题');

  assert.strictEqual(engine.isRunning, false, '3步执行完毕后循环应当终止');
  assert.strictEqual(engine.currentStep, 3, '应当精准推进至第 3 步输出总结');
  assert.strictEqual(executed.length, 2, '应当依次执行了 2 个工具');
  assert.strictEqual(executed[0].name, 'tool_list_decks');
  assert.strictEqual(executed[1].name, 'tool_create_deck');

  const session = store.getActiveSession();
  const toolResults = session.messages.filter(m => m.role === 'tool');
  assert.strictEqual(toolResults.length, 2, '会话上下文中应记录了 2 个 tool 回传消息');
  const lastMsg = session.messages[session.messages.length - 1];
  assert.strictEqual(lastMsg.role, 'assistant');
  assert(lastMsg.content.includes('恭喜') || lastMsg.content.includes('闭环完成'));
}

// 5. 测试自定义平台、接口类型选择与模型细粒度参数配置 (Req 16)
{
  memStore.clear();
  const store = new SessionStore();

  // 1) 验证默认参考预设已加载
  const providers = store.getProviders();
  assert(providers.length >= 5, '默认至少具备 5 个参考预设平台');
  const ds = providers.find(p => p.id === 'deepseek');
  assert.strictEqual(ds.apiType, 'openai', 'DeepSeek 接口类型应为 openai');
  assert(ds.models.length >= 2, 'DeepSeek 应包含至少 2 个模型');

  // 2) 验证添加自定义平台与接口协议
  const customP = store.addProvider({
    name: '自建中继网关',
    apiType: 'anthropic',
    baseUrl: 'https://relay.example.com/v1',
    apiKey: 'sk-relay-test',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7', contextWindow: 200000, maxOutputTokens: 64000, reasoning: true }
    ]
  });
  assert(customP.id.startsWith('provider_'), '自建平台应分配标准 ID');
  assert.strictEqual(customP.apiType, 'anthropic', '自建平台接口类型应正确保存');

  // 3) 验证向平台添加与更新细粒度模型
  store.addModel(customP.id, {
    id: 'deepseek-r1-custom',
    name: 'R1 私有微调版',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    reasoning: true
  });
  let updatedP = store.getProviders().find(p => p.id === customP.id);
  assert.strictEqual(updatedP.models.length, 2, '平台下应具有 2 个模型');

  store.updateModel(customP.id, 'deepseek-r1-custom', { contextWindow: 64000, maxOutputTokens: 4096 });
  updatedP = store.getProviders().find(p => p.id === customP.id);
  const m = updatedP.models.find(x => x.id === 'deepseek-r1-custom');
  assert.strictEqual(m.contextWindow, 64000, '上下文窗口应精确更新为 64000');
  assert.strictEqual(m.maxOutputTokens, 4096, '最大输出应精确更新为 4096');

  // 4) 验证切换模型与配置同步
  store.switchModel(customP.id, 'deepseek-r1-custom');
  assert.strictEqual(store.config.activeProviderId, customP.id);
  assert.strictEqual(store.config.activeModelId, 'deepseek-r1-custom');
  assert.strictEqual(store.config.contextWindow, 64000);
  assert.strictEqual(store.config.maxOutputTokens, 4096);
  assert.strictEqual(store.config.apiType, 'anthropic');

  // 5) 验证删除模型与兜底保护
  store.deleteModel(customP.id, 'deepseek-r1-custom');
  updatedP = store.getProviders().find(p => p.id === customP.id);
  assert.strictEqual(updatedP.models.length, 1, '删除后应保留 1 个模型');
  assert.strictEqual(store.config.activeModelId, 'claude-3-7-sonnet', '当前模型被删后应自动回退至第一个可用模型');
}

// 7. 测试空内容态加载中模板渲染 (Req: 空内容时显示加载中)
{
  const loadingHtml = renderLoadingState();
  assert.ok(loadingHtml.includes('加载中...'), '空内容态模板必须包含“加载中...”文案');
  assert.ok(loadingHtml.includes('animate-bounce'), '空内容态模板必须包含跳动动效');

  assert.strictEqual(renderMarkdown(''), '', 'renderMarkdown 空内容仍保持安全无报错');
  assert.strictEqual(renderMarkdown('   '), '', 'renderMarkdown 空白字符仍保持安全无报错');
}

// 8. 测试块级 Markdown 格式化排版规约 (Block-Level Markdown Layout & Spacing Integrity)
{
  const sample = `你好！我是 AI 专家。
我可以帮你：
- **功能一**：生成题库
- **功能二**：查询覆盖率

1. 第一步
2. 第二步

请在下方输入需求！`;

  const html = renderMarkdown(sample);
  // 必须生成语义化 ul 与 ol 容器
  assert.ok(html.includes('<ul class="space-y-1.5'), '无序列表必须包装在带有紧凑间距的 ul 容器中');
  assert.ok(html.includes('<ol class="space-y-1.5'), '有序列表必须包装在带有紧凑间距的 ol 容器中');
  assert.ok(html.includes('<li class="flex items-start'), '列表项必须包装在语义化 li 中');
  // 严禁在列表项之间遗留孤立 <br> 或空 div (造成幽灵空行)
  assert.ok(!html.includes('</li><br>'), '列表项之间严禁产生幽灵 br 换行');
  assert.ok(!html.includes('</li><div'), '列表项之间严禁产生幽灵 div 占位');
  // 验证段落包装
  assert.ok(html.includes('<p class="leading-relaxed">'), '文本段落必须使用统一行高 p 标签包装');
}

console.log('✅ agent-loop.test.mjs PASSED!');
