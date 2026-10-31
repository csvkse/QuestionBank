import { McpToolAdapter } from './tool-adapter.js';
import { BrowserBridgeTransport } from '../../platform/network/browser-bridge-transport.js';

const MCP_BRIDGE_LABELS = { DISABLED: '未连接', CONNECTING: '连接中', REGISTERING: '正在注册工具', REGISTERED: '已连接，19 个工具已发送注册（待外部调用验证）', READY: '已验证，可调用', BACKOFF: '连接中断，正在重连', DISPLACED: '同房间已有新 Host，已停止连接', FAILED: '连接失败，请检查地址、房间、Token 和网关开关' };

export class McpBridgeController {
  constructor(executor) {
    this.adapter = new McpToolAdapter(executor);
    this.transport = new BrowserBridgeTransport({ adapter: this.adapter,
      onState: state => this.renderState(state),
      onCall: (name, status) => { const target = document.getElementById('mcp-last-call'); if (target) target.textContent = `${name} · ${status}`; }
    });
  }
  init() {
    document.getElementById('mcp-bridge-form')?.addEventListener('submit', event => { event.preventDefault(); void this.connect(); });
    document.getElementById('mcp-disconnect')?.addEventListener('click', () => this.disconnect());
    window.addEventListener('pagehide', () => this.disconnect());
    this.renderState('DISABLED');
  }
  renderState(state) {
    const target = document.getElementById('mcp-status');
    if (target) target.textContent = MCP_BRIDGE_LABELS[state] || state;
    const busy = !['DISABLED', 'FAILED', 'DISPLACED'].includes(state);
    const button = document.getElementById('mcp-connect'); if (button) button.disabled = busy;
    const disconnect = document.getElementById('mcp-disconnect'); if (disconnect) disconnect.disabled = !busy;
    if (['FAILED', 'DISPLACED'].includes(state)) { this.releaseLock?.(); this.releaseLock = null; }
  }
  async connect() {
    if (this.connecting) return;
    this.connecting = true;
    let acquired = false;
    try {
      if (!['https:', 'http:'].includes(location.protocol) || !globalThis.isSecureContext) throw new Error('请从 HTTPS 或本机 localhost 页面连接桥接');
      if (navigator.locks) {
        acquired = await new Promise((resolve, reject) => {
          void navigator.locks.request('knowledge-master-mcp-host', { ifAvailable: true }, lock => {
            if (!lock) { resolve(false); return; }
            return new Promise(release => { this.releaseLock = release; resolve(true); });
          }).catch(reject);
        });
        if (!acquired) throw new Error('另一个标签页正在提供 MCP，请先断开它');
      }
      const server = document.getElementById('mcp-server').value.trim();
      const room = document.getElementById('mcp-room').value.trim();
      const input = document.getElementById('mcp-token');
      const token = input.value.trim(); input.value = '';
      // Explicit reconnect establishes a new authorization scope; automatic
      // transport reconnection retains its existing intent ledger.
      this.adapter.ledger.clear();
      await this.transport.start({ server, room, token });
      const url = new URL('/mcp/sse', server.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'));
      url.searchParams.set('room', room);
      document.getElementById('mcp-client-config').textContent = `外部客户端选择 SSE\n地址：${url.href}\n请求头：Authorization: Bearer <同一 Token>\n当前页面关闭后停止服务。`;
    } catch (error) {
      this.transport.stop(); this.releaseLock?.(); this.releaseLock = null;
      document.getElementById('mcp-status').textContent = error.message;
    } finally { this.connecting = false; }
  }
  disconnect() {
    this.transport.stop(); this.releaseLock?.(); this.releaseLock = null;
    const token = document.getElementById('mcp-token'); if (token) token.value = '';
  }
}
