import { bridgeConnectionUrl } from '../../platform/network/browser-bridge-transport.js';

const MCP_PREFERENCES_KEY = 'knowledge_master_mcp_preferences_v1';
export class McpPreferences {
  constructor(getStorage = () => globalThis.localStorage) { this.getStorage = getStorage; }
  load() {
    try {
      const value = JSON.parse(this.getStorage()?.getItem(MCP_PREFERENCES_KEY) || 'null');
      if (!value || typeof value.server !== 'string' || typeof value.room !== 'string') return null;
      bridgeConnectionUrl(value.server, value.room);
      return { server: value.server, room: value.room };
    } catch { return null; }
  }
  save({ server, room }) {
    try {
      bridgeConnectionUrl(server, room);
      this.getStorage().setItem(MCP_PREFERENCES_KEY, JSON.stringify({ server, room })); return true;
    } catch { return false; }
  }
  clear() {
    try { this.getStorage().removeItem(MCP_PREFERENCES_KEY); return true; } catch { return false; }
  }
}

export function createClientEndpoint(server, room) {
  const url = bridgeConnectionUrl(server, room);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/mcp/sse'; url.searchParams.delete('role');
  return url.href;
}

export function mcpPresentation(state) {
  const labels = { DISABLED: '未连接', CONNECTING: '连接中', REGISTERING: '正在注册工具', REGISTERED: '已连接，等待外部调用验证', READY: '已验证，可调用', BACKOFF: '连接中断，正在重连', DISPLACED: '同房间已有新连接，请使用独立房间', FAILED: '连接失败，请检查地址、Token 与网关开关' };
  return { label: labels[state] || '未知状态', locked: !['DISABLED', 'FAILED', 'DISPLACED'].includes(state), connected: ['REGISTERED', 'READY'].includes(state) };
}
