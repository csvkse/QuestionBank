import { McpToolAdapter } from './tool-adapter.js';
import { BrowserBridgeTransport } from '../../platform/network/browser-bridge-transport.js';
import { McpPreferences, mcpPresentation, createClientEndpoint } from './settings-model.js';
import { ClientConfigRegistry } from './client-adapters.js';
import { MonopolyCoordinator } from '../../platform/network/monopoly-coordinator.js';

export class McpBridgeController {
  constructor(executor, options = {}) {
    this.adapter = new McpToolAdapter(executor);
    this.preferences = new McpPreferences();
    this.configRegistry = new ClientConfigRegistry();
    this.monopoly = options.monopoly || new MonopolyCoordinator();
    this.activeClient = 'cursor';
    this.connectionAttempt = 0;
    this.transport = new BrowserBridgeTransport({
      adapter: this.adapter,
      onState: state => this.renderState(state),
      onCall: (name, status) => {
        const target = document.getElementById('mcp-last-call');
        if (target) target.textContent = `${name} · ${status}`;
      }
    });
  }

  init() {
    document.getElementById('mcp-bridge-form')?.addEventListener('submit', event => {
      event.preventDefault();
      void this.connect();
    });
    document.getElementById('mcp-disconnect')?.addEventListener('click', () => this.disconnect());
    document.getElementById('mcp-copy-endpoint')?.addEventListener('click', () => { void this.copyEndpoint(); });
    document.getElementById('mcp-copy-config')?.addEventListener('click', () => { void this.copyConfig(); });
    document.getElementById('mcp-forget')?.addEventListener('click', () => this.forgetPreferences());
    document.getElementById('mcp-remember')?.addEventListener('change', event => {
      if (!event.target.checked) this.forgetPreferences();
    });
    document.getElementById('mcp-include-token')?.addEventListener('change', () => this.updatePreview());

    document.getElementById('mcp-client-tabs')?.addEventListener('click', event => {
      const btn = event.target.closest?.('[data-client]');
      if (!btn) return;
      const client = btn.getAttribute('data-client');
      if (client && client !== this.activeClient) {
        this.activeClient = client;
        this.renderClientTabs();
        this.updatePreview();
      }
    });

    for (const id of ['mcp-server', 'mcp-room', 'mcp-token']) {
      document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    }

    const saved = this.preferences.load();
    if (saved) {
      const serverEl = document.getElementById('mcp-server');
      const roomEl = document.getElementById('mcp-room');
      const tokenEl = document.getElementById('mcp-token');
      const rememberEl = document.getElementById('mcp-remember');
      if (serverEl) serverEl.value = saved.server;
      if (roomEl) roomEl.value = saved.room;
      if (tokenEl && saved.token) tokenEl.value = saved.token;
      if (rememberEl) rememberEl.checked = Boolean(saved.rememberToken || saved.token);
    }

    const tools = this.adapter.listTools();
    for (const element of document.querySelectorAll('[data-mcp-tool-count]')) {
      element.textContent = String(tools.length);
    }

    const list = document.getElementById('mcp-tools-list');
    for (const tool of tools) {
      const item = document.createElement('li');
      item.className = 'py-2 border-b border-slate-800';
      const name = document.createElement('code');
      name.className = 'block text-xs text-indigo-300 break-all';
      name.textContent = tool.name;
      const description = document.createElement('span');
      description.className = 'text-xs text-slate-400';
      description.textContent = tool.description;
      item.append(name, description);
      list?.append(item);
    }

    window.addEventListener('pagehide', () => this.disconnect());
    this.renderClientTabs();
    this.updatePreview();
    this.renderState('DISABLED');
  }

  renderClientTabs() {
    const tabs = document.querySelectorAll?.('#mcp-client-tabs [data-client]') || [];
    for (const tab of tabs) {
      const isCurrent = tab.getAttribute('data-client') === this.activeClient;
      tab.className = isCurrent
        ? 'px-2.5 py-1 rounded bg-indigo-600 text-white font-medium transition'
        : 'px-2.5 py-1 rounded text-slate-400 hover:text-white transition';
    }
  }

  renderState(state) {
    const target = document.getElementById('mcp-status');
    const presentation = mcpPresentation(this.connecting && state === 'DISABLED' ? 'CONNECTING' : state);
    if (target) target.textContent = presentation.label;
    const badge = document.getElementById('mcp-tab-status');
    if (badge) badge.textContent = presentation.label;
    const busy = presentation.locked;
    for (const id of ['mcp-server', 'mcp-room', 'mcp-token']) {
      const input = document.getElementById(id);
      if (input) input.disabled = busy;
    }
    const button = document.getElementById('mcp-connect');
    if (button) button.disabled = busy;
    const disconnect = document.getElementById('mcp-disconnect');
    if (disconnect) disconnect.disabled = !busy;
    if (['FAILED', 'DISPLACED'].includes(state)) {
      this.releaseLock?.();
      this.releaseLock = null;
      this.monopoly?.release();
    }
  }

