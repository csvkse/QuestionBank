/**
 * JEV (Judgement & Evaluation Vector) Recommendation Client
 * Evaluates category mastery panorama and produces targeted learning recommendations.
 * Supports Remote REST JEV protocol with local heuristic fallback.
 */

export const DEFAULT_JEV_CONFIG = {
  enabled: false,
  endpoint: '',
  model: 'jev-latest',
  apiKey: '',
  timeoutMs: 6000,
  fallbackPolicy: 'heuristic', // 'heuristic' | 'silent'
  autoEvaluate: true,
  corsProxyPrefix: ''
};
export const JEV_STORAGE_KEY = 'knowledge_master_jev_config';

export class JevClient {
  constructor(storageAdapter = null) {
    this.storage = storageAdapter || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (!this.storage) return { ...DEFAULT_JEV_CONFIG };
      const raw = this.storage.getItem(JEV_STORAGE_KEY);
      return raw ? { ...DEFAULT_JEV_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_JEV_CONFIG };
    } catch {
      return { ...DEFAULT_JEV_CONFIG };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      if (this.storage) this.storage.setItem(JEV_STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.warn('[JEV] Failed to persist config:', e);
    }
    return this.config;
  }

  resetConfig() {
    this.config = { ...DEFAULT_JEV_CONFIG };
    try {
      if (this.storage) this.storage.removeItem(JEV_STORAGE_KEY);
    } catch (e) {
      console.warn('[JEV] Failed to reset config:', e);
    }
    return this.config;
  }

  getConfig() {
    return { ...this.config };
  }

  /**
   * 解析端点 URL：纯前端原生直连，零后端依赖
   */
  buildEndpointUrl(endpoint) {
    if (!endpoint) return '';
    const raw = endpoint.trim();
    if (this.config.corsProxyPrefix && this.config.corsProxyPrefix.trim()) {
      const prefix = this.config.corsProxyPrefix.trim();
      return prefix.includes('?url=') ? `${prefix}${encodeURIComponent(raw)}` : `${prefix.replace(/\/$/, '')}/${raw}`;
    }
    return raw;
  }

  formatError(err) {
    const msg = err?.message || String(err);
    if (msg.includes('401') || msg.includes('API key is required')) return '目标接口鉴权失败 (HTTP 401)：请检查 API Key。';
    if (msg.includes('403')) return '目标接口拒绝访问 (HTTP 403)：请检查访问权限或 API Key。';
    if (err instanceof TypeError || msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('CORS')) {
      return '目标服务未开放浏览器跨域权限 (CORS)。纯前端已自动切换为本地启发式智能推荐。';
    }
    return msg;
  }

  /**
   * Main evaluation entry point
   */
  async evaluate(panorama = [], deckMeta = {}) {
    if (!Array.isArray(panorama) || panorama.length === 0) return null;
    const { enabled, endpoint, fallbackPolicy } = this.config;

    // 1. 若配置了远程接口并启用，优先走远程调用
    if (enabled && endpoint && typeof endpoint === 'string' && endpoint.trim().length > 0) {
      try {
        const remoteResult = await this.callRemoteJev(panorama, deckMeta);
        if (remoteResult && remoteResult.targetCategoryId) {
          return { ...remoteResult, source: 'remote', isFallback: false };
        }
      } catch (err) {
        const friendlyError = this.formatError(err);
        console.warn('[JEV] Remote evaluation failed, inspecting fallback:', friendlyError);
        if (fallbackPolicy === 'silent') {
          return { isSilent: true, error: friendlyError, source: 'silent' };
        }
        const fallbackResult = this.runHeuristicEvaluation(panorama, deckMeta);
        return {
          ...fallbackResult,
          source: 'fallback',
          isFallback: true,
          fallbackReason: `远程接口连接异常 (${friendlyError})，已切换为本地启发式推荐`
        };
      }
    }

    // 2. 若未启用或未配置远程 JEV 接口
    if (fallbackPolicy === 'silent') return null;
    const heuristicResult = this.runHeuristicEvaluation(panorama, deckMeta);
    return { ...heuristicResult, source: 'heuristic', isFallback: true };
  }

