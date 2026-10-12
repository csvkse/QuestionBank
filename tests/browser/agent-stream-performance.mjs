import { AiAgentUIController, SessionStore, AgentLoopEngine } from '../../features/ai-agent/index.js';

function check(value, message) { if (!value) throw new Error(message); }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runBrowserGate() {
  const store = new SessionStore();
  store.sessions = [{ id: 'perf', messages: Array.from({ length: 100 }, (_, i) => ({
    id: 'm' + i, role: 'assistant', content: ('段落 **重点** 内容\n\n').repeat(100), reasoning: '推理内容'
  })) }];
  store.activeSessionId = 'perf';
  let writes = 0;
  let serializedCharacters = 0;
  // 保留真实保存/取消定时器路径，只替换存储介质，避免写入用户会话。
  store.saveSessions = function () {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    writes++;
    serializedCharacters += JSON.stringify(this.sessions).length;
  };
  const ui = Object.create(AiAgentUIController.prototype);
  Object.assign(ui, { store, messageRows: new Map(), renderTimer: null, renderedSessionId: null });
  ui.toggleSendButtonState = () => {};
  ui.render = () => ui.renderCurrentSession();
  const host = document.getElementById('ai-messages-stream');
  ui.init();
  const first = host.firstElementChild;
  const historicalBody = first.firstElementChild;
  const last = host.lastElementChild;
  last.querySelector('details').open = true;
  host.scrollTop = 0;
  const started = performance.now();
  for (let i = 0; i < 100; i++) {
    store.updateMessage('m99', { content: ('输出段落\n\n').repeat(100) + i }, { persist: false });
    ui.renderCurrentSession('m99');
  }
  const elapsedMs = Math.round(performance.now() - started);
  check(elapsedMs <= 5000, `局部刷新耗时 ${elapsedMs}ms 超过 5000ms 门限`);
  check(first === host.firstElementChild && historicalBody === first.firstElementChild, '历史 DOM 被重建');
  check(last === host.lastElementChild, '当前消息外层节点被替换');
  check(last.querySelector('details').open, '推理展开状态丢失');
  check(host.scrollTop === 0, '阅读历史时被强制滚到底部');
  check(writes === 0, '分片触发同步全历史保存');
  window.dispatchEvent(new Event('pagehide'));
  check(writes === 1 && store.saveTimer === null, '离开页面未保存残留分片');

  // 到底部时仍然跟随新增内容。
  host.scrollTop = host.scrollHeight;
  store.updateMessage('m99', { content: ('更长段落\n\n').repeat(200) });
  ui.renderCurrentSession('m99');
  check(host.scrollHeight - host.scrollTop - host.clientHeight <= 2, '底部跟随失效');

  let streamRenders = 0;
  const originalRender = ui.renderCurrentSession.bind(ui);
  ui.renderCurrentSession = id => { streamRenders++; originalRender(id); };
  const engine = new AgentLoopEngine({ store, ui, executor: {}, client: {
    abort: () => {},
    sendChatStream: async ({ callbacks }) => {
      const before = streamRenders;
      const writesBefore = writes;
      for (let i = 0; i < 1000; i++) {
        callbacks.onContent('流式正文'.repeat(i + 1));
        callbacks.onReasoning('流式推理'.repeat(i + 1));
      }
      check(streamRenders === before && writes === writesBefore, '真实分片路径未合并');
      await wait(150);
      check(streamRenders === before + 1, '同一批分片不是一次局部刷新');
      check(first === host.firstElementChild && historicalBody === first.firstElementChild, '真实流重建历史');
      await callbacks.onFinish({ content: '完整最终回答', reasoning: '完整最终推理', toolCall: null });
    }
  } });
  await engine.startLoop('长对话测试');
  check(host.textContent.includes('完整最终回答'), '终态正文未刷新');
  check(ui.renderTimer === null && store.saveTimer === null, '终态残留定时任务');

  // 删除、切换会话不应保留旧节点或复活旧刷新。
  store.getActiveSession().messages.splice(1, 1);
  ui.renderCurrentSession();
  check(host.children.length === 101, '删除后 DOM 数量不匹配');
  ui.scheduleMessageRender('m99');
  store.sessions.push({ id: 'other', messages: [{ id: 'other-msg', role: 'user', content: '另一个会话' }] });
  store.activeSessionId = 'other';
  ui.renderCurrentSession();
  await wait(150);
  check(host.children.length === 1 && host.textContent.includes('另一个会话'), '旧刷新污染新会话');
  return { status: 'PASS', gate: 'FE-CHAT-PERF-002', historyMessages: 100, fragments: 100,
    elapsedMs, immediateWrites: 0, historicalNodePreserved: true,
    burstFragments: 2000, burstRenders: 1, writes, serializedCharacters,
    checks: ['历史节点复用', '局部渲染', '阅读滚动保持', '底部跟随', '推理展开保持', '终态完整', '删除与切换'] };
}
