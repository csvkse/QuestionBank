/**
 * AI Agent Multi-Session Store & Custom Multi-Provider Model Persistence
 * Core 2.1: features/ai-agent/session-store.js
 */

import {
  API_PROTOCOLS,
  REFERENCE_PRESET_PROVIDERS,
  DEFAULT_PROVIDERS,
  normalizeModel,
  normalizeProvider
} from './provider-presets.js';

export { API_PROTOCOLS, REFERENCE_PRESET_PROVIDERS, DEFAULT_PROVIDERS };

const STORAGE_KEY = 'knowledge_master_ai_sessions_v2';
const CONFIG_KEY = 'knowledge_master_ai_config_v3';

export const DEFAULT_AI_CONFIG = {
  activeProviderId: 'deepseek',
  activeModelId: 'deepseek-reasoner',
  providers: DEFAULT_PROVIDERS,
  provider: 'deepseek',
  apiType: 'openai',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-reasoner',
  contextWindow: 128000,
  maxOutputTokens: 8192,
  reasoningEffort: 'medium', // none | low | medium | high
  autoApprove: false,
  systemPrompt: '你是 Knowledge Master 通用知识记忆图谱系统的 AI 智囊专家。你可以调用系统题库工具为用户查询、创建、编辑题库，严格遵循同胞干扰项 >= 4 条的黄金认知门禁。'
};

export class SessionStore {
  constructor() {
    this.sessions = this.loadSessions();
    this.config = this.loadConfig();
    this.activeSessionId = this.sessions[0]?.id || this.createSession().id;
  }

