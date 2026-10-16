import assert from 'assert';

// Mock localStorage for Node.js unit test runtime
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => memStore.get(k) || null,
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear()
};

import { AgentLoopEngine, SessionStore, AiAgentClient, renderLoadingState, renderMarkdown, ToolReferenceError, ToolFormatError, ToolPermissionError, DeckToolExecutor } from '../../features/ai-agent/index.js';

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

// 9. 测试工具异常捕获与结构化回传，驱动 Agent 自愈 (Self-Healing Loop)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.autoApprove = true;

  const executionLog = [];
  const mockExecutor = {
    execute: async (name, args) => {
      executionLog.push({ name, args });
      if (name === 'tool_get_deck' && args.deckId === 'deck_unknown') {
        throw new ToolReferenceError(`未找到 ID 为 "${args.deckId}" 的题库`, 'DECK_NOT_FOUND', '请先调用 tool_list_decks 查询可用题库', { requestedDeckId: args.deckId });
      }
      if (name === 'tool_list_decks') {
        return [{ id: 'deck_verbs', title: '英语动词' }];
      }
      return { success: true, deckId: 'deck_verbs' };
    }
  };

  let stepsExecuted = 0;
  const mockClient = {
    sendChatStream: async ({ messages, callbacks, step }) => {
      stepsExecuted++;
      if (step === 1) {
        // 第一步：模型发起错误参数调用 (引用不存在的题库)
        await callbacks.onFinish({
          content: '尝试提取未知题库',
          reasoning: '第一步思考',
          toolCall: { id: 'call_err_1', name: 'tool_get_deck', arguments: { deckId: 'deck_unknown' } }
        });
      } else if (step === 2) {
        // 关键断言：验证第 2 步收到了 role: 'tool'，并且内容包含结构化异常与 suggestion
        const toolMsg = messages.find(m => m.role === 'tool' && m.tool_call_id === 'call_err_1');
        assert.ok(toolMsg, '第 2 步上下文必须包含第 1 步异常回传的 tool 消息');
        const parsedToolContent = JSON.parse(toolMsg.content);
        assert.strictEqual(parsedToolContent.success, false, '工具返回 success 必须为 false');
        assert.strictEqual(parsedToolContent.error.type, 'REFERENCE_ERROR', '错误类型应为 REFERENCE_ERROR');
        assert.strictEqual(parsedToolContent.error.code, 'DECK_NOT_FOUND', '错误码应为 DECK_NOT_FOUND');
        assert.ok(parsedToolContent.error.suggestion.includes('tool_list_decks'), '错误中必须包含自愈纠错建议');

        // 模型根据 suggestion 进行自愈：调用 tool_list_decks
        await callbacks.onFinish({
          content: '上一步题库未找到，正在自愈检索题库清单',
          reasoning: '自愈思考：先查列表',
          toolCall: { id: 'call_heal_2', name: 'tool_list_decks', arguments: {} }
        });
      } else if (step === 3) {
        // 验证已获得正确列表，输出最终自愈成功结论
        const healMsg = messages.find(m => m.role === 'tool' && m.tool_call_id === 'call_heal_2');
        assert.ok(healMsg, '第 3 步上下文必须包含自愈检索到的 tool 返回');
        await callbacks.onFinish({
          content: '自愈成功！已确认系统题库。',
          reasoning: '自愈闭环思考',
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

  await engine.startLoop('帮我查一下未知题库');

  assert.strictEqual(stepsExecuted, 3, '应当完成 3 步：报错 -> 自愈检索 -> 闭环总结');
  assert.strictEqual(executionLog.length, 2, '应当执行 2 次工具调用');
  assert.strictEqual(executionLog[0].name, 'tool_get_deck');
  assert.strictEqual(executionLog[1].name, 'tool_list_decks');

  // 验证第 1 步助手卡片标记为 error 状态
  const session = store.getActiveSession();
  const firstAssistantMsg = session.messages.find(m => m.step === 1);
  assert.strictEqual(firstAssistantMsg.toolCall.status, 'error', '第一步工具卡片状态应为 error');
  assert.strictEqual(firstAssistantMsg.toolCall.error.code, 'DECK_NOT_FOUND');
}

// 10. 测试连续同类错误死循环熔断保护 (Consecutive Error Circuit Breaker)
{
  memStore.clear();
  const store = new SessionStore();
  store.config.autoApprove = true;

  const mockExecutor = {
    execute: async () => {
      throw new ToolFormatError('缺少必填字段 title', 'MISSING_FIELD', '请传入 title');
    }
  };

  let loopCalls = 0;
  const mockClient = {
    sendChatStream: async ({ callbacks, step }) => {
      loopCalls++;
      // 模型不思悔改，每一步都发起相同错误调用
      await callbacks.onFinish({
        content: `第 ${step} 步重试`,
        toolCall: { id: `call_loop_${step}`, name: 'tool_create_deck', arguments: {} }
      });
    }
  };

  const engine = new AgentLoopEngine({
    client: mockClient,
    executor: mockExecutor,
    store,
    ui: createMockUI()
  });

  await engine.startLoop('测试死循环异常熔断');

  // 连续相同工具相同错误在第 2 次执行后必须触发熔断，不得无限执行到 5 步
  assert.strictEqual(loopCalls, 2, '连续触发 2 次同类工具异常后必须立即熔断');
  assert.strictEqual(engine.isRunning, false, '熔断后 isRunning 必须为 false');
  const lastAssistantMsg = store.getActiveSession().messages.slice().reverse().find(m => m.role === 'assistant');
  assert.ok(lastAssistantMsg.content.includes('自愈熔断保护生效'), '熔断消息应包含自愈熔断提示');
}

// 11. 测试 DeckToolExecutor 领域校验异常与内置保护
{
  const mockApp = {
    getAllDecks: () => [{ id: 'deck_verbs', title: '动词' }],
    state: { customDecks: [] },
    saveUserData: () => {},
    renderAllViews: () => {}
  };
  const executor = new DeckToolExecutor(mockApp);

  // 1) 测试缺少必填字段抛出 ToolFormatError
  let errFormat = null;
  try {
    await executor.execute('tool_create_deck', { title: '无分类题库', categories: [] });
  } catch (e) {
    errFormat = e;
  }
  assert.ok(errFormat instanceof ToolFormatError, '缺少 categories 必须抛出 ToolFormatError');
  assert.strictEqual(errFormat.type, 'FORMAT_ERROR');
  assert.ok(errFormat.suggestion.length > 0, '异常必须附带纠错建议 suggestion');

  // 2) 测试删除内置题库抛出 ToolPermissionError
  let errPerm = null;
  try {
    await executor.execute('tool_delete_deck', { deckId: 'deck_verbs' });
  } catch (e) {
    errPerm = e;
  }
  assert.ok(errPerm instanceof ToolPermissionError, '删除内置题库必须抛出 ToolPermissionError');
  assert.strictEqual(errPerm.type, 'PERMISSION_ERROR');
  assert.strictEqual(errPerm.code, 'BUILTIN_PROTECTED');

  // 3) 测试查询不存在词条抛出 ToolReferenceError
  let errRef = null;
  try {
    await executor.execute('tool_update_entity', { deckId: 'deck_verbs', entityId: 'not_exist' });
  } catch (e) {
    errRef = e;
  }
  assert.ok(errRef instanceof ToolReferenceError, '词条不存在必须抛出 ToolReferenceError');
  assert.strictEqual(errRef.code, 'ENTITY_NOT_FOUND');
}

console.log('✅ agent-loop.test.mjs PASSED!');