  /**
   * 本地启发式多维风险矩阵推荐算法
   */
  runHeuristicEvaluation(panorama = [], deckMeta = {}) {
    if (!panorama || panorama.length === 0) return null;
    let highestRiskScore = -1, chosenCategory = null;
    panorama.forEach(cat => {
      const total = Math.max(cat.total || 0, 1), learned = cat.learned || 0, mastered = cat.mastered || 0;
      const dueRatio = Math.min((cat.dueCount || 0) / total, 1), mistakeRatio = Math.min((cat.mistakeCount || 0) / total, 1);
      const unlearned = Math.max(0, 1 - (learned / total)), unmastered = learned > 0 ? Math.max(0, 1 - (mastered / learned)) : 1;
      const score = (dueRatio * 0.35) + (mistakeRatio * 0.30) + (unlearned * 0.25) + (unmastered * 0.10);
      if (score > highestRiskScore) { highestRiskScore = score; chosenCategory = { ...cat, calculatedRisk: score }; }
    });
    if (!chosenCategory) { chosenCategory = panorama[0]; highestRiskScore = 0.2; }
    const isDueCrisis = (chosenCategory.dueCount || 0) >= 5, isMistakeCrisis = (chosenCategory.mistakeCount || 0) >= 4;
    const urgency = (highestRiskScore >= 0.35 || isDueCrisis || isMistakeCrisis) ? 'HIGH' : (highestRiskScore >= 0.20 ? 'MEDIUM' : 'LOW');
    let reason = '';
    if (chosenCategory.dueCount > 0 && chosenCategory.mistakeCount > 0) {
      reason = `当前掌握度 ${chosenCategory.coveragePercent || 0}%，存在 ${chosenCategory.dueCount} 个待复习点与 ${chosenCategory.mistakeCount} 处错题。`;
    } else if (chosenCategory.dueCount > 0) {
      reason = `检测到 ${chosenCategory.dueCount} 个条目到达复习临界周期，建议立即巩固。`;
    } else if (chosenCategory.mistakeCount > 0) {
      reason = `历史累计 ${chosenCategory.mistakeCount} 处混淆失误，建议定向辨析盲区。`;
    } else if ((chosenCategory.coveragePercent || 0) < 60) {
      reason = `当前覆盖率仅 ${chosenCategory.coveragePercent || 0}%，为新知识重点拓荒板块。`;
    } else {
      reason = `该板块基础扎实，建议进行沙盒自测或进阶冲刺。`;
    }
    return {
      targetCategoryId: chosenCategory.id,
      targetCategoryName: chosenCategory.name,
      urgency,
      priorityScore: Math.round(highestRiskScore * 100),
      headline: `建议重点攻克【${chosenCategory.name}】`,
      reason,
      suggestedAction: 'sandbox',
      actionLabel: '一键开启该模块沙盒试炼'
    };
  }