  loadConfig() {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.providers) && parsed.providers.length > 0) {
          parsed.providers = parsed.providers.map(normalizeProvider);
        } else {
          parsed.providers = DEFAULT_PROVIDERS;
        }
        return { ...DEFAULT_AI_CONFIG, ...parsed };
      }
      return { ...DEFAULT_AI_CONFIG };
    } catch {
      return { ...DEFAULT_AI_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
      }
    } catch (e) {
      console.warn('Failed to save AI config:', e);
    }
  }

  getProviders() {
    return (this.config.providers || DEFAULT_PROVIDERS).map(normalizeProvider);
  }

  getActiveProvider() {
    const list = this.getProviders();
    return list.find(p => p.id === this.config.activeProviderId) || list[0];
  }

  setActiveProvider(providerId) {
    this.config.activeProviderId = providerId;
    const provider = this.getActiveProvider();
    if (provider) {
      this.config.provider = provider.id;
      this.config.apiType = provider.apiType || 'openai';
      this.config.baseUrl = provider.baseUrl;
      this.config.apiKey = provider.apiKey || '';
      const m = provider.models.find(x => x.id === provider.defaultModel) || provider.models[0];
      if (m) {
        this.config.activeModelId = m.id;
        this.config.model = m.id;
        this.config.contextWindow = m.contextWindow;
        this.config.maxOutputTokens = m.maxOutputTokens;
      }
    }
    this.saveConfig({});
  }

  getActiveModel() {
    const provider = this.getActiveProvider();
    return provider.models.find(m => m.id === this.config.activeModelId) || provider.models[0];
  }

  switchModel(providerId, modelId) {
    const provider = this.getProviders().find(p => p.id === providerId);
    if (!provider) return;
    this.config.activeProviderId = providerId;
    this.config.activeModelId = modelId;
    this.config.provider = provider.id;
    this.config.apiType = provider.apiType || 'openai';
    this.config.baseUrl = provider.baseUrl;
    this.config.apiKey = provider.apiKey || '';
    this.config.model = modelId;
    const m = provider.models.find(x => x.id === modelId) || provider.models[0];
    if (m) {
      this.config.contextWindow = m.contextWindow;
      this.config.maxOutputTokens = m.maxOutputTokens;
    }
    this.saveConfig({});
  }

  addProvider(provider) {
    const normalized = normalizeProvider(provider);
    this.config.providers = this.config.providers || [];
    this.config.providers.push(normalized);
    this.saveConfig({});
    return normalized;
  }

  updateProvider(providerIdOrObj, updates) {
    const targetId = typeof providerIdOrObj === 'string' ? providerIdOrObj : providerIdOrObj?.id;
    const patch = (typeof providerIdOrObj === 'object' && !updates) ? providerIdOrObj : (updates || {});
    const p = (this.config.providers || []).find(x => x.id === targetId);
    if (p) {
      Object.assign(p, patch);
      if (patch.models) p.models = patch.models.map(normalizeModel);
      if (this.config.activeProviderId === targetId) {
        if (patch.baseUrl) this.config.baseUrl = patch.baseUrl;
        if (patch.apiKey !== undefined) this.config.apiKey = patch.apiKey;
        if (patch.apiType) this.config.apiType = patch.apiType;
      }
      this.saveConfig({});
    }
  }

  deleteProvider(providerId) {
    this.config.providers = (this.config.providers || []).filter(p => p.id !== providerId);
    if (this.config.activeProviderId === providerId && this.config.providers.length > 0) {
      const nextP = this.config.providers[0];
      this.switchModel(nextP.id, nextP.models[0]?.id || 'default');
    }
    this.saveConfig({});
  }

  importFromPreset(presetId) {
    const ref = REFERENCE_PRESET_PROVIDERS.find(x => x.id === presetId);
    if (!ref) return null;
    const clone = JSON.parse(JSON.stringify(ref));
    clone.id = 'preset_' + ref.id + '_' + Date.now();
    clone.name = ref.name + ' (参考模板)';
    return this.addProvider(clone);
  }

  addModel(providerId, model) {
    const p = (this.config.providers || []).find(x => x.id === providerId);
    if (p) {
      const mObj = normalizeModel(model);
      if (!p.models) p.models = [];
      const existing = p.models.find(x => x.id === mObj.id);
      if (existing) {
        Object.assign(existing, mObj);
      } else {
        p.models.push(mObj);
      }
      this.saveConfig({});
    }
  }

  updateModel(providerId, modelId, updates) {
    const p = (this.config.providers || []).find(x => x.id === providerId);
    if (p && p.models) {
      const m = p.models.find(x => x.id === modelId);
      if (m) {
        Object.assign(m, updates);
        if (this.config.activeModelId === modelId) {
          if (updates.contextWindow) this.config.contextWindow = updates.contextWindow;
          if (updates.maxOutputTokens) this.config.maxOutputTokens = updates.maxOutputTokens;
        }
        this.saveConfig({});
      }
    }
  }

  deleteModel(providerId, modelId) {
    const p = (this.config.providers || []).find(x => x.id === providerId);
    if (p && p.models && p.models.length > 1) {
      p.models = p.models.filter(m => m.id !== modelId);
      if (this.config.activeModelId === modelId) {
        this.switchModel(providerId, p.models[0].id);
      } else {
        this.saveConfig({});
      }
    }
  }

  loadSessions() {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load AI sessions:', e);
    }
    return [{
      id: 'sess_' + Date.now(),
      title: '智能题库助手引导',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [{
        id: 'm_welcome',
        role: 'assistant',
        content: '你好！我是 Knowledge Master 的 AI 智囊专家。\n我可以帮你：\n- **通过自然语言生成/创建题库** (如：“为我创建一套 Kubernetes 考题”)\n- **查询已有题库与考点覆盖率**\n- **润色易错陷阱说明与同胞干扰项**\n\n请在下方输入需求或点击快捷指令开始！'
      }]
    }];
  }

  saveSessions() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
      }
    } catch (e) {
      console.warn('Failed to save AI sessions:', e);
    }
  }

  createSession(title = '新会话') {
    const newSession = {
      id: 'sess_' + Date.now(),
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [{
        id: 'm_' + Date.now(),
        role: 'assistant',
        content: '你好！我是你的专属题库智囊助手。请问今天想学习或创建什么知识库？'
      }]
    };
    this.sessions.unshift(newSession);
    this.activeSessionId = newSession.id;
    this.saveSessions();
    return newSession;
  }

  deleteSession(id) {
    this.sessions = this.sessions.filter(s => s.id !== id);
    if (this.sessions.length === 0) this.createSession();
    else if (this.activeSessionId === id) this.activeSessionId = this.sessions[0].id;
    this.saveSessions();
  }

  clearAllSessions() {
    this.sessions = [];
    const sess = this.createSession();
    this.activeSessionId = sess.id;
    this.saveSessions();
  }

  getActiveSession() {
    return this.sessions.find(s => s.id === this.activeSessionId) || this.sessions[0];
  }

  appendMessage(message) {
    const sess = this.getActiveSession();
    if (!sess) return;
    sess.messages.push({ ...message, timestamp: Date.now() });
    sess.updatedAt = Date.now();
    if (sess.messages.length <= 3 && message.role === 'user') {
      const summary = message.content.slice(0, 15).replace(/\n/g, ' ');
      sess.title = summary.length >= 15 ? summary + '...' : summary;
    }
    this.saveSessions();
  }

  updateMessage(msgId, updater) {
    const sess = this.getActiveSession();
    if (!sess || !sess.messages) return;
    const msg = sess.messages.find(m => m.id === msgId);
    if (msg) {
      if (typeof updater === 'function') updater(msg);
      else Object.assign(msg, updater);
      sess.updatedAt = Date.now();
      this.saveSessions();
    }
  }
}
