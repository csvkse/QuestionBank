import { bridgeConnectionUrl } from '../../platform/network/browser-bridge-transport.js';

const MCP_PREFERENCES_KEY_V1 = 'knowledge_master_mcp_preferences_v1';
const MCP_PREFERENCES_KEY_V2 = 'knowledge_master_mcp_preferences_v2';

export class McpPreferences {
  constructor(getStorage = () => globalThis.localStorage) {
    this.getStorage = getStorage;
  }

  load() {
    try {
      const storage = this.getStorage?.();
      let raw = storage?.getItem(MCP_PREFERENCES_KEY_V2);
      if (!raw) raw = storage?.getItem(MCP_PREFERENCES_KEY_V1);
      if (!raw) return null;

      const value = JSON.parse(raw);
      if (!value || typeof value.server !== 'string' || typeof value.room !== 'string') return null;
      bridgeConnectionUrl(value.server, value.room);

      if (value.rememberToken && typeof value.tokenEnc === 'string') {
        const token = this._deobfuscate(value.tokenEnc);
        if (token) return { server: value.server, room: value.room, token, rememberToken: true };
      }
      return { server: value.server, room: value.room };
    } catch {
      return null;
    }
  }

  save({ server, room, token, rememberToken }) {
    try {
      bridgeConnectionUrl(server, room);
      const isRemember = Boolean(rememberToken);
      const payload = {
        server,
        room,
        rememberToken: isRemember,
        tokenEnc: isRemember && token ? this._obfuscate(token) : null
      };
      this.getStorage()?.setItem(MCP_PREFERENCES_KEY_V2, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      const storage = this.getStorage?.();
      storage?.removeItem(MCP_PREFERENCES_KEY_V2);
      storage?.removeItem(MCP_PREFERENCES_KEY_V1);
      return true;
    } catch {
      return false;
    }
  }

  _obfuscate(text) {
    try {
      return btoa(encodeURIComponent(text).split('').reverse().join(''));
    } catch {
      return text;
    }
  }

  _deobfuscate(encoded) {
    try {
      return decodeURIComponent(atob(encoded).split('').reverse().join(''));
    } catch {
      return encoded;
    }
  }
}

export function createClientEndpoint(server, room) {
  const url = bridgeConnectionUrl(server, room);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '/mcp/sse';
  url.searchParams.delete('role');
  return url.href;
}

export function mcpPresentation(state) {
  const labels = {
    DISABLED: '未连接',
    CONNECTING: '连接中',
    REGISTERING: '正在注册工具',
    REGISTERED: '已连接，等待外部调用验证',
    READY: '已验证，可调用',
    BACKOFF: '连接中断，正在重连',
    DISPLACED: '同房间已有新连接，请使用独立房间',
    FAILED: '连接失败，请检查地址、Token 与网关开关'
  };
  return {
    label: labels[state] || '未知状态',
    locked: !['DISABLED', 'FAILED', 'DISPLACED'].includes(state),
    connected: ['REGISTERED', 'READY'].includes(state)
  };
}