  /**
   * 发送远程 HTTP REST 请求调用 JEV 接口 (支持 TypeSafe SystemOne 与通用 REST)
   */
  async callRemoteJev(panorama = [], deckMeta = {}) {
    const { endpoint, apiKey, model, timeoutMs } = this.config;
    if (!endpoint) throw new Error('JEV endpoint not configured');

    const targetUrl = this.buildEndpointUrl(endpoint);
    const selectedModel = (model || 'jev-latest').trim();
    const isSystemOne = targetUrl.includes('/systemone');

    let payload;
    if (isSystemOne) {
      const criteria = {};
      panorama.forEach(c => {
        criteria[c.id] = `${c.name}: 掌握度${c.coveragePercent || 0}%, 待复习${c.dueCount || 0}项, 错题${c.mistakeCount || 0}项`;
      });
      payload = {
        model: selectedModel,
        state: {
          deckTitle: deckMeta.title || '当前题库',
          totalEntities: deckMeta.totalEntities || 0,
          summary: panorama.map(c => `板块[${c.name}]: 掌握度${c.coveragePercent}%, 到期${c.dueCount}, 错题${c.mistakeCount}`).join('; ')
        },
        questions: {
          target_category: {
            type: 'choice',
            instructions: 'Which category urgently needs targeted breakthrough training?',
            criteria
          },
          urgency: {
            type: 'choice',
            instructions: 'What is the urgency level?',
            criteria: { HIGH: 'Critical crisis', MEDIUM: 'Moderate attention', LOW: 'Routine' }
          }
        }
      };
    } else {
      payload = {
        model: selectedModel,
        deckId: deckMeta.id || 'current_deck',
        deckTitle: deckMeta.title || '当前题库',
        totalEntities: deckMeta.totalEntities || 0,
        timestamp: Date.now(),
        panorama: panorama.map(c => ({
          id: c.id, name: c.name, group: c.group || '', total: c.total,
          learned: c.learned, mastered: c.mastered, dueCount: c.dueCount,
          mistakeCount: c.mistakeCount, coveragePercent: c.coveragePercent
        }))
      };
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutTimer = controller ? setTimeout(() => controller.abort(), timeoutMs || 6000) : null;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      if (!res.ok) {
        let errDetail = '';
        try { const errJson = await res.json(); errDetail = errJson?.detail?.message || errJson?.message || ''; } catch {}
        throw new Error(`HTTP ${res.status}${errDetail ? ': ' + errDetail : ''}`);
      }

      const data = await res.json();
      if (data?.answers?.target_category) {
        const chosenId = data.answers.target_category.choice;
        const found = panorama.find(c => c.id === chosenId) || panorama[0];
        const conf = data.answers.target_category.confidence || 1.0;
        const urg = data.answers.urgency?.choice || 'HIGH';
        return {
          targetCategoryId: found.id,
          targetCategoryName: found.name,
          urgency: urg,
          priorityScore: Math.round(conf * 100),
          headline: `JEV【${data.model || selectedModel}】建议重点突破【${found.name}】`,
          reason: `TypeSafe JEV 模型研判：综合掌握度 ${found.coveragePercent || 0}%，存在 ${found.dueCount || 0} 个待复习点与 ${found.mistakeCount || 0} 处错题。`,
          suggestedAction: 'sandbox',
          actionLabel: '一键开启该模块沙盒试炼'
        };
      }
      if (data?.recommendation) return data.recommendation;
      if (data?.targetCategoryId) return data;
      throw new Error('未识别的 JEV 接口响应结构');
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }

  /**
   * 测试远程 JEV 接口连通性 (支持自定义模型)
   */
  async testConnection(endpoint, apiKey, model = '') {
    if (!endpoint || !endpoint.trim()) {
      return { success: false, message: '请输入有效的 JEV 接口端点 URL' };
    }
    const targetUrl = this.buildEndpointUrl(endpoint);
    const selectedModel = (model || this.config.model || 'jev-latest').trim();
    const isSystemOne = targetUrl.includes('/systemone');

    const testPayload = isSystemOne
      ? {
          model: selectedModel,
          state: 'Health check connection ping.',
          questions: { ping: { type: 'noul', instructions: 'Is the service available and ready to evaluate?' } }
        }
      : { model: selectedModel, ping: true, timestamp: Date.now(), deckId: 'test_deck', panorama: [] };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey && apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      const res = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(testPayload) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, message: `JEV 连接成功！模型: ${data.model || selectedModel} (HTTP ${res.status})` };
      }
      let errDetail = '';
      try {
        const errJson = await res.json();
        errDetail = errJson?.detail?.message || errJson?.error?.message || errJson?.message || '';
      } catch {}
      return {
        success: false,
        message: `接口响应 HTTP ${res.status}${errDetail ? ': ' + errDetail : (res.statusText ? ' ' + res.statusText : '')}`
      };
    } catch (err) {
      return { success: false, message: `连接失败: ${this.formatError(err)}` };
    }
  }
}
