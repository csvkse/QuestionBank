import assert from 'node:assert/strict';
import { SessionStore, AgentLoopEngine, AiAgentUIController } from '../../features/ai-agent/index.js';

const originalStorage = globalThis.localStorage;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const timers = new Map();
let nextTimer = 0;
let writes = 0;
globalThis.localStorage = { getItem: () => null, setItem: () => { writes++; } };
globalThis.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; };
globalThis.clearTimeout = id => timers.delete(id);

try {
  const store = new SessionStore();
  store.appendMessage({ id: 'stream', role: 'assistant', content: '' });
  writes = 0;
  for (let i = 0; i < 1000; i++) {
    store.updateMessage('stream', { content: '字'.repeat(i + 1) }, { persist: false });
  }
  assert.equal(writes, 0, '1000 个分片不能同步写入全部历史');
  assert.equal(timers.size, 1, '流式保存必须合并为一个定时任务');
  const checkpoint = [...timers.values()][0];
  assert.equal(checkpoint.delay, 1000);
  timers.clear();
  checkpoint.fn();
  assert.equal(writes, 1, '持续生成期间也必须定期保存');
  store.updateMessage('stream', { content: '最终内容' }, { persist: false });
  store.saveSessions();
  assert.equal(writes, 2);
  assert.equal(timers.size, 0, '终态保存必须取消延迟写入');

  const ui = Object.create(AiAgentUIController.prototype);
  ui.store = store;
  ui.renderTimer = null;
  const renders = [];
  ui.renderCurrentSession = id => renders.push(id);
  for (let i = 0; i < 1000; i++) ui.scheduleMessageRender('stream');
  assert.equal(timers.size, 1, '1000 个刷新请求必须合并');
  const refresh = [...timers.values()][0];
  assert.equal(refresh.delay, 100);
  timers.clear();
  refresh.fn();
  assert.deepEqual(renders, ['stream'], '只刷新当前消息');

  // 用真实循环回调验证流式路径，不能只验证孤立辅助函数。
  let fullRenders = 0;
  let scheduled = 0;
  const engine = new AgentLoopEngine({ store, executor: {}, ui: {
    render: () => {}, renderCurrentSession: () => { fullRenders++; },
    scheduleMessageRender: () => { scheduled++; }, toggleSendButtonState: () => {}
  }, client: { abort: () => {}, sendChatStream: async ({ callbacks }) => {
    writes = 0;
    const before = fullRenders;
    for (let i = 0; i < 1000; i++) {
      callbacks.onContent('答'.repeat(i + 1));
      callbacks.onReasoning('思'.repeat(i + 1));
    }
    assert.equal(writes, 0, '真实循环分片不能立即落盘');
    assert.equal(fullRenders, before, '真实循环分片不能全量渲染');
    assert.equal(scheduled, 2000);
    await callbacks.onFinish({ content: '最终回答', reasoning: '最终推理', toolCall: null });
  } } });
  await engine.startLoop('测试长对话');
  assert.equal(store.getActiveSession().messages.at(-1).content, '最终回答');
  assert.ok(writes > 0, '结束必须落盘');
  assert.equal(timers.size, 0);
  store.updateMessage('stream', { content: '中止前内容' }, { persist: false });
  engine.abort();
  assert.equal(timers.size, 0, '中止必须保存残留分片');
  // 网络中断也必须保存异常文本和最后的正文。
  engine.client.sendChatStream = async ({ callbacks }) => {
    callbacks.onContent('中断前正文');
    callbacks.onError(new Error('测试断网'));
  };
  await engine.startLoop('异常测试');
  assert.ok(store.getActiveSession().messages.at(-1).content.includes('测试断网'));
  assert.equal(timers.size, 0);
  store.getActiveSession().messages = [];
  engine.client.sendChatStream = async ({ callbacks }) => {
    callbacks.onContent('中止前正文');
    engine.abort();
    callbacks.onContent('中止后迟到分片');
    assert.equal(store.getActiveSession().messages.at(-1).content, '中止前正文', '中止后的分片不得复活刷新和保存');
    assert.equal(timers.size, 0);
  };
  await engine.startLoop('中止测试');
  console.log('PASS FE-CHAT-PERF-001: streaming coalescing, checkpoints, finish and abort');
} finally {
  globalThis.localStorage = originalStorage;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
}
