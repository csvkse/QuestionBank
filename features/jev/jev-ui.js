/**
 * JEV UI Renderer
 * Handles rendering the JEV Recommendation Banner, Status Pill, and Configuration Modal.
 */

export class JevUi {
  constructor(app = null) {
    this.app = app;
  }

  /**
   * 渲染全景掌握度上方的 JEV 智能推荐意见横幅
   */
  renderInsightBanner(container, recommendation, config) {
    if (!container) return;

    if (!recommendation || recommendation.isSilent) {
      if (config && config.fallbackPolicy === 'silent') {
        container.innerHTML = `
          <div class="py-2 px-3 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>未配置 JEV 远程推荐接口，当前设为“不推荐”静默模式。</span>
            <button type="button" onclick="app.showJevConfigModal()" class="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
              去配置 JEV &rarr;
            </button>
          </div>
        `;
      } else {
        container.innerHTML = '';
      }
      return;
    }

    const {
      targetCategoryId,
      targetCategoryName,
      headline,
      reason,
      urgency,
      priorityScore,
      actionLabel,
      source,
      fallbackReason
    } = recommendation;

    const isRemote = source === 'remote';
    const badgeText = isRemote ? 'JEV 云端协同' : '启发式降级推荐';
    const badgeColor = isRemote
      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

    const cardGradient = isRemote
      ? 'from-indigo-950/40 via-slate-900 to-slate-900 border-indigo-500/40'
      : 'from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/40';

    const scoreBadge = priorityScore
      ? `<span class="font-mono text-[11px] text-slate-400">综合优先度: <b class="${isRemote ? 'text-indigo-400' : 'text-amber-400'}">${priorityScore}</b></span>`
      : '';

    container.innerHTML = `
      <div class="p-4 rounded-xl bg-gradient-to-r ${cardGradient} border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg ${isRemote ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'} flex items-center justify-center shrink-0 mt-0.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="5"/>
            </svg>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded border font-semibold ${badgeColor}">${badgeText}</span>
              <span class="text-sm font-bold text-white">${headline || `建议重点攻克【${targetCategoryName}】`}</span>
              ${scoreBadge}
            </div>
            <p class="text-xs text-slate-300 mt-1 leading-relaxed">${reason}</p>
            ${fallbackReason ? `<div class="text-[11px] text-amber-400/90 mt-1">提示: ${fallbackReason}</div>` : ''}
          </div>
        </div>
        <button type="button" onclick="app.startSandboxForCategory('${targetCategoryId}')"
          class="btn-primary-cta px-4 py-2 rounded-xl text-xs font-bold shrink-0 shadow-md hover:shadow-lg transition flex items-center justify-center gap-1.5 active:scale-95">
          <span>${actionLabel || '针对该模块定向沙盒试炼'}</span>
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 5l7 7m0 0l-7 7m7-7H3"/>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * 刷新右上角 JEV 状态标牌
   */
  renderStatusPill(pillEl, config, recommendation) {
    if (!pillEl) return;

    if (!config || !config.enabled) {
      if (config && config.fallbackPolicy === 'silent') {
        pillEl.className = 'text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium bg-slate-800 text-slate-400 border-slate-700';
        pillEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>JEV: 未启用</span>';
      } else {
        pillEl.className = 'text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium bg-amber-500/10 text-amber-300 border-amber-500/30';
        pillEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span><span>JEV: 本地降级推荐</span>';
      }
      return;
    }

    if (recommendation && recommendation.source === 'remote') {
      pillEl.className = 'text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      pillEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span>JEV: 云端在线</span>';
    } else if (recommendation && recommendation.source === 'fallback') {
      pillEl.className = 'text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium bg-amber-500/10 text-amber-300 border-amber-500/30';
      pillEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span><span>JEV: 降级自愈</span>';
    } else {
      pillEl.className = 'text-[11px] px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium bg-slate-800 text-slate-400 border-slate-700';
      pillEl.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>JEV: 就绪</span>';
    }
  }

  /**
   * 同步更新 JEV 配置弹窗输入状态
   */
  populateConfigModal(config) {
    const enabledEl = document.getElementById('cfg-jev-enabled');
    const endpointEl = document.getElementById('cfg-jev-endpoint');
    const modelEl = document.getElementById('cfg-jev-model');
    const tokenEl = document.getElementById('cfg-jev-token');
    const remoteFields = document.getElementById('cfg-jev-remote-fields');
    const corsToggleEl = document.getElementById('cfg-jev-cors-proxy');
    const corsPrefixEl = document.getElementById('cfg-jev-cors-prefix');
    const corsWrap = document.getElementById('cfg-jev-cors-proxy-wrap');

    if (enabledEl) enabledEl.checked = !!config.enabled;
    if (endpointEl) endpointEl.value = config.endpoint || '';
    if (modelEl) modelEl.value = config.model || 'jev-latest';
    if (tokenEl) tokenEl.value = config.apiKey || '';

    if (remoteFields) {
      if (config.enabled) remoteFields.classList.remove('hidden');
      else remoteFields.classList.add('hidden');
    }

    if (corsToggleEl) corsToggleEl.checked = !!(config.corsProxyPrefix && config.corsProxyPrefix.trim());
    if (corsPrefixEl) corsPrefixEl.value = config.corsProxyPrefix || '';
    if (corsWrap) {
      if (config.corsProxyPrefix && config.corsProxyPrefix.trim()) corsWrap.classList.remove('hidden');
      else corsWrap.classList.add('hidden');
    }

    const radios = document.getElementsByName('cfg-jev-fallback');
    const currentFallback = config.fallbackPolicy || 'heuristic';
    for (const r of radios) {
      if (r.value === currentFallback) r.checked = true;
    }
  }

  /**
   * 从配置弹窗中读取配置对象 (纯前端零后端模式)
   */
  readConfigFromModal() {
    const enabledEl = document.getElementById('cfg-jev-enabled');
    const endpointEl = document.getElementById('cfg-jev-endpoint');
    const modelEl = document.getElementById('cfg-jev-model');
    const tokenEl = document.getElementById('cfg-jev-token');
    const corsToggleEl = document.getElementById('cfg-jev-cors-proxy');
    const corsPrefixEl = document.getElementById('cfg-jev-cors-prefix');

    let fallbackPolicy = 'heuristic';
    const radios = document.getElementsByName('cfg-jev-fallback');
    for (const r of radios) {
      if (r.checked) fallbackPolicy = r.value;
    }

    const isCustomProxy = corsToggleEl ? corsToggleEl.checked : false;
    const prefixVal = corsPrefixEl ? corsPrefixEl.value.trim() : '';

    return {
      enabled: enabledEl ? enabledEl.checked : false,
      endpoint: endpointEl ? endpointEl.value.trim() : '',
      model: modelEl ? (modelEl.value.trim() || 'jev-latest') : 'jev-latest',
      apiKey: tokenEl ? tokenEl.value.trim() : '',
      corsProxyPrefix: isCustomProxy ? prefixVal : '',
      fallbackPolicy
    };
  }
}
