/**
 * AI Provider Protocols & Reference Preset Templates
 * Core 2.1: features/ai-agent/provider-presets.js
 */

export const API_PROTOCOLS = [
  { id: 'openai', name: 'OpenAI 兼容协议 (Chat Completions)', defaultPath: '/chat/completions' },
  { id: 'anthropic', name: 'Anthropic Claude (Messages)', defaultPath: '/messages' },
  { id: 'gemini', name: 'Google Gemini (GenerateContent)', defaultPath: '/models/{model}:streamGenerateContent' },
  { id: 'ollama', name: 'Ollama Native (/api/chat)', defaultPath: '/api/chat' }
];

export const REFERENCE_PRESET_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    apiType: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    models: [
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (深度推理)', contextWindow: 128000, maxOutputTokens: 8192, reasoning: true },
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (通用对话)', contextWindow: 128000, maxOutputTokens: 8192, reasoning: false }
    ],
    defaultModel: 'deepseek-reasoner',
    enabled: true
  },
  {
    id: 'openai',
    name: 'OpenAI 官方',
    apiType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: [
      { id: 'o3-mini', name: 'o3-mini (快速推理)', contextWindow: 200000, maxOutputTokens: 100000, reasoning: true },
      { id: 'o1', name: 'o1 (满血推理)', contextWindow: 200000, maxOutputTokens: 100000, reasoning: true },
      { id: 'gpt-4o', name: 'GPT-4o (全能旗舰)', contextWindow: 128000, maxOutputTokens: 16384, reasoning: false },
      { id: 'gpt-4o-mini', name: 'GPT-4o-mini (轻快敏捷)', contextWindow: 128000, maxOutputTokens: 16384, reasoning: false }
    ],
    defaultModel: 'o3-mini',
    enabled: true
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    apiType: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    models: [
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1 (硅基托管)', contextWindow: 64000, maxOutputTokens: 8192, reasoning: true },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3 (硅基托管)', contextWindow: 64000, maxOutputTokens: 8192, reasoning: false },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct', contextWindow: 32000, maxOutputTokens: 4096, reasoning: false }
    ],
    defaultModel: 'deepseek-ai/DeepSeek-R1',
    enabled: true
  },
  {
    id: 'ollama',
    name: '本地 Ollama',
    apiType: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    models: [
      { id: 'deepseek-r1:8b', name: 'DeepSeek-R1 8B (本地轻量)', contextWindow: 32000, maxOutputTokens: 4096, reasoning: true },
      { id: 'qwen2.5:7b', name: 'Qwen2.5 7B (本地高性价比)', contextWindow: 32000, maxOutputTokens: 4096, reasoning: false },
      { id: 'llama3.3:70b', name: 'Llama 3.3 70B (本地高精度)', contextWindow: 128000, maxOutputTokens: 8192, reasoning: false }
    ],
    defaultModel: 'deepseek-r1:8b',
    enabled: true
  },
  {
    id: 'qwen',
    name: '阿里千问 (百炼)',
    apiType: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    models: [
      { id: 'qwen-max', name: '通义千问 Max', contextWindow: 32000, maxOutputTokens: 8192, reasoning: false },
      { id: 'qwen-plus', name: '通义千问 Plus', contextWindow: 128000, maxOutputTokens: 8192, reasoning: false },
      { id: 'qwen-turbo', name: '通义千问 Turbo', contextWindow: 128000, maxOutputTokens: 8192, reasoning: false }
    ],
    defaultModel: 'qwen-max',
    enabled: true
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    apiType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (混合推理)', contextWindow: 200000, maxOutputTokens: 64000, reasoning: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (轻巧极速)', contextWindow: 200000, maxOutputTokens: 8192, reasoning: false }
    ],
    defaultModel: 'claude-3-7-sonnet-20250219',
    enabled: true
  }
];

export function normalizeModel(m) {
  if (typeof m === 'string') {
    const isReasoning = m.includes('reason') || m.includes('r1') || m.includes('o1') || m.includes('o3');
    return {
      id: m,
      name: m,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      reasoning: isReasoning
    };
  }
  return {
    id: m.id || m.name || 'custom-model',
    name: m.name || m.id || 'Custom Model',
    contextWindow: Number(m.contextWindow) || 128000,
    maxOutputTokens: Number(m.maxOutputTokens) || 8192,
    reasoning: !!m.reasoning
  };
}

export function normalizeProvider(p) {
  const models = Array.isArray(p.models) ? p.models.map(normalizeModel) : [];
  return {
    id: p.id || 'provider_' + Date.now(),
    name: p.name || '自定义平台',
    apiType: p.apiType || 'openai',
    baseUrl: p.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: p.apiKey || '',
    models: models.length > 0 ? models : [normalizeModel('default-model')],
    defaultModel: p.defaultModel || models[0]?.id || 'default-model',
    enabled: p.enabled !== false
  };
}

export const DEFAULT_PROVIDERS = REFERENCE_PRESET_PROVIDERS.map(normalizeProvider);
