import { McpToolAdapter } from './tool-adapter.js';
import { BrowserBridgeTransport } from '../../platform/network/browser-bridge-transport.js';
import { McpPreferences, mcpPresentation, createClientEndpoint } from './settings-model.js';

export class McpBridgeController {
  constructor(executor) {
    this.adapter = new McpToolAdapter(executor);
    this.preferences = new McpPreferences();
    this.connectionAttempt = 0;
    this.transport = new BrowserBridgeTransport({ adapter: this.adapter,
      onState: state => this.renderState(state),
      onCall: (name, status) => { const target = document.getElementById('mcp-last-call'); if (target) target.textContent = `${name} · ${status}`; }
    });
  }
  init() {
    document.getElementById('mcp-bridge-form')?.addEventListener('submit', event => { event.preventDefault(); void this.connect(); });
    document.getElementById('mcp-disconnect')?.addEventListener('click', () => this.disconnect());
    document.getElementById('mcp-copy-endpoint')?.addEventListener('click', () => { void this.copyEndpoint(); });
    document.getElementById('mcp-forget')?.addEventListener('click', () => this.forgetPreferences());
    document.getElementById('mcp-remember')?.addEventListener('change', event => { if (!event.target.checked) this.forgetPreferences(); });
    for (const id of ['mcp-server', 'mcp-room']) document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
    const saved = this.preferences.load();
    if (saved) { document.getElementById('mcp-server').value = saved.server; document.getElementById('mcp-room').value = saved.room; }
    const tools = this.adapter.listTools();
    for (const element of document.querySelectorAll('[data-mcp-tool-count]')) element.textContent = String(tools.length);
    const list = document.getElementById('mcp-tools-list');
    for (const tool of tools) {
      const item = document.createElement('li'); item.className = 'py-2 border-b border-slate-800';
      const name = document.createElement('code'); name.className = 'block text-xs text-indigo-300 break-all'; name.textContent = tool.name;
      const description = document.createElement('span'); description.className = 'text-xs text-slate-400'; description.textContent = tool.description;
      item.append(name, description); list?.append(item);
    }
    window.addEventListener('pagehide', () => this.disconnect());
    this.updatePreview();
    this.renderState('DISABLED');
  }
  renderState(state) {
    const target = document.getElementById('mcp-status');
    const presentation = mcpPresentation(this.connecting && state === 'DISABLED' ? 'CONNECTING' : state);
    if (target) target.textContent = presentation.label;
    const badge = document.getElementById('mcp-tab-status'); if (badge) badge.textContent = presentation.label;
    const busy = presentation.locked;
    for (const id of ['mcp-server', 'mcp-room', 'mcp-token']) { const input = document.getElementById(id); if (input) input.disabled = busy; }
    const button = document.getElementById('mcp-connect'); if (button) button.disabled = busy;
    const disconnect = document.getElementById('mcp-disconnect'); if (disconnect) disconnect.disabled = !busy;
    if (['FAILED', 'DISPLACED'].includes(state)) { this.releaseLock?.(); this.releaseLock = null; }
  }
  async connect() {
    if (this.connecting || mcpPresentation(this.transport.state).locked) return;
    this.connecting = true;
    const attempt = ++this.connectionAttempt;
    let acquired = false;
    try {
      if (!['https:', 'http:'].includes(location.protocol) || !globalThis.isSecureContext) throw new Error('请从 HTTPS 或本机 localhost 页面连接桥接');
      const server = document.getElementById('mcp-server').value.trim();
      const room = document.getElementById('mcp-room').value.trim();
      createClientEndpoint(server, room);
      const input = document.getElementById('mcp-token');
      const token = input.value.trim(); input.value = '';
      this.renderState('CONNECTING');
      if (navigator.locks) {
        acquired = await new Promise((resolve, reject) => {
          void navigator.locks.request('knowledge-master-mcp-host', { ifAvailable: true }, lock => {
            if (!lock || attempt !== this.connectionAttempt) { resolve(false); return; }
            return new Promise(release => { this.releaseLock = release; resolve(true); });
          }).catch(reject);
        });
        if (attempt !== this.connectionAttempt) return;
        if (!acquired) throw new Error('另一个标签页正在提供 MCP，请先断开它');
      }
      // Explicit reconnect establishes a new authorization scope; automatic
      // transport reconnection retains its existing intent ledger.
      this.adapter.ledger.clear();
      await this.transport.start({ server, room, token });
      if (attempt !== this.connectionAttempt) return;
      const remember = document.getElementById('mcp-remember')?.checked;
      if (remember && !this.preferences.save({ server, room })) this.feedback('连接不受影响，但浏览器无法保存地址与房间');
      else if (remember) this.feedback('已记住地址与房间；Token 仅用于本次连接');
      this.updatePreview();
    } catch (error) {
      if (attempt !== this.connectionAttempt) return;
      this.connecting = false;
      this.transport.stop(); this.releaseLock?.(); this.releaseLock = null;
      document.getElementById('mcp-status').textContent = error.message;
    } finally { if (attempt === this.connectionAttempt) { this.connecting = false; } }
  }
  disconnect() {
    ++this.connectionAttempt; this.connecting = false;
    this.transport.stop(); this.releaseLock?.(); this.releaseLock = null;
    const token = document.getElementById('mcp-token'); if (token) token.value = '';
  }
  feedback(text) { const target = document.getElementById('mcp-settings-feedback'); if (target) target.textContent = text; }
  forgetPreferences() {
    const cleared = this.preferences.clear();
    const checkbox = document.getElementById('mcp-remember'); if (checkbox) checkbox.checked = false;
    this.feedback(cleared ? '已清除记住的地址与房间，当前连接不变' : '浏览器无法清除保存的配置');
  }
  updatePreview() {
    const endpoint = document.getElementById('mcp-endpoint');
    const copy = document.getElementById('mcp-copy-endpoint');
    try {
      const url = createClientEndpoint(document.getElementById('mcp-server').value.trim(), document.getElementById('mcp-room').value.trim());
      if (endpoint) endpoint.value = url;
      if (copy) copy.disabled = false;
      document.getElementById('mcp-client-config').textContent = '传输方式：SSE（旧 HTTP+SSE）\n请求头：Authorization: Bearer <你的 Token>\n在外部客户端填入上方地址和同一 Token。';
    } catch {
      if (endpoint) endpoint.value = '';
      if (copy) copy.disabled = true;
      document.getElementById('mcp-client-config').textContent = '填写有效的桥接地址与房间后，这里会生成客户端接入信息。';
    }
  }
  async copyEndpoint() {
    const endpoint = document.getElementById('mcp-endpoint');
    if (!endpoint?.value) return;
    try { await navigator.clipboard.writeText(endpoint.value); this.feedback('已复制 SSE 地址，不含 Token'); }
    catch { endpoint.focus(); endpoint.select(); this.feedback('无法自动复制，已选中地址，请手动复制'); }
  }
}
