/**
 * AI Agent UI View Controller
 * Core 2.1: features/ai-agent/agent-ui.js
 */

import { DECK_TOOL_DEFINITIONS, DeckToolExecutor } from './tools.js';
import { SessionStore } from './session-store.js';
import { AiAgentClient } from './client.js';
import { AgentLoopEngine } from './agent-loop.js';
import { escapeHtml, renderMarkdown, renderUserMessage, renderReasoningCard, renderToolCard, renderLoadingState } from './agent-templates.js';

export class AiAgentUIController {
  constructor(app) {
    this.app = app;
    this.store = new SessionStore();
    this.executor = new DeckToolExecutor(app);
    this.client = new AiAgentClient(this.store.config);
    this.loop = new AgentLoopEngine({
      client: this.client,
      executor: this.executor,
      store: this.store,
      ui: this
    });
  }

  init() {
    this.bindDOMEvents();
    this.render();
  }

  bindDOMEvents() {
    const input = document.getElementById('ai-chat-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  }

  render() {
    this.renderSessionList();
    this.renderCurrentSession();
    this.updateHeaderStatus();
    this.renderQuickModelSelector();
  }

  renderSessionList() {
    const listEl = document.getElementById('ai-session-list');
    const badge = document.getElementById('ai-session-count-badge');
    if (!listEl) return;
    if (badge) badge.innerText = `共 ${this.store.sessions.length} 个会话`;
    listEl.innerHTML = '';

    this.store.sessions.forEach(sess => {
      const isActive = sess.id === this.store.activeSessionId;
      const item = document.createElement('div');
      item.className = `p-2.5 rounded-lg cursor-pointer flex items-center justify-between group transition text-xs ${
        isActive ? 'bg-indigo-950/40 border border-indigo-700/50 text-white font-medium' : 'hover:bg-slate-800/60 text-slate-300'
      }`;
      item.onclick = () => { this.store.switchSession(sess.id); this.render(); };
      item.innerHTML = `
        <div class="flex items-center gap-2 truncate">
          <svg class="w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-500'} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span class="truncate">${escapeHtml(sess.title)}</span>
        </div>
        <button onclick="event.stopPropagation(); app.aiAgent.deleteSession('${sess.id}')"
          class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition" title="删除会话">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      `;
      listEl.appendChild(item);
    });
  }

  renderCurrentSession() {
    const container = document.getElementById('ai-messages-stream');
    const sess = this.store.getActiveSession();
    if (!container || !sess) return;
    container.innerHTML = '';

    sess.messages.forEach(msg => {
      if (msg.role === 'user') {
        container.insertAdjacentHTML('beforeend', renderUserMessage(msg));
      } else if (msg.role === 'tool') {
        container.insertAdjacentHTML('beforeend', `
          <div class="flex gap-2 max-w-4xl mx-auto justify-start text-[10px] text-slate-500 font-mono py-0.5 px-11 items-center">
            <svg class="w-3 h-3 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
            <span>接口反馈 [${escapeHtml(msg.name || 'tool')}]: 已回传至上下文</span>
          </div>
        `);
      } else {
        const reasoningHtml = renderReasoningCard(msg.reasoning);
        const toolHtml = renderToolCard(msg.id, msg.toolCall);
        const encodedContent = encodeURIComponent(msg.content || '');
        const hasContent = msg.content && msg.content.trim().length > 0;

        let markdownBody = '';
        if (hasContent) {
          markdownBody = renderMarkdown(msg.content);
        } else if (!msg.toolCall || msg.toolCall.status === 'pending' || msg.toolCall.status === 'executing') {
          // 空内容时，改为显示加载中 (Req)
          markdownBody = renderLoadingState();
        }

        const actionsToolbarHtml = hasContent ? `
          <div class="mt-1.5 flex items-center gap-1.5 opacity-70 hover:opacity-100 transition text-[11px] text-slate-400">
            <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedContent}'))" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-slate-200 transition flex items-center gap-1" title="复制回答">
              <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
              <span>复制</span>
            </button>
            <button onclick="app.aiAgent.regenerateFrom('${msg.id}')" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-indigo-400 transition flex items-center gap-1" title="重新生成">
              <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>重新生成</span>
            </button>
            <button onclick="app.aiAgent.deleteMessage('${msg.id}')" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-rose-400 transition flex items-center gap-1" title="删除">
              <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span>删除</span>
            </button>
          </div>
        ` : '';

        container.insertAdjacentHTML('beforeend', `
          <div class="flex gap-3 max-w-4xl mx-auto justify-start group">
            <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
              <svg class="w-4 h-4 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <div class="relative max-w-2xl flex-1 flex flex-col items-start">
              <div class="p-4 rounded-2xl rounded-tl-sm text-xs leading-relaxed text-slate-200 bg-[#0b1120] border border-slate-800 shadow-md w-full">
                ${reasoningHtml}
                ${toolHtml}
                <div class="space-y-2 text-xs leading-relaxed text-slate-200">${markdownBody}</div>
              </div>
              ${actionsToolbarHtml}
            </div>
          </div>
        `);
      }
    });
    container.scrollTop = container.scrollHeight;
  }

  updateHeaderStatus() {
    const modelLabel = document.getElementById('ai-active-model-name');
    const effortSelect = document.getElementById('ai-reasoning-effort-select');
    if (modelLabel) {
      const activeM = this.store.getActiveModel ? this.store.getActiveModel() : null;
      const spec = activeM ? ` (${Math.round((activeM.contextWindow || 128000)/1000)}k/${Math.round((activeM.maxOutputTokens || 8192)/1024)}k)` : '';
      modelLabel.innerText = (this.store.config.model || 'deepseek-reasoner') + spec;
    }
    if (effortSelect) effortSelect.value = this.store.config.reasoningEffort || 'medium';
  }

  // 渲染输入框上方的快捷平台与模型选择器 (含规格标签)
  renderQuickModelSelector() {
    const selector = document.getElementById('ai-quick-model-select');
    if (!selector) return;

    const providers = this.store.getProviders ? this.store.getProviders() : (this.store.config.providers || []);
    const activeVal = `${this.store.config.activeProviderId || this.store.config.provider}:${this.store.config.activeModelId || this.store.config.model}`;
    let html = '';

    providers.forEach(p => {
      if (p.enabled !== false) {
        html += `<optgroup label="${escapeHtml(p.name)} [${p.apiType || 'openai'}]">`;
        (p.models || []).forEach(m => {
          const mId = typeof m === 'object' ? m.id : m;
          const mName = typeof m === 'object' ? (m.name || m.id) : m;
          const ctxK = typeof m === 'object' ? `${Math.round((m.contextWindow || 128000) / 1000)}k` : '';
          const maxK = typeof m === 'object' ? `${Math.round((m.maxOutputTokens || 8192) / 1024)}k` : '';
          const spec = (ctxK && maxK) ? ` (${ctxK}/${maxK})` : '';
          const val = `${p.id}:${mId}`;
          const isSelected = val === activeVal;
          html += `<option value="${val}" ${isSelected ? 'selected' : ''}>${escapeHtml(mName + spec)}</option>`;
        });
        html += `</optgroup>`;
      }
    });

    selector.innerHTML = html;
  }

  onQuickModelChange(val) {
    if (!val) return;
    const [pId, mId] = val.split(':');
    this.store.switchModel(pId, mId);
    this.client.updateConfig(this.store.config);
    this.updateHeaderStatus();
  }

  editPrompt(msgId) {
    const session = this.store.getActiveSession();
    const msg = session?.messages.find(m => m.id === msgId);
    if (!msg) return;
    const input = document.getElementById('ai-chat-input');
    if (input) {
      input.value = msg.content;
      input.focus();
    }
  }

  async regenerateFrom(msgId) {
    if (this.loop.isRunning) return;
    const session = this.store.getActiveSession();
    if (!session) return;
    const idx = session.messages.findIndex(m => m.id === msgId);
    if (idx !== -1) {
      session.messages.splice(idx, 1);
      this.store.saveSessions();
      this.renderCurrentSession();
      await this.loop.stepLoop();
    }
  }

  deleteMessage(msgId) {
    this.store.deleteMessage(msgId);
    this.renderCurrentSession();
  }

  async handleSendMessage(text) {
    if (this.loop.isRunning) return;
    const input = document.getElementById('ai-chat-input');
    const content = (text || input?.value || '').trim();
    if (!content) return;
    if (input) input.value = '';

    await this.loop.startLoop(content);
  }

  async approveToolCall(msgId, toolCallId) {
    await this.loop.resumeWithApproval(msgId, toolCallId);
  }

  rejectToolCall(msgId) {
    this.loop.rejectApproval(msgId);
  }

  abortCurrentLoop() {
    this.loop.abort();
  }

  createNewSession() { this.store.createSession(); this.render(); }
  deleteSession(sessId) { this.store.deleteSession(sessId); this.render(); }
  clearAllSessions() { if (confirm('确认清空所有历史对话？')) { this.store.clearAllSessions(); this.render(); } }

  updateReasoningEffort(val) {
    this.store.saveConfig({ reasoningEffort: val });
    this.client.updateConfig({ reasoningEffort: val });
    this.updateHeaderStatus();
  }

  toggleSendButtonState(generating, customText) {
    const btn = document.getElementById('ai-send-btn');
    if (!btn) return;
    btn.disabled = generating;
    btn.innerHTML = generating
      ? `<span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span><span>${escapeHtml(customText || '思考中...')}</span>`
      : `<span>发送</span><svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
  }
}
