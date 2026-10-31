/**
 * MCP 客户端配置适配器体系
 * 负责针对主流 AI 客户端（Cursor、Claude Desktop、Cline、Windsurf、Claude Code）
 * 生成标准化、结构完整且语法正确的 JSON / 命令行导入配置。
 */

export class CursorConfigAdapter {
  formatConfig({ endpointUrl, token, includeToken }) {
    const authToken = includeToken && token ? token : '<YOUR_TOKEN>';
    const config = {
      mcpServers: {
        'knowledge-arena': {
          url: endpointUrl || 'https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM',
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      }
    };
    return JSON.stringify(config, null, 2);
  }
}

export class ClaudeDesktopAdapter {
  formatConfig({ endpointUrl, token, includeToken }) {
    const authToken = includeToken && token ? token : '<YOUR_TOKEN>';
    const url = endpointUrl || 'https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM';
    // Claude Desktop 仅支持 stdio 子进程，必须通过 mcp-remote 命令行中间件转发
    const config = {
      mcpServers: {
        'knowledge-arena': {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            url,
            '--header',
            `Authorization:Bearer ${authToken}`
          ]
        }
      }
    };
    return JSON.stringify(config, null, 2);
  }
}

export class ClineConfigAdapter {
  formatConfig({ endpointUrl, token, includeToken }) {
    const authToken = includeToken && token ? token : '<YOUR_TOKEN>';
    const config = {
      mcpServers: {
        'knowledge-arena': {
          type: 'sse',
          url: endpointUrl || 'https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM',
          headers: {
            Authorization: `Bearer ${authToken}`
          },
          disabled: false,
          autoApprove: [
            'tool_get_overview',
            'tool_list_decks',
            'tool_get_deck'
          ]
        }
      }
    };
    return JSON.stringify(config, null, 2);
  }
}

export class WindsurfConfigAdapter {
  formatConfig({ endpointUrl, token, includeToken }) {
    const authToken = includeToken && token ? token : '<YOUR_TOKEN>';
    const config = {
      mcpServers: {
        'knowledge-arena': {
          serverUrl: endpointUrl || 'https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM',
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      }
    };
    return JSON.stringify(config, null, 2);
  }
}

export class ClaudeCodeCliAdapter {
  formatConfig({ endpointUrl, token, includeToken }) {
    const authToken = includeToken && token ? token : '<YOUR_TOKEN>';
    const url = endpointUrl || 'https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM';
    return `claude mcp add --transport sse knowledge-arena "${url}" --header "Authorization: Bearer ${authToken}"`;
  }
}

export class ClientConfigRegistry {
  constructor() {
    this.adapters = new Map([
      ['cursor', { id: 'cursor', label: 'Cursor', adapter: new CursorConfigAdapter(), lang: 'json' }],
      ['claude-desktop', { id: 'claude-desktop', label: 'Claude Desktop', adapter: new ClaudeDesktopAdapter(), lang: 'json' }],
      ['cline', { id: 'cline', label: 'Cline', adapter: new ClineConfigAdapter(), lang: 'json' }],
      ['windsurf', { id: 'windsurf', label: 'Windsurf', adapter: new WindsurfConfigAdapter(), lang: 'json' }],
      ['claude-code', { id: 'claude-code', label: 'Claude CLI', adapter: new ClaudeCodeCliAdapter(), lang: 'bash' }]
    ]);
  }

  listClients() {
    return Array.from(this.adapters.values()).map(({ id, label, lang }) => ({ id, label, lang }));
  }

  generate(clientId, { endpointUrl, token, includeToken = true } = {}) {
    const entry = this.adapters.get(clientId) || this.adapters.get('cursor');
    return {
      id: entry.id,
      label: entry.label,
      lang: entry.lang,
      code: entry.adapter.formatConfig({ endpointUrl, token, includeToken })
    };
  }
}
