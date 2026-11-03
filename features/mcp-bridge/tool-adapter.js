import { ALL_TOOL_DEFINITIONS, DECK_TOOL_DEFINITIONS, toToolErrorPayload, adaptToolArgs } from '../ai-agent/index.js';

// Implements the schema keywords used by the shared Agent catalog, without coercion.
export function validateToolValue(value, schema, path = 'arguments', depth = 0) {
  if (depth > 32) throw new Error('参数嵌套过深');
  if (schema.type) {
    const valid = schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
        : schema.type === 'integer' ? Number.isInteger(value) : typeof value === schema.type;
    if (!valid) throw new Error(`${path} 必须是 ${schema.type}`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} 不在允许范围内`);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('包含不允许的参数字段');
      validateToolValue(value[key], schema.properties?.[key] || (Array.isArray(value) ? schema.items : null) || {}, `${path}.${key}`, depth + 1);
    }
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} 缺少必填参数`);
  }
}

export class McpToolAdapter {
  constructor(executor) {
    this.executor = executor;
    const toolList = ALL_TOOL_DEFINITIONS || DECK_TOOL_DEFINITIONS;
    this.catalog = new Map();
    for (const { function: f } of toolList) {
      this.catalog.set(f.name, f);
      if (f.name.startsWith('tool_')) {
        this.catalog.set(f.name.slice(5), { ...f, name: f.name.slice(5) });
      }
    }
    this.ledger = new Map();
  }
  listTools() {
    const list = ALL_TOOL_DEFINITIONS || DECK_TOOL_DEFINITIONS;
    return list.map(({ function: f }) => {
      const canonicalName = f.name.startsWith('tool_') ? f.name.slice(5) : f.name;
      return { name: canonicalName, description: f.description, inputSchema: structuredClone(f.parameters) };
    });
  }
  async callTool(name, args = {}, { operationId } = {}) {
    try {
      const tool = this.catalog.get(name) || (name.startsWith('tool_') ? this.catalog.get(name.slice(5)) : this.catalog.get('tool_' + name));
      if (!tool) throw new Error('未知工具');
      const safeArgs = adaptToolArgs ? adaptToolArgs(name, args) : args;
      validateToolValue(safeArgs, tool.parameters);
      const canonical = value => value && typeof value === 'object'
        ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
      const signature = JSON.stringify([name, canonical(safeArgs)]);
      if (operationId !== undefined && (typeof operationId !== 'string' || !operationId || operationId.length > 128)) throw new Error('operationId 无效');
      if (operationId && this.ledger.has(operationId)) {
        const entry = this.ledger.get(operationId);
        if (entry.signature !== signature) throw new Error('operationId 已用于不同调用');
        return structuredClone(await entry.result);
      }
      const result = (async () => {
        try {
          const execName = name.startsWith('tool_') ? name : ('tool_' + name);
          const value = await this.executor.execute(execName, structuredClone(safeArgs));
          const text = JSON.stringify(value ?? null);
          if (new TextEncoder().encode(text).length > 256 * 1024) {
            if (['tool_list_decks', 'tool_get_deck', 'tool_search_entities', 'tool_get_deck_guide', 'tool_list_deck_versions'].includes(execName)) throw new Error('RESULT_TOO_LARGE：结果超过 256KiB，请缩小查询范围');
            return { content: [{ type: 'text', text: JSON.stringify({ success: true, deckId: value?.deckId || args.deckId, versionId: value?.versionId, message: '操作已完成并保存；结果过大，仅返回成功回执' }) }] };
          }
          return { content: [{ type: 'text', text }] };
        } catch (err) {
          return { isError: true, content: [{ type: 'text', text: JSON.stringify(toToolErrorPayload(err, { name })) }] };
        }
      })();
      if (operationId) {
        this.ledger.set(operationId, { signature, result });
        if (this.ledger.size > 256) this.ledger.delete(this.ledger.keys().next().value);
      }
      return structuredClone(await result);
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify(toToolErrorPayload(err, { name })) }] };
    }
  }
}