  async connect() {
    if (this.connecting || mcpPresentation(this.transport.state).locked) return;
    this.connecting = true;
    const attempt = ++this.connectionAttempt;
    try {
      if (!['https:', 'http:'].includes(location.protocol) || !globalThis.isSecureContext) {
        throw new Error('请从 HTTPS 或本机 localhost 页面连接桥接');
      }
      const server = document.getElementById('mcp-server')?.value?.trim() || '';
      const room = document.getElementById('mcp-room')?.value?.trim() || '';
      createClientEndpoint(server, room);
      const input = document.getElementById('mcp-token');
      const token = input?.value?.trim() || '';
      const remember = document.getElementById('mcp-remember')?.checked;
      if (!remember && input) input.value = '';
      this.renderState('CONNECTING');

      const lockRes = await this.monopoly.acquire({ server, room });
      if (attempt !== this.connectionAttempt) {
        this.monopoly.release();
        return;
      }
      if (!lockRes.acquired) throw new Error('另一个标签页正在为此房间提供 MCP，请先断开它');
      this.releaseLock = lockRes.release;

      this.adapter.ledger.clear();
      await this.transport.start({ server, room, token });
      if (attempt !== this.connectionAttempt) return;

      if (remember) {
        const savedOk = this.preferences.save({ server, room, token, rememberToken: true });
        this.feedback(savedOk ? '已记住地址、房间与 Token' : '连接不受影响，但浏览器无法保存配置');
      } else {
        this.preferences.save({ server, room, rememberToken: false });
        this.feedback('连接成功；本次 Token 未记住');
      }
      this.updatePreview();
    } catch (error) {
      if (attempt !== this.connectionAttempt) return;
      this.connecting = false;
      this.transport.stop();
      this.releaseLock?.();
      this.releaseLock = null;
      this.monopoly?.release();
      const statusEl = document.getElementById('mcp-status');
      if (statusEl) statusEl.textContent = error.message;
    } finally {
      if (attempt === this.connectionAttempt) {
        this.connecting = false;
      }
    }
  }

  disconnect() {
    ++this.connectionAttempt;
    this.connecting = false;
    this.transport.stop();
    this.releaseLock?.();
    this.releaseLock = null;
    this.monopoly?.release();
    const remember = document.getElementById('mcp-remember')?.checked;
    if (!remember) {
      const token = document.getElementById('mcp-token');
      if (token) token.value = '';
    }
  }

  feedback(text) {
    const target = document.getElementById('mcp-settings-feedback');
    if (target) target.textContent = text;
  }

  forgetPreferences() {
    const cleared = this.preferences.clear();
    const checkbox = document.getElementById('mcp-remember');
    if (checkbox) checkbox.checked = false;
    const token = document.getElementById('mcp-token');
    if (token) token.value = '';
    this.feedback(cleared ? '已清除记住的地址、房间与 Token' : '浏览器无法清除保存的配置');
    this.updatePreview();
  }

  updatePreview() {
    const endpoint = document.getElementById('mcp-endpoint');
    const copyEndpoint = document.getElementById('mcp-copy-endpoint');
    const copyConfig = document.getElementById('mcp-copy-config');
    const configBox = document.getElementById('mcp-client-config');
    const server = document.getElementById('mcp-server')?.value?.trim() || '';
    const room = document.getElementById('mcp-room')?.value?.trim() || '';
    const token = document.getElementById('mcp-token')?.value?.trim() || '';
    const includeToken = document.getElementById('mcp-include-token')?.checked ?? true;

    try {
      const url = createClientEndpoint(server, room);
      if (endpoint) endpoint.value = url;
      if (copyEndpoint) copyEndpoint.disabled = false;
      if (copyConfig) copyConfig.disabled = false;
      const generated = this.configRegistry.generate(this.activeClient, {
        endpointUrl: url,
        token,
        includeToken
      });
      if (configBox) configBox.textContent = generated.code;
    } catch {
      if (endpoint) endpoint.value = '';
      if (copyEndpoint) copyEndpoint.disabled = true;
      if (copyConfig) copyConfig.disabled = true;
      const fallback = this.configRegistry.generate(this.activeClient, {
        endpointUrl: '',
        token: '',
        includeToken: false
      });
      if (configBox) configBox.textContent = fallback.code;
    }
  }

  async copyEndpoint() {
    const endpoint = document.getElementById('mcp-endpoint');
    if (!endpoint?.value) return;
    try {
      await navigator.clipboard.writeText(endpoint.value);
      this.feedback('已复制 SSE 地址，不含 Token');
    } catch {
      endpoint.focus?.();
      endpoint.select?.();
      this.feedback('无法自动复制，已选中地址，请手动复制');
    }
  }

  async copyConfig() {
    const configBox = document.getElementById('mcp-client-config');
    if (!configBox?.textContent) return;
    const clientMeta = this.configRegistry.generate(this.activeClient);
    try {
      await navigator.clipboard.writeText(configBox.textContent);
      this.feedback(`已复制 ${clientMeta.label} 标准导入配置`);
    } catch {
      this.feedback('无法自动复制，请手动复制选中的配置文本');
    }
  }
}
