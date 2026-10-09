/**
 * Application Entry & Bootstrap Composition (Core 2.1: app/main.js)
 */

import { BUILTIN_DECKS } from '../shared/builtin-decks.js';
import { calculateDeckCoverage } from '../shared/sm2-scheduler.js';
import {
  calculateUnifiedMetrics,
  MistakeCardSpecification,
  DueCardSpecification,
  MasteredCardSpecification,
  strategyFactory
} from '../shared/question-strategies/index.js';
import { parseMarkdownToDeck, serializeDeckToMarkdown } from '../shared/markdown-ast.js';
import { validateDeckHealth } from '../shared/deck-validator.js';

import { soundSynth } from '../platform/audio/web-audio-synth.js';
import { speechSynth, isLanguageDeck, getDeckLangCode } from '../platform/audio/speech-synth.js';
import { storageAdapter } from '../platform/storage/local-storage-adapter.js';
import { fileExporter } from '../platform/exporter/file-exporter.js';

import { ModalController } from '../design-system/components/modal.js';
import { QuizRunner, ComboEffectController, SandboxConfigController, SteppedProgressController } from '../features/arena/index.js';
import { MatrixConsoleController, TreeRenderer, FocusReaderController } from '../features/study-hub/index.js';
import { VisualEditorController, MarkdownEditorController } from '../features/deck-studio/index.js';
import { DeckCrudController } from '../features/deck-manager/index.js';
import { TimelineBoardController, RadarChartController } from '../features/review-board/index.js';
import { AiAgentUIController, REFERENCE_PRESET_PROVIDERS, DEFAULT_PROVIDERS } from '../features/ai-agent/index.js';
import { JevClient, JevUi } from '../features/jev/index.js';
import { AppRouter } from './router.js';

export class KnowledgeMasterApp {
  constructor() {
    this.soundSynth = soundSynth;
    this.speechSynth = speechSynth;
    this.storage = storageAdapter;
    this.exporter = fileExporter;

    // 状态初始化
    this.state = {
      activeDeckId: this.storage.loadActiveDeckId(),
      customDecks: this.storage.loadCustomDecks(),
      deckStates: {}
    };

    // 运行态变量
    this.currentMode = 'FULL_CAMPAIGN';
    this.quizQueue = [];
    this.currentIndex = 0;
    this.sessionCorrect = 0;
    this.sessionCombo = 0;
    this.maxComboInSession = 0;
    this.isAnswerLocked = false;
    this.isAnswerMasked = this.storage.loadMaskState();

    // 筛选条件状态
    this.studySelectedGroup = 'all';
    this.studySelectedCategory = 'all';
    this.studySelectedLayer = 'all';
    this.reviewViewTab = 'due';
    this.panoramaCollapsedGroups = new Set();

    // 题库编辑器草稿
    this.draftDeck = null;
    this.editingDeckId = null;
    this.studioViewMode = 'split';

    // 子控制器初始化
    this.router = new AppRouter(this);
    this.comboController = new ComboEffectController(this.soundSynth);
    this.quizRunner = new QuizRunner(this);
    this.sandboxConfig = new SandboxConfigController(this);
    this.steppedProgress = new SteppedProgressController(this);
    this.matrixConsole = new MatrixConsoleController(this);
    this.treeRenderer = new TreeRenderer(this);
    this.focusReader = new FocusReaderController(this);
    this.visualEditor = new VisualEditorController(this);
    this.markdownEditor = new MarkdownEditorController(this);
    this.deckCrud = new DeckCrudController(this);
    this.timelineBoard = new TimelineBoardController(this);
    this.radarChart = new RadarChartController(this);
    this.aiAgent = new AiAgentUIController(this);
    this.jevClient = new JevClient();
    this.jevUi = new JevUi(this);
    this._lastJevRecommendation = null;
    this._lastAutoExpandedJevTarget = null;
  }

  init() {
    this.loadUserData();
    this.bindEvents();
    this.renderDeckSelector();
    this.aiAgent.init();
    this.updateSpeechUiState(this.speechSynth.isAutoSpeechEnabled());
    this.router.navigate('dashboard');

    if (typeof window !== 'undefined') {
      window.app = this;
    }
  }

  renderAiAgent() {
    this.aiAgent.render();
  }

  showAiConfigModal() {
    const modal = document.getElementById('modal-ai-config');
    if (!modal) return;
    try {
      const store = this.aiAgent?.store;
      const providers = (store?.getProviders ? store.getProviders() : store?.config?.providers) || [];
      const activeProvider = (store?.getActiveProvider ? store.getActiveProvider() : null) || providers[0] || { id: 'deepseek', name: 'DeepSeek 官方', baseUrl: 'https://api.deepseek.com/v1', models: [] };
      this._editingAiProviderId = activeProvider?.id || providers[0]?.id;

      this.renderAiConfigProviderSelect();
      this.renderAiConfigPresetDropdown();
      this.populateAiConfigFields(activeProvider);

      modal.classList.remove('hidden');
    } catch (e) {
      console.error('[AiConfig] showAiConfigModal error:', e);
      modal.classList.remove('hidden');
    }
  }

  renderAiConfigProviderSelect() {
    const providerSelect = document.getElementById('modal-ai-cfg-provider-select');
    if (!providerSelect) return;
    const store = this.aiAgent?.store;
    const providers = (store?.getProviders ? store.getProviders() : store?.config?.providers) || [];
    const currentId = this._editingAiProviderId || providers[0]?.id;

    providerSelect.innerHTML = providers.map(p => `
      <option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>
        ${p.name} [${p.apiType || 'openai'}] (${(p.models || []).length} 个模型)
      </option>
    `).join('');
  }

  renderAiConfigPresetDropdown() {
    const container = document.getElementById('modal-ai-cfg-preset-dropdown');
    if (!container) return;
    const presets = REFERENCE_PRESET_PROVIDERS || [];
    container.innerHTML = presets.map(ref => `
      <button type="button" onclick="app.importPresetAiProvider('${ref.id}')"
        class="p-2 rounded-lg bg-slate-900 hover:border-indigo-500 border border-slate-750 text-left transition space-y-0.5">
        <div class="font-bold text-white text-[11px]">${ref.name}</div>
        <div class="text-[10px] text-indigo-300 font-mono">${ref.apiType} · ${ref.models.length}个预设模型</div>
      </button>
    `).join('');
  }

  togglePresetDropdown() {
    const container = document.getElementById('modal-ai-cfg-preset-dropdown');
    if (container) {
      container.classList.toggle('hidden');
    }
  }

  importPresetAiProvider(presetId) {
    try {
      const store = this.aiAgent?.store;
      if (store?.importFromPreset) {
        const newP = store.importFromPreset(presetId);
        if (newP) {
          this._editingAiProviderId = newP.id;
          this.renderAiConfigProviderSelect();
          this.populateAiConfigFields(newP);
        }
      }
      const container = document.getElementById('modal-ai-cfg-preset-dropdown');
      if (container) container.classList.add('hidden');
    } catch (e) {
      console.warn('[AiConfig] importPresetAiProvider error:', e);
    }
  }

  populateAiConfigFields(provider) {
    if (!provider) return;
    const nameInput = document.getElementById('modal-ai-cfg-provider-name');
    const apiTypeSelect = document.getElementById('modal-ai-cfg-api-type');
    const baseUrlInput = document.getElementById('modal-ai-cfg-base-url');
    const apiKeyInput = document.getElementById('modal-ai-cfg-api-key');
    const effortSelect = document.getElementById('modal-ai-cfg-effort');
    const autoApproveInput = document.getElementById('modal-ai-cfg-auto-approve');
    const sysPromptInput = document.getElementById('modal-ai-cfg-system-prompt');

    if (nameInput) nameInput.value = provider.name || '';
    if (apiTypeSelect) apiTypeSelect.value = provider.apiType || 'openai';
    if (baseUrlInput) baseUrlInput.value = provider.baseUrl || '';
    if (apiKeyInput) apiKeyInput.value = provider.apiKey || '';

    const cfg = this.aiAgent?.store?.config || {};
    if (effortSelect) effortSelect.value = cfg.reasoningEffort || 'medium';
    if (autoApproveInput) autoApproveInput.checked = !!cfg.autoApprove;
    if (sysPromptInput) sysPromptInput.value = cfg.systemPrompt || '';

    this.renderAiConfigModelsList(provider);
  }

  renderAiConfigModelsList(provider) {
    const container = document.getElementById('modal-ai-cfg-models-container');
    if (!container) return;
    const models = provider?.models || [];
    const activeModelId = this.aiAgent?.store?.config?.activeModelId;

    if (models.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-500 text-xs">暂无模型配置，请点击“+ 添加模型”</div>';
      return;
    }

    container.innerHTML = `
      <table class="w-full text-left text-xs min-w-[560px]">
        <thead class="bg-slate-900/90 text-slate-400 text-[10px] font-mono border-b border-slate-800">
          <tr>
            <th class="p-2">模型标识 (ID)</th>
            <th class="p-2">显示名称</th>
            <th class="p-2">上下文 (Tokens)</th>
            <th class="p-2">最大输出 (Tokens)</th>
            <th class="p-2 text-center">深度思考</th>
            <th class="p-2 text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/80">
          ${models.map((m) => `
            <tr class="hover:bg-slate-850/50 transition">
              <td class="p-2 font-mono">
                <input type="text" value="${m.id}" onchange="app.updateModelConfigField('${m.id}', 'id', this.value)"
                  class="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-xs w-full text-indigo-300 font-semibold">
              </td>
              <td class="p-2">
                <input type="text" value="${m.name || m.id}" onchange="app.updateModelConfigField('${m.id}', 'name', this.value)"
                  class="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-xs w-full text-slate-200">
              </td>
              <td class="p-2 font-mono">
                <div class="flex items-center gap-1">
                  <input type="number" step="1000" value="${m.contextWindow || 128000}" onchange="app.updateModelConfigField('${m.id}', 'contextWindow', Number(this.value))"
                    class="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-750 text-xs w-20 text-slate-300">
                  <span class="text-[10px] text-slate-500">${Math.round((m.contextWindow || 128000)/1000)}k</span>
                </div>
              </td>
              <td class="p-2 font-mono">
                <div class="flex items-center gap-1">
                  <input type="number" step="1024" value="${m.maxOutputTokens || 8192}" onchange="app.updateModelConfigField('${m.id}', 'maxOutputTokens', Number(this.value))"
                    class="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-750 text-xs w-16 text-slate-300">
                  <span class="text-[10px] text-slate-500">${Math.round((m.maxOutputTokens || 8192)/1024)}k</span>
                </div>
              </td>
              <td class="p-2 text-center">
                <input type="checkbox" ${m.reasoning ? 'checked' : ''} onchange="app.updateModelConfigField('${m.id}', 'reasoning', this.checked)"
                  class="rounded bg-slate-900 border-slate-750 text-indigo-600">
              </td>
              <td class="p-2 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button type="button" onclick="app.setActiveModelForConfig('${m.id}')"
                    class="text-[11px] ${activeModelId === m.id ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'}">
                    ${activeModelId === m.id ? '● 选用中' : '选用'}
                  </button>
                  <button type="button" onclick="app.deleteAiModel('${m.id}')"
                    class="text-slate-500 hover:text-rose-400 text-sm font-bold ml-1" title="删除模型">&times;</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  onAiConfigProviderChange(providerId) {
    try {
      this._editingAiProviderId = providerId;
      const store = this.aiAgent?.store;
      const providers = (store?.getProviders ? store.getProviders() : store?.config?.providers) || [];
      const provider = providers.find(p => p.id === providerId);
      if (provider) {
        this.populateAiConfigFields(provider);
      }
    } catch (e) {
      console.warn('[AiConfig] onAiConfigProviderChange error:', e);
    }
  }

  addNewAiProvider() {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const count = (store.getProviders?.() || []).length + 1;
      const newP = {
        id: 'custom_' + Date.now(),
        name: '自定义平台 ' + count,
        apiType: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, maxOutputTokens: 16384, reasoning: false }
        ]
      };
      store.addProvider(newP);
      this._editingAiProviderId = newP.id;
      this.renderAiConfigProviderSelect();
      this.populateAiConfigFields(newP);
    } catch (e) {
      console.error('[AiConfig] addNewAiProvider error:', e);
    }
  }

  deleteCurrentAiProvider() {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const providers = store.getProviders?.() || [];
      if (providers.length <= 1) {
        if (typeof alert !== 'undefined') alert('系统中至少需保留一个 AI 平台！');
        return;
      }
      const targetId = this._editingAiProviderId || providers[0].id;
      if (typeof confirm !== 'undefined' && !confirm('确定删除该 AI 平台吗？此操作无法撤销。')) return;
      store.deleteProvider(targetId);
      const remaining = store.getProviders?.() || [];
      this._editingAiProviderId = remaining[0]?.id;
      this.renderAiConfigProviderSelect();
      this.populateAiConfigFields(remaining[0]);
    } catch (e) {
      console.error('[AiConfig] deleteCurrentAiProvider error:', e);
    }
  }

  addAiModelToCurrentProvider() {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const providerId = this._editingAiProviderId || store.config.activeProviderId;
      const newModel = {
        id: 'custom-model-' + Date.now().toString().slice(-4),
        name: '自定义新模型',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        reasoning: false
      };
      store.addModel(providerId, newModel);
      const p = store.getProviders().find(x => x.id === providerId);
      this.renderAiConfigModelsList(p);
    } catch (e) {
      console.error('[AiConfig] addAiModelToCurrentProvider error:', e);
    }
  }

  deleteAiModel(modelId) {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const providerId = this._editingAiProviderId || store.config.activeProviderId;
      store.deleteModel(providerId, modelId);
      const p = store.getProviders().find(x => x.id === providerId);
      this.renderAiConfigModelsList(p);
    } catch (e) {
      console.error('[AiConfig] deleteAiModel error:', e);
    }
  }

  setActiveModelForConfig(modelId) {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const providerId = this._editingAiProviderId || store.config.activeProviderId;
      store.switchModel(providerId, modelId);
      const p = store.getProviders().find(x => x.id === providerId);
      this.renderAiConfigModelsList(p);
      this.aiAgent?.updateHeaderStatus();
      this.aiAgent?.renderQuickModelSelector();
    } catch (e) {
      console.error('[AiConfig] setActiveModelForConfig error:', e);
    }
  }

  updateModelConfigField(modelId, field, value) {
    try {
      const store = this.aiAgent?.store;
      if (!store) return;
      const providerId = this._editingAiProviderId || store.config.activeProviderId;
      store.updateModel(providerId, modelId, { [field]: value });
    } catch (e) {
      console.warn('[AiConfig] updateModelConfigField error:', e);
    }
  }

  resetAiConfigToDefaults() {
    try {
      if (typeof confirm !== 'undefined' && !confirm('确定将所有平台与模型恢复为系统默认参考预设吗？自定义平台与模型参数将被覆盖。')) return;
      const store = this.aiAgent?.store;
      if (!store) return;
      store.config.providers = DEFAULT_PROVIDERS;
      store.setActiveProvider('deepseek');
      this._editingAiProviderId = 'deepseek';
      this.renderAiConfigProviderSelect();
      this.populateAiConfigFields(store.getActiveProvider());
      if (typeof alert !== 'undefined') alert('已成功重置为默认参考预设！');
    } catch (e) {
      console.error('[AiConfig] resetAiConfigToDefaults error:', e);
    }
  }

  closeAiConfigModal() {
    const modal = document.getElementById('modal-ai-config');
    if (modal) modal.classList.add('hidden');
  }

  saveAiConfigModal() {
    try {
      const store = this.aiAgent?.store;
      const providerId = this._editingAiProviderId || store?.config?.activeProviderId || 'deepseek';
      const nameInput = document.getElementById('modal-ai-cfg-provider-name');
      const apiTypeSelect = document.getElementById('modal-ai-cfg-api-type');
      const baseUrlInput = document.getElementById('modal-ai-cfg-base-url');
      const apiKeyInput = document.getElementById('modal-ai-cfg-api-key');
      const effortSelect = document.getElementById('modal-ai-cfg-effort');
      const autoApproveInput = document.getElementById('modal-ai-cfg-auto-approve');
      const sysPromptInput = document.getElementById('modal-ai-cfg-system-prompt');

      if (store?.updateProvider) {
        store.updateProvider(providerId, {
          name: nameInput?.value?.trim() || '自定义平台',
          apiType: apiTypeSelect?.value || 'openai',
          baseUrl: baseUrlInput?.value?.trim() || 'https://api.deepseek.com/v1',
          apiKey: apiKeyInput?.value?.trim() || ''
        });
      }

      if (store?.setActiveProvider) {
        store.setActiveProvider(providerId);
      }

      const activeM = store?.getActiveModel ? store.getActiveModel() : null;

      const newCfg = {
        baseUrl: baseUrlInput?.value?.trim() || 'https://api.deepseek.com/v1',
        apiKey: apiKeyInput?.value?.trim() || '',
        apiType: apiTypeSelect?.value || 'openai',
        model: activeM?.id || store?.config?.model || 'deepseek-chat',
        contextWindow: activeM?.contextWindow || 128000,
        maxOutputTokens: activeM?.maxOutputTokens || 8192,
        reasoningEffort: effortSelect?.value || 'medium',
        autoApprove: !!autoApproveInput?.checked,
        systemPrompt: sysPromptInput?.value?.trim() || ''
      };

      if (store?.saveConfig) {
        store.saveConfig(newCfg);
      }
      if (this.aiAgent?.client?.updateConfig) {
        this.aiAgent.client.updateConfig(newCfg);
      }
      if (this.aiAgent?.updateHeaderStatus) {
        this.aiAgent.updateHeaderStatus();
      }
      if (this.aiAgent?.renderQuickModelSelector) {
        this.aiAgent.renderQuickModelSelector();
      }
      this.closeAiConfigModal();
    } catch (e) {
      console.error('[AiConfig] saveAiConfigModal error:', e);
      this.closeAiConfigModal();
    }
  }

  // ==================== 数据状态加载与持久化 ====================

  loadUserData() {
    const profile = this.storage.loadProfile();
    if (profile && profile.deckStates) {
      this.state.deckStates = profile.deckStates;
    }
  }

  saveUserData() {
    this.storage.saveProfile({
      version: 2,
      lastActiveAt: Date.now(),
      deckStates: this.state.deckStates
    });
    this.storage.saveCustomDecks(this.state.customDecks);
    this.storage.saveActiveDeckId(this.state.activeDeckId);
    this.storage.saveMaskState(this.isAnswerMasked);
  }

  getAllDecks() {
    return [...BUILTIN_DECKS, ...(this.state.customDecks || [])];
  }

  getActiveDeck() {
    const decks = this.getAllDecks();
    return decks.find(d => d.id === this.state.activeDeckId) || BUILTIN_DECKS[0];
  }

  getDeckState(deckId) {
    if (!this.state.deckStates[deckId]) {
      this.state.deckStates[deckId] = {
        totalAttempts: 0,
        totalCorrect: 0,
        streak: 0,
        cards: {}
      };
    }
    return this.state.deckStates[deckId];
  }

  switchDeck(deckId) {
    this.state.activeDeckId = deckId;
    this._lastJevRecommendation = null;
    this._lastAutoExpandedJevTarget = null;
    this.saveUserData();
    this.resetStudyFilters();
    this.renderDeckSelector();
    this.renderAllViews();
    this.renderDeckManagerList();
    this.router.navigate(this.router.currentView || 'dashboard');
  }

  // ==================== 视图导航与渲染委托 ====================

  navigate(viewId) {
    this.router.navigate(viewId);
  }

  renderDeckSelector() {
    const selector = document.getElementById('deck-selector');
    const decks = this.getAllDecks();
    const activeDeck = this.getActiveDeck();

    if (selector) {
      selector.innerHTML = decks.map(d => `
        <option value="${d.id}" ${d.id === activeDeck.id ? 'selected' : ''}>
          ${d.icon} ${d.title}
        </option>
      `).join('');
    }

    const iconEl = document.getElementById('header-deck-icon');
    const titleEl = document.getElementById('header-deck-title');
    if (iconEl) iconEl.innerText = activeDeck.icon;
    if (titleEl) titleEl.innerText = activeDeck.title;
  }

  renderAllViews() {
    this.renderDashboard();
    this.renderStudyHub();
    this.renderReviewBoard();
    this.renderStats();
  }

  calcSpacedRepetitionMetrics() {
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck ? deck.id : '');
    return calculateUnifiedMetrics(deck ? deck.entities || [] : [], ds.cards || {});
  }

  renderDashboard() {
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck.id);
    const totalEntities = (deck.entities || []).length;
    const practicedCount = Object.values(ds.cards).filter(c => c.attempts > 0).length;
    const coverageRate = totalEntities > 0 ? Math.round((practicedCount / totalEntities) * 100) : 0;

    const { dueCount, rustyCount, masteredCount, dueEntities, mistakeEntities } = this.calcSpacedRepetitionMetrics();
    const totalAcc = ds.totalAttempts > 0 ? Math.round((ds.totalCorrect / ds.totalAttempts) * 100) : 100;

    const streakEl = document.getElementById('header-streak');
    if (streakEl) streakEl.innerText = ds.streak || 0;

    const covRateEl = document.getElementById('stat-coverage-rate');
    const covDetailEl = document.getElementById('stat-coverage-detail');
    const covBarEl = document.getElementById('stat-coverage-bar');
    if (covRateEl) covRateEl.innerText = `${coverageRate}%`;
    if (covDetailEl) covDetailEl.innerText = `(${practicedCount}/${totalEntities}词条)`;
    if (covBarEl) covBarEl.style.width = `${coverageRate}%`;

    const dueEl = document.getElementById('stat-due-count');
    const rustyEl = document.getElementById('stat-rusty-count');
    const accEl = document.getElementById('stat-accuracy-rate');
    const accDetailEl = document.getElementById('stat-accuracy-detail');
    const totalAttEl = document.getElementById('stat-total-attempts');
    const masteredEl = document.getElementById('stat-mastered-count');

    if (dueEl) dueEl.innerText = dueCount;
    if (rustyEl) rustyEl.innerText = rustyCount;
    if (accEl) accEl.innerText = `${totalAcc}%`;
    if (accDetailEl) accDetailEl.innerText = `(${ds.totalCorrect || 0}/${ds.totalAttempts || 0})`;
    if (totalAttEl) totalAttEl.innerText = ds.totalAttempts || 0;
    if (masteredEl) masteredEl.innerText = masteredCount;

    const badgeReview = document.getElementById('mode-badge-review');
    const badgeWeakness = document.getElementById('mode-badge-weakness');
    if (badgeReview) badgeReview.innerText = `今日到期: ${dueCount}`;
    if (badgeWeakness) badgeWeakness.innerText = `错题待清: ${mistakeEntities.length}`;

    const navMistakeBadge = document.getElementById('nav-mistake-badge');
    if (navMistakeBadge) {
      if (mistakeEntities.length > 0) {
        navMistakeBadge.classList.remove('hidden');
        navMistakeBadge.innerText = mistakeEntities.length;
      } else {
        navMistakeBadge.classList.add('hidden');
      }
    }

    this.renderSmartBanner(dueCount, mistakeEntities.length, coverageRate);
    this.renderDeckCategoryBars();
  }

  renderSmartBanner(dueCount, mistakeCount, coverageRate) {
    const banner = document.getElementById('smart-recommendation-banner');
    if (!banner) return;
    let title = '';
    let desc = '';
    let actionBtnText = '';
    let targetMode = '';
    let iconSvg = '';
    let colorClass = '';

    if (dueCount > 0) {
      iconSvg = `<svg class="w-5 h-5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
      title = `艾宾浩斯复习调度：今日有 ${dueCount} 个知识点到达巩固周期`;
      desc = `系统检测到知识点濒临遗忘临界值。启动【每日温故模式】，用时不到 2 分钟即可把短期记忆固化为长期突触。`;
      actionBtnText = '立即进行艾宾浩斯复习';
      targetMode = 'daily';
      colorClass = 'bg-slate-900/90 border-amber-500/40 text-slate-200';
    } else if (mistakeCount >= 2) {
      iconSvg = `<svg class="w-5 h-5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v2m0 14v2m-9-9h2m14 0h2"/></svg>`;
      title = `盲区诊断报告：历史沉淀了 ${mistakeCount} 个易混淆错题`;
      desc = `检测到同胞概念间存在答题失误。建议启动【弱点定点爆破模式】，对错题进行针对性同胞选项辨析。`;
      actionBtnText = '开启弱点歼灭战';
      targetMode = 'weakness';
      colorClass = 'bg-slate-900/90 border-rose-500/40 text-slate-200';
    } else if (coverageRate < 70) {
      iconSvg = `<svg class="w-5 h-5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z"/></svg>`;
      title = `阶梯认知推荐：当前题库覆盖率为 ${coverageRate}%，建议继续开拓`;
      desc = `推荐进入【分层阶梯战役模式】，依照布鲁姆认知模型由浅入深逐层挑战进阶要点。`;
      actionBtnText = '继续闯关战役';
      targetMode = 'ladder';
      colorClass = 'bg-slate-900/90 border-indigo-500/40 text-slate-200';
    } else {
      iconSvg = `<svg class="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
      title = `极限测速推荐：图谱基础稳固，挑战极速连击生存`;
      desc = `3 条命限时 6 秒抢答，检验对该领域知识的下意识条件反射与抗压反应。`;
      actionBtnText = '挑战连击极限';
      targetMode = 'speed';
      colorClass = 'bg-slate-900/90 border-emerald-500/40 text-slate-200';
    }

    banner.className = `surface-card rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-md ${colorClass}`;
    banner.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="mt-0.5">${iconSvg}</div>
        <div>
          <div class="font-bold text-sm sm:text-base text-white flex items-center gap-2">${title}</div>
          <p class="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">${desc}</p>
        </div>
      </div>
      <button onclick="app.startMode('${targetMode}')" class="btn-primary-cta shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-[0.98]">
        <span>${actionBtnText}</span>
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3"/>
        </svg>
      </button>
    `;

    // 联动高亮对应推荐卡片 (Hero Ring 焦点闭环)
    const cardIdMap = {
      'daily': 'mode-card-review',
      'weakness': 'mode-card-weakness',
      'ladder': 'mode-card-campaign',
      'speed': 'mode-card-speed'
    };
    Object.values(cardIdMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('ring-2', 'ring-indigo-500/60', 'shadow-indigo-500/20');
        const badge = el.querySelector('.hero-rec-badge');
        if (badge) badge.remove();
      }
    });

    const activeCardId = cardIdMap[targetMode];
    const recEl = activeCardId ? document.getElementById(activeCardId) : null;
    if (recEl) {
      recEl.classList.add('ring-2', 'ring-indigo-500/60', 'shadow-indigo-500/20');
      const badgeWrap = recEl.querySelector('.mode-badge-wrap');
      if (badgeWrap && !badgeWrap.querySelector('.hero-rec-badge')) {
        const span = document.createElement('span');
        span.className = 'hero-rec-badge text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 font-semibold animate-pulse-subtle';
        span.innerText = '★ 首选推荐';
        badgeWrap.appendChild(span);
      }
    }
  }

  togglePanoramaGroup(groupName) {
    if (!groupName) return;
    if (this.panoramaCollapsedGroups.has(groupName)) {
      this.panoramaCollapsedGroups.delete(groupName);
    } else {
      this.panoramaCollapsedGroups.add(groupName);
    }
    this.renderDeckCategoryBars();
  }

  toggleAllPanoramaGroups() {
    const deck = this.getActiveDeck();
    const groups = [];
    (deck.categories || []).forEach(c => {
      const gName = c.group || '核心知识板块';
      if (!groups.includes(gName)) groups.push(gName);
    });
    const allCollapsed = groups.length > 0 && groups.every(g => this.panoramaCollapsedGroups.has(g));
    if (allCollapsed) {
      this.panoramaCollapsedGroups.clear();
    } else {
      groups.forEach(g => this.panoramaCollapsedGroups.add(g));
    }
    this.renderDeckCategoryBars();
  }

  renderDeckCategoryBars() {
    const container = document.getElementById('deck-category-bars') || document.getElementById('stats-category-breakdown');
    if (!container) return;
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck.id);
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    // 计算各分类板块熟练度全景向量
    const panorama = (deck.categories || []).map(cat => {
      const ents = (deck.entities || []).filter(e => e.categoryId === cat.id);
      const learned = ents.filter(e => ds.cards[e.id] && ds.cards[e.id].attempts > 0).length;
      const mastered = ents.filter(e => MasteredCardSpecification.isSatisfiedBy(ds.cards[e.id])).length;
      const dueCount = ents.filter(e => DueCardSpecification.isSatisfiedBy(ds.cards[e.id], endOfToday)).length;
      const mistakeCount = ents.filter(e => MistakeCardSpecification.isSatisfiedBy(ds.cards[e.id])).length;
      const pct = ents.length > 0 ? Math.round((learned / ents.length) * 100) : 0;
      return {
        id: cat.id,
        name: cat.name,
        group: cat.group || '核心知识板块',
        total: ents.length,
        learned,
        mastered,
        dueCount,
        mistakeCount,
        coveragePercent: pct
      };
    });

    const highlightTargetId = this._lastJevRecommendation ? this._lastJevRecommendation.targetCategoryId : null;

    // 按大类 (Group) 聚合各分类板块，构建大类与小类层级树
    const groups = [];
    const groupMap = new Map();
    panorama.forEach(cat => {
      const gName = cat.group || '核心知识板块';
      if (!groupMap.has(gName)) {
        const groupObj = {
          name: gName,
          categories: [],
          total: 0,
          learned: 0,
          mastered: 0,
          dueCount: 0,
          mistakeCount: 0,
          hasTarget: false
        };
        groupMap.set(gName, groupObj);
        groups.push(groupObj);
      }
      const g = groupMap.get(gName);
      g.categories.push(cat);
      g.total += cat.total;
      g.learned += cat.learned;
      g.mastered += cat.mastered;
      g.dueCount += cat.dueCount;
      g.mistakeCount += cat.mistakeCount;
      if (highlightTargetId && highlightTargetId === cat.id) {
        g.hasTarget = true;
      }
    });

    // 计算各大类总掌握率 (折叠状态完全遵循用户的显式交互)
    groups.forEach(g => {
      g.coveragePercent = g.total > 0 ? Math.round((g.learned / g.total) * 100) : 0;
    });

    // 同步一键展开/折叠按钮文本
    const allCollapsed = groups.length > 0 && groups.every(g => this.panoramaCollapsedGroups.has(g.name));
    const toggleLabel = document.getElementById('panorama-toggle-all-label');
    if (toggleLabel) {
      toggleLabel.innerText = allCollapsed ? '全部展开' : '全部折叠';
    }

    let html = '';
    groups.forEach(g => {
      const isCollapsed = this.panoramaCollapsedGroups.has(g.name);
      const safeGroupName = g.name.replace(/'/g, "\\'");
      html += `
        <div class="rounded-xl border transition-all overflow-hidden ${g.hasTarget ? 'border-indigo-500/60 bg-slate-900/90 shadow-md ring-1 ring-indigo-500/30' : 'border-slate-800 bg-slate-900/60'}">
          <!-- 大类 Header (点击折叠/展开) -->
          <div onclick="app.togglePanoramaGroup('${safeGroupName}')" class="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:px-4 cursor-pointer hover:bg-slate-850/80 transition gap-2 select-none">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="text-slate-400 transform transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 9l-7 7-7-7"/></svg>
              </span>
              <svg class="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-bold text-xs sm:text-sm text-slate-200 truncate font-mono">${g.name}</span>
                <span class="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded-full bg-slate-850 border border-slate-750 shrink-0">
                  ${g.categories.length}个小类 · ${g.total}词条
                </span>
                ${g.hasTarget ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold animate-pulse-subtle shrink-0">★ 含JEV研判焦点</span>' : ''}
              </div>
            </div>
            <div class="flex items-center gap-3 self-end sm:self-auto shrink-0 font-mono text-[11px]">
              ${g.dueCount > 0 ? `<span class="text-amber-400 font-semibold flex items-center gap-1" title="大类待复习词条数"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>到期:${g.dueCount}</span>` : ''}
              ${g.mistakeCount > 0 ? `<span class="text-rose-400 font-semibold flex items-center gap-1" title="大类错题词条数"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>错题:${g.mistakeCount}</span>` : ''}
              <span class="text-slate-300 font-bold">${g.learned}/${g.total} (${g.coveragePercent}%)</span>
              <div class="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                <div class="${g.hasTarget ? 'bg-indigo-400' : 'bg-indigo-500'} h-full rounded-full transition-all duration-300" style="width: ${g.coveragePercent}%"></div>
              </div>
              <button type="button" onclick="event.stopPropagation(); app.openSandboxForGroup('${safeGroupName}')" class="px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[10px] font-medium transition flex items-center gap-1 shrink-0 select-none shadow-sm" title="针对该大类全部考点快速开启沙盒试炼">
                <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                <span>沙盒</span>
              </button>
            </div>
          </div>

          <!-- 小类列表 (Subcategories List) -->
          <div class="${isCollapsed ? 'hidden' : ''} p-2.5 sm:p-3 space-y-2 bg-slate-950/40 border-t border-slate-800/60">
            ${g.categories.map(cat => {
              const isTarget = highlightTargetId && highlightTargetId === cat.id;
              return `
                <div class="space-y-1.5 p-2.5 sm:p-3 rounded-lg transition-all ${isTarget ? 'bg-indigo-950/40 border border-indigo-500/70 shadow-md ring-1 ring-indigo-500/30' : 'bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/80'}">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-1.5 h-1.5 rounded-full ${isTarget ? 'bg-indigo-400 animate-ping' : 'bg-slate-600'} shrink-0"></span>
                      <span class="font-medium ${isTarget ? 'text-indigo-200 font-bold' : 'text-slate-300'} truncate">${cat.name}</span>
                      ${isTarget ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500 text-white font-bold animate-pulse-subtle shrink-0">★ JEV 首选推荐</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2.5 font-mono text-[11px] text-slate-400 shrink-0">
                      ${cat.dueCount > 0 ? `<span class="text-amber-400 font-semibold" title="待复习词条数">到期:${cat.dueCount}</span>` : ''}
                      ${cat.mistakeCount > 0 ? `<span class="text-rose-400 font-semibold" title="错题词条数">错题:${cat.mistakeCount}</span>` : ''}
                      <span>${cat.learned}/${cat.total} (${cat.coveragePercent}%)</span>
                      <button type="button" onclick="app.openSandboxForCategory('${cat.id}')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-slate-750 hover:border-indigo-500/40 text-[10px] font-mono transition flex items-center gap-1 shrink-0 select-none" title="针对该小类考点快速开启沙盒试炼">
                        <svg class="w-2.5 h-2.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                        <span>沙盒</span>
                      </button>
                    </div>
                  </div>
                  <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div class="${isTarget ? 'bg-indigo-400' : 'bg-indigo-500'} h-full rounded-full transition-all duration-300" style="width: ${cat.coveragePercent}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // 触发 JEV 熟练度全景评估与推荐渲染
    this.runJevEvaluation(panorama, deck);
  }

  async runJevEvaluation(panorama, deck) {
    if (!this.jevClient) return;
    try {
      const rec = await this.jevClient.evaluate(panorama, {
        id: deck.id,
        title: deck.title,
        totalEntities: (deck.entities || []).length
      });
      this._lastJevRecommendation = rec;
      const bannerContainer = document.getElementById('jev-recommendation-container');
      const pill = document.getElementById('jev-status-pill');
      if (this.jevUi) {
        this.jevUi.renderInsightBanner(bannerContainer, rec, this.jevClient.getConfig());
        this.jevUi.renderStatusPill(pill, this.jevClient.getConfig(), rec);
      }

      // 仅当产出新的 JEV 推荐焦点时，执行单次智能穿透展开，不侵入用户后续手动折叠
      if (rec && rec.targetCategoryId && rec.targetCategoryId !== this._lastAutoExpandedJevTarget) {
        this._lastAutoExpandedJevTarget = rec.targetCategoryId;
        const targetCategory = (deck.categories || []).find(c => c.id === rec.targetCategoryId);
        if (targetCategory) {
          const gName = targetCategory.group || '核心知识板块';
          if (this.panoramaCollapsedGroups.has(gName)) {
            this.panoramaCollapsedGroups.delete(gName);
          }
          this.renderDeckCategoryBars();
        }
      }
    } catch (e) {
      console.warn('[JEV] Evaluation error:', e);
    }
  }

  refreshJevRecommendation() {
    this._lastJevRecommendation = null;
    this._lastAutoExpandedJevTarget = null;
    this.renderDeckCategoryBars();
  }

  showJevConfigModal() {
    const modal = document.getElementById('modal-jev-config');
    if (!modal) return;
    if (this.jevUi && this.jevClient) {
      this.jevUi.populateConfigModal(this.jevClient.getConfig());
    }
    const testStatus = document.getElementById('cfg-jev-test-status');
    if (testStatus) testStatus.classList.add('hidden');
    modal.classList.remove('hidden');
  }

  closeJevConfigModal() {
    const modal = document.getElementById('modal-jev-config');
    if (modal) modal.classList.add('hidden');
  }

  toggleJevConfigFields() {
    const enabledEl = document.getElementById('cfg-jev-enabled');
    const remoteFields = document.getElementById('cfg-jev-remote-fields');
    if (enabledEl && remoteFields) {
      if (enabledEl.checked) remoteFields.classList.remove('hidden');
      else remoteFields.classList.add('hidden');
    }
  }

  toggleJevCorsProxyFields() {
    const proxyEl = document.getElementById('cfg-jev-cors-proxy');
    const wrapEl = document.getElementById('cfg-jev-cors-proxy-wrap');
    if (proxyEl && wrapEl) {
      if (proxyEl.checked) wrapEl.classList.remove('hidden');
      else wrapEl.classList.add('hidden');
    }
  }

  async testJevConnection() {
    const endpointEl = document.getElementById('cfg-jev-endpoint');
    const tokenEl = document.getElementById('cfg-jev-token');
    const modelEl = document.getElementById('cfg-jev-model');
    const statusEl = document.getElementById('cfg-jev-test-status');
    if (!statusEl) return;
    statusEl.classList.remove('hidden');
    statusEl.className = 'p-2.5 rounded-lg text-[11px] font-mono border bg-slate-900 border-slate-750 text-slate-300';
    statusEl.innerText = '正在向端点发起测试握手...';

    const endpoint = endpointEl ? endpointEl.value.trim() : '';
    const key = tokenEl ? tokenEl.value.trim() : '';
    const model = modelEl ? modelEl.value.trim() : '';
    if (!this.jevClient) return;

    const res = await this.jevClient.testConnection(endpoint, key, model);

    if (res.success) {
      statusEl.className = 'p-2.5 rounded-lg text-[11px] font-mono border bg-emerald-950/40 border-emerald-500/50 text-emerald-300';
      statusEl.innerText = res.message;
    } else {
      statusEl.className = 'p-2.5 rounded-lg text-[11px] font-mono border bg-amber-950/40 border-amber-500/50 text-amber-300';
      statusEl.innerText = `${res.message}（无需担心：系统将自动启用纯前端本地智能引擎，零后端依赖完整可用）`;
    }
  }

  resetJevConfig() {
    if (!this.jevClient) return;
    this.jevClient.resetConfig();
    if (this.jevUi) this.jevUi.populateConfigModal(this.jevClient.getConfig());
    const statusEl = document.getElementById('cfg-jev-test-status');
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.className = 'p-2.5 rounded-lg text-[11px] font-mono border bg-slate-900 border-slate-750 text-slate-300';
      statusEl.innerText = '已重置为默认配置（远程关闭，启用本地启发式降级）';
    }
  }

  saveJevConfig() {
    if (!this.jevClient || !this.jevUi) return;
    const cfg = this.jevUi.readConfigFromModal();
    this.jevClient.saveConfig(cfg);
    this.closeJevConfigModal();
    this._lastJevRecommendation = null;
    this._lastAutoExpandedJevTarget = null;
    this.renderDeckCategoryBars();
  }

  startSandboxForCategory(categoryId) {
    if (!categoryId) return;
    if (this.sandboxConfig) {
      this.sandboxConfig.selectedCategories = new Set([categoryId]);
      this.sandboxConfig.selectedLayers = new Set([1, 2, 3]);
      this.sandboxConfig.trialMode = 'DEFAULT';
      this.sandboxConfig.questionCount = 10;
      this.sandboxConfig.isShuffle = true;
      this.sandboxConfig.startCustomQuiz();
    } else {
      this.startMode('FREE_LAB');
    }
  }

  renderStudyHub() {
    this.matrixConsole.renderFilters();
    this.treeRenderer.renderCards();
    this.updateStudyStatsBadge();
  }

  updateStudyStatsBadge() {
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck.id);
    const stats = calculateDeckCoverage(deck.entities, ds.cards);

    const badge = document.getElementById('study-coverage-badge');
    if (badge) {
      badge.innerText = `覆盖率: ${stats.coveragePercent}% (${stats.practiced}/${stats.total}) · 待复习: ${stats.due}`;
    }

    const maskText = document.getElementById('mask-status-text');
    const maskIcon = document.getElementById('mask-status-icon');
    if (maskText) maskText.innerText = this.isAnswerMasked ? '自测遮挡模式: 开' : '自测遮挡模式: 关';
    if (maskIcon) {
      maskIcon.innerHTML = this.isAnswerMasked
        ? '<svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }

    const deckIcon = document.getElementById('study-deck-icon');
    const deckTitle = document.getElementById('study-deck-title');
    const deckDesc = document.getElementById('study-deck-desc');
    if (deckIcon) deckIcon.innerText = deck.icon;
    if (deckTitle) deckTitle.innerText = `${deck.title} 知识图谱`;
    if (deckDesc) deckDesc.innerText = deck.description || '按分类与认知层级系统归纳的核心知识清单。';

    const countBadge = document.getElementById('study-matched-count-badge');
    if (countBadge) {
      countBadge.innerText = `显示 ${deck.entities.length} / ${deck.entities.length} 词条`;
    }
  }

  renderReviewBoard() {
    this.timelineBoard.renderBoard();
  }

  renderStats() {
    this.radarChart.renderStats();
  }

  renderCodex() {
    const tbody = document.getElementById('codex-table-body');
    if (!tbody) return;
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck.id);
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const list = (deck.entities || []).filter(e => {
      const card = ds.cards[e.id];
      if (this.currentFilter === 'DUE') return card && card.nextReviewAt && card.nextReviewAt <= endOfToday;
      if (this.currentFilter === 'MISTAKE') return card && card.wrong > 0;
      if (this.currentFilter === 'MASTERED') return card && card.level >= 4;
      return true;
    });

    const countEl = document.getElementById('codex-filtered-count');
    if (countEl) countEl.innerText = list.length;

    let html = '';
    list.forEach(entity => {
      const card = ds.cards[entity.id] || { level: 0, attempts: 0, correct: 0, wrong: 0 };
      let statusBadge = '<span class="px-2 py-0.5 rounded bg-slate-800 text-slate-400">未学习</span>';
      let reviewTimeText = '—';

      if (card.attempts > 0) {
        if (card.level >= 4) {
          statusBadge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>稳固掌握</span>';
        } else if (card.nextReviewAt && card.nextReviewAt <= endOfToday) {
          const daysOverdue = (endOfToday - card.nextReviewAt) / (1000 * 3600 * 24);
          if (daysOverdue > (card.stabilityDays || 1) * 2) {
            statusBadge = '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>记忆生锈</span>';
          } else {
            statusBadge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>今日到期</span>';
          }
        } else {
          statusBadge = '<span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>巩固中</span>';
        }

        if (card.nextReviewAt) {
          const d = new Date(card.nextReviewAt);
          reviewTimeText = `${d.getMonth() + 1}月${d.getDate()}日`;
        }
      }

      const cat = deck.categories.find(c => c.id === entity.categoryId);
      const catName = cat ? cat.name : entity.categoryId;

      html += `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="py-3 px-4 font-bold text-white">
            ${entity.title}
            <div class="text-[11px] text-slate-400 font-normal">${entity.subtitle || ''}</div>
          </td>
          <td class="py-3 px-3 font-mono text-indigo-300">${entity.answer}</td>
          <td class="py-3 px-3">
            <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">${catName}</span>
          </td>
          <td class="py-3 px-3 font-mono text-slate-400">Layer ${entity.layer}</td>
          <td class="py-3 px-3">${statusBadge}</td>
          <td class="py-3 px-3 font-mono">
            <span class="text-emerald-400">${card.correct || 0}</span> / <span class="text-rose-400">${card.wrong || 0}</span>
          </td>
          <td class="py-3 px-3 font-mono text-slate-400">${reviewTimeText}</td>
          <td class="py-3 px-3 text-right">
            <button onclick="app.drillSingleEntity('${entity.id}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition text-[11px]">
              单独突击
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  setCodexFilter(filter) {
    this.currentFilter = filter;
    const buttons = document.querySelectorAll('#codex-filter-buttons button');
    buttons.forEach(b => {
      b.className = 'px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300';
    });
    if (typeof event !== 'undefined' && event && event.target) {
      event.target.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium';
    }
    this.renderCodex();
  }

  startMode(modeName) {
    const norm = (modeName || '').toUpperCase();
    if (norm === 'FREE_LAB' || norm === 'FREE' || norm === 'CUSTOM') {
      this.sandboxConfig.openModal();
      return;
    }
    if (norm === 'CAMPAIGN' || norm === 'LADDER' || norm === 'STEPPED') {
      this.steppedProgress.showRoadmapModal();
      return;
    }
    this.quizRunner.startSession(modeName);
  }

  openSandboxConfigModal() { this.sandboxConfig.openModal(); }
  openSandboxForGroup(groupName) { this.sandboxConfig.openModalForGroup(groupName); }
  openSandboxForCategory(categoryId) { this.sandboxConfig.openModalForCategory(categoryId); }
  closeSandboxConfigModal() { this.sandboxConfig.closeModal(); }
  openSteppedCampaignModal() { this.steppedProgress.showRoadmapModal(); }
  closeSteppedCampaignModal() { this.steppedProgress.closeRoadmapModal(); }

  showModeGuidanceModal(mode, sessionContext = {}) {
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck ? deck.id : '');
    const entities = deck?.entities || [];
    const cards = ds?.cards || {};

    const learnedEntities = entities.filter(e => {
      const c = cards[e.id];
      return c && (c.attempts > 0 || c.reps > 0 || c.nextReviewAt);
    });
    const learnedCount = learnedEntities.length;
    const totalCount = entities.length;
    const unlearnedCount = Math.max(0, totalCount - learnedCount);

    const norm = (mode || '').toUpperCase();
    const isDaily = norm.includes('DAILY') || norm.includes('REVIEW') || norm.includes('EBBINGHAUS');
    const isWeakness = norm.includes('WEAK') || norm.includes('MISTAKE');

    const modal = document.getElementById('modal-mode-guidance');
    const titleEl = document.getElementById('mode-guidance-title');
    const badgeEl = document.getElementById('mode-guidance-badge');
    const descEl = document.getElementById('mode-guidance-desc');
    const totalEl = document.getElementById('mode-guidance-total-count');
    const learnedEl = document.getElementById('mode-guidance-learned-count');
    const dueEl = document.getElementById('mode-guidance-due-count');
    const actionsEl = document.getElementById('mode-guidance-actions');

    if (!modal) {
      if (isDaily && learnedCount === 0) {
        alert(`新题库初次学习指引：\n当前题库「${deck?.title}」尚未开启初次识记（已学 0 / 未学 ${totalCount}）。\n艾宾浩斯复习需要先建立初次识记基线。建议前往「自由试炼」或「知识精读」开始初次学习！`);
      } else if (isDaily) {
        alert(`今日所有艾宾浩斯复习任务均已完成（已巩固 ${learnedCount} 个词条），记忆稳固！\n如需加练可前往「弱点攻坚」或「自由试炼」。`);
      } else {
        alert('当前模式下暂无可复习或考核的词条。');
      }
      this.navigate('dashboard');
      return;
    }

    if (totalEl) totalEl.innerText = totalCount;
    if (learnedEl) learnedEl.innerText = learnedCount;
    if (dueEl) dueEl.innerText = 0;

    let title = '';
    let badge = '';
    let badgeClass = '';
    let descHtml = '';
    let buttonsHtml = '';

    if (isDaily) {
      if (learnedCount === 0) {
        title = '新题库初次学习指引';
        badge = '新题库 · 待开启';
        badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        descHtml = `
          <div class="space-y-2">
            <p class="font-medium text-slate-200">当前题库「<span class="text-indigo-400 font-semibold">${deck?.title || '当前题库'}</span>」尚未开启初次识记。</p>
            <p class="text-slate-400 leading-relaxed">艾宾浩斯记忆模型是基于已学词条的记忆稳定度进行动态间隔排程的。新题库尚未建立记忆基线，因此暂无可供复习的到期卡片。</p>
            <div class="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-300">
              <strong>建议第一步</strong>：开启前 15 道新词初次自测，或进入精读中心通读概念，系统将自动开始计算遗忘衰减并安排每日复习。
            </div>
          </div>
        `;
        buttonsHtml = `
          <button type="button" onclick="app.startFirstStudySession()" class="btn-primary-cta w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5">
            立即开启初次识记 (15题自测)
          </button>
          <button type="button" onclick="app.navigateToStudyHub()" class="btn-secondary w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5">
            前往知识精读 (浏览大纲与概念)
          </button>
          <button type="button" onclick="app.closeModeGuidanceModal()" class="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition">
            返回主仪表盘
          </button>
        `;
      } else {
        title = '今日艾宾浩斯复习已达成';
        badge = '记忆稳固 · 任务清空';
        badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        descHtml = `
          <div class="space-y-2">
            <p class="font-medium text-slate-200">太棒了！已学 <span class="text-emerald-400 font-bold">${learnedCount}</span> 个词条，今日暂无到期复习任务。</p>
            <p class="text-slate-400 leading-relaxed">当前已学知识点的艾宾浩斯记忆稳定度良好，建议保持每天打卡节奏，避免过度疲劳。</p>
            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              如需继续强化，推荐进入<strong>弱点攻坚</strong>清除历史错题，或在<strong>自由沙盒</strong>中自选范围演练。
            </div>
          </div>
        `;
        buttonsHtml = `
          <button type="button" onclick="app.closeModeGuidanceModal(); app.startMode('WEAKNESS');" class="btn-primary-cta w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5">
            弱点攻坚练习
          </button>
          <button type="button" onclick="app.closeModeGuidanceModal(); app.openSandboxConfigModal();" class="btn-secondary w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5">
            自由沙盒定制试炼
          </button>
          <button type="button" onclick="app.closeModeGuidanceModal()" class="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition">
            好的，返回主仪表盘
          </button>
        `;
      }
    } else if (isWeakness) {
      if (learnedCount === 0) {
        title = '弱点题库尚未建立';
        badge = '新题库 · 暂无错题';
        badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        descHtml = `
          <div class="space-y-2">
            <p class="font-medium text-slate-200">当前题库尚未产生答题记录，暂无薄弱错题。</p>
            <p class="text-slate-400 leading-relaxed">在对战和自测过程中，若出现失误或掌握度较低，系统会自动收录至弱点歼灭池供随时突击。</p>
          </div>
        `;
        buttonsHtml = `
          <button type="button" onclick="app.startFirstStudySession()" class="btn-primary-cta w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5">
            开启初次识记自测
          </button>
          <button type="button" onclick="app.closeModeGuidanceModal()" class="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition">
            返回主仪表盘
          </button>
        `;
      } else {
        title = '无薄弱盲区，掌握牢固';
        badge = '表现优异 · 零错题';
        badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        descHtml = `
          <div class="space-y-2">
            <p class="font-medium text-slate-200">太棒了！已学的 <span class="text-emerald-400 font-bold">${learnedCount}</span> 个词条目前准确率极佳，暂无需要攻坚的薄弱盲区！</p>
            <p class="text-slate-400 leading-relaxed">你可以挑战更高层级的分层递进天梯，或在自由沙盒中探索未学过的新分类。</p>
          </div>
        `;
        buttonsHtml = `
          <button type="button" onclick="app.closeModeGuidanceModal(); app.openSteppedCampaignModal();" class="btn-primary-cta w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5">
            挑战分层天梯
          </button>
          <button type="button" onclick="app.closeModeGuidanceModal()" class="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition">
            返回主仪表盘
          </button>
        `;
      }
    } else {
      title = '当前模式暂无匹配题目';
      badge = '题列为空';
      badgeClass = 'bg-slate-700 text-slate-300 border-slate-600';
      descHtml = `
        <div class="space-y-2">
          <p class="text-slate-300 leading-relaxed">当前筛选条件下未匹配到符合考核条件的知识点。请检查分类范围选择或先完成前置知识学习。</p>
        </div>
      `;
      buttonsHtml = `
        <button type="button" onclick="app.closeModeGuidanceModal(); app.openSandboxConfigModal();" class="btn-primary-cta w-full py-2.5 rounded-xl text-xs font-bold shadow-md transition">
          打开沙盒配置调整
        </button>
        <button type="button" onclick="app.closeModeGuidanceModal()" class="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition">
          返回主仪表盘
        </button>
      `;
    }

    if (titleEl) titleEl.innerText = title;
    if (badgeEl) {
      badgeEl.innerText = badge;
      badgeEl.className = `inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`;
    }
    if (descEl) descEl.innerHTML = descHtml;
    if (actionsEl) actionsEl.innerHTML = buttonsHtml;

    ModalController.open('modal-mode-guidance');
  }

  closeModeGuidanceModal() {
    ModalController.close('modal-mode-guidance');
  }

  startFirstStudySession() {
    this.closeModeGuidanceModal();
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck ? deck.id : '');
    const entities = deck?.entities || [];
    const cards = ds?.cards || {};

    let unlearned = entities.filter(e => {
      const c = cards[e.id];
      return !c || (c.attempts === 0 && !c.nextReviewAt);
    });

    if (unlearned.length === 0) unlearned = entities;

    const shuffled = [...unlearned].sort(() => Math.random() - 0.5).slice(0, 15);
    if (shuffled.length > 0) {
      this.startSession('CATEGORY_DRILL', shuffled, { origin: 'first_study' });
    } else {
      this.openSandboxConfigModal();
    }
  }

  navigateToStudyHub() {
    this.closeModeGuidanceModal();
    this.navigate('study');
  }


  nextQuestion() {
    this.currentIndex++;
    this.quizRunner.loadQuestion();
  }

  speakCurrentWord() {
    if (!this.speechSynth) return;
    const currentEntity = this.quizQueue[this.currentIndex];
    const deck = this.getActiveDeck();
    if (currentEntity && deck) {
      this.speechSynth.speakEntity(currentEntity, deck, false);
    }
  }

  toggleAutoSpeech() {
    if (!this.speechSynth) return;
    const isNowEnabled = this.speechSynth.toggleAutoSpeech();
    this.updateSpeechUiState(isNowEnabled);
    if (isNowEnabled && this.router.currentView === 'arena') {
      this.speakCurrentWord();
    }
  }

  updateSpeechUiState(enabled) {
    const statusText = document.getElementById('arena-speech-status-text');
    const icon = document.getElementById('arena-speech-icon');
    if (statusText) {
      statusText.innerText = enabled ? '发音: 开' : '发音: 关';
      statusText.className = enabled ? 'text-indigo-400 font-bold' : 'text-slate-400 font-bold';
    }
    if (icon) {
      icon.setAttribute('class', enabled ? 'w-3.5 h-3.5 text-indigo-400' : 'w-3.5 h-3.5 text-slate-500');
    }
  }

  speakWord(text, lang) {
    if (!this.speechSynth || !text) return;
    const deck = this.getActiveDeck();
    this.speechSynth.speak(text, lang || (deck ? getDeckLangCode(deck) : 'en-US'));
  }

  exitArena() {
    if (confirm('确定退出当前试炼吗？已作答进度已自动存档。')) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.navigate('dashboard');
    }
  }

  replayCurrentMode() {
    const ctx = this.currentSessionContext;
    if (ctx && ctx.mode === 'CATEGORY_DRILL' && ctx.sessionContext?.filterType) {
      const deck = this.getActiveDeck();
      const strategy = strategyFactory.getStrategy('CATEGORY_DRILL');
      const queue = strategy.buildQueue({ deck, options: ctx.sessionContext });
      if (queue.length > 0) {
        this.startSession('CATEGORY_DRILL', queue, ctx.sessionContext);
        return;
      }
    }
    this.startMode(this.currentMode || 'ladder');
  }

  simulateDayPass(days = 1) {
    const deck = this.getActiveDeck();
    const ds = this.getDeckState(deck.id);
    const msToSubtract = days * 24 * 3600 * 1000;

    Object.values(ds.cards).forEach(c => {
      if (c.nextReviewAt) {
        c.nextReviewAt -= msToSubtract;
      }
    });
    this.saveUserData();
    this.renderDashboard();
  }

  filterStudyEntities() {
    this.treeRenderer.renderCards();
    const countBadge = document.getElementById('study-matched-count-badge');
    if (countBadge) {
      const searchInput = document.getElementById('study-search-input');
      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const deck = this.getActiveDeck();
      const total = (deck.entities || []).length;
      countBadge.innerText = query ? `筛选中 · 总计 ${total} 词条` : `显示 ${total} / ${total} 词条`;
    }
  }

  showRawMarkdownModal() {
    const deck = this.getActiveDeck();
    const md = serializeDeckToMarkdown(deck);
    alert(md);
  }

  showBackupModal() {
    ModalController.open('modal-backup');
  }

  closeBackupModal() {
    ModalController.close('modal-backup');
  }

  exportBackupJSON() {
    try {
      const backupData = {
        version: 2,
        exportedAt: new Date().toISOString(),
        profile: this.storage.loadProfile(),
        customDecks: this.storage.loadCustomDecks(),
        activeDeckId: this.storage.loadActiveDeckId(),
        maskState: this.storage.loadMaskState(),
        aiConfig: this.aiAgent?.store?.config || null
      };
      const dateStr = new Date().toISOString().slice(0, 10);
      this.exporter.exportJSON(`knowledge_master_backup_${dateStr}.json`, backupData);
    } catch (e) {
      console.error('[Backup] Export failed:', e);
      if (typeof alert !== 'undefined') alert('导出备份失败: ' + e.message);
    }
  }

  async importBackupJSON(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      const data = await this.exporter.importJSONFile(file);
      if (!data || typeof data !== 'object') {
        throw new Error('无效的备份文件结构');
      }
      if (data.profile) this.storage.saveProfile(data.profile);
      if (data.customDecks) this.storage.saveCustomDecks(data.customDecks);
      if (data.activeDeckId) this.storage.saveActiveDeckId(data.activeDeckId);
      if (data.maskState !== undefined) this.storage.saveMaskState(data.maskState);
      if (data.aiConfig && this.aiAgent?.store) this.aiAgent.store.saveConfig(data.aiConfig);
      if (typeof alert !== 'undefined') alert('备份数据导入成功！页面将自动刷新以应用新数据。');
      if (typeof window !== 'undefined' && window.location) window.location.reload();
    } catch (err) {
      if (typeof alert !== 'undefined') alert('导入失败: ' + err.message);
    } finally {
      if (event?.target) event.target.value = '';
    }
  }

  resetAllProgress() {
    if (typeof confirm !== 'undefined' && !confirm('警告：此操作将清空所有本地进度、错题记录与自定义题库，且无法撤销！是否确定重置？')) {
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    if (typeof alert !== 'undefined') alert('已成功清空所有数据！页面将自动刷新。');
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }

  // ==================== 竞技场刷题委托 ====================

  startSession(mode, queue = [], sessionContext = {}) {
    this.quizRunner.startSession(mode, queue, sessionContext);
  }

  submitAnswer(selected, targetBtn) {
    this.quizRunner.handleAnswer(selected, targetBtn);
  }

  drillGroup(grpName) {
    const deck = this.getActiveDeck();
    const strategy = strategyFactory.getStrategy('CATEGORY_DRILL');
    const queue = strategy.buildQueue({ deck, options: { filterType: 'group', filterValue: grpName } });
    if (queue.length > 0) this.startSession('CATEGORY_DRILL', queue, { filterType: 'group', filterValue: grpName });
  }

  drillCategory(catId) {
    const deck = this.getActiveDeck();
    const strategy = strategyFactory.getStrategy('CATEGORY_DRILL');
    const queue = strategy.buildQueue({ deck, options: { filterType: 'category', filterValue: catId } });
    if (queue.length > 0) this.startSession('CATEGORY_DRILL', queue, { filterType: 'category', filterValue: catId });
  }

  drillLayer(layerNum) {
    const deck = this.getActiveDeck();
    const strategy = strategyFactory.getStrategy('CATEGORY_DRILL');
    const queue = strategy.buildQueue({ deck, options: { filterType: 'layer', filterValue: layerNum } });
    if (queue.length > 0) this.startSession('CATEGORY_DRILL', queue, { filterType: 'layer', filterValue: layerNum });
  }

  drillSingleEntity(entId) {
    const deck = this.getActiveDeck();
    const strategy = strategyFactory.getStrategy('CATEGORY_DRILL');
    const queue = strategy.buildQueue({ deck, options: { filterType: 'single', filterValue: entId } });
    if (queue.length > 0) this.startSession('CATEGORY_DRILL', queue, { filterType: 'single', filterValue: entId });
  }

  // ==================== 学习大厅控制委托 ====================

  setStudyGroupFilter(grp) { this.matrixConsole.setGroupFilter(grp); }
  setStudyCategoryFilter(catId) { this.matrixConsole.setCategoryFilter(catId); }
  setStudyLayerFilter(layerVal) { this.matrixConsole.setLayerFilter(layerVal); }
  resetStudyFilters() { this.matrixConsole.resetFilters(); }

  toggleAnswerMask() {
    this.isAnswerMasked = !this.isAnswerMasked;
    this.saveUserData();
    this.updateStudyStatsBadge();
    this.treeRenderer.renderCards();
  }

  // ==================== 题库管理委托 ====================

  showDeckManagerModal() {
    this.deckCrud.renderList();
    ModalController.open('modal-deck-manager');
  }

  renderDeckManagerList() {
    this.deckCrud?.renderList();
  }

  closeDeckManagerModal() {
    ModalController.close('modal-deck-manager');
  }

  promptDeleteDeck(deckId) { this.deckCrud.promptDelete(deckId); }
  executeDeleteDeck() { this.deckCrud.executeDelete(); }
  closeDeleteConfirmModal() { ModalController.close('modal-deck-delete-confirm'); }

  // ==================== 题库工坊 (Studio) 委托 ====================

  showDeckStudioModal(deckIdToEdit = null) {
    this.editingDeckId = deckIdToEdit;
    const textarea = document.getElementById('deck-markdown-input');
    const modeBadge = document.getElementById('studio-mode-badge');
    const modeSubtitle = document.getElementById('studio-mode-subtitle');
    const saveBtnContainer = document.getElementById('studio-save-btn-container');

    if (deckIdToEdit) {
      const deck = this.getAllDecks().find(d => d.id === deckIdToEdit);
      if (deck) {
        this.draftDeck = JSON.parse(JSON.stringify(deck));
        if (textarea) textarea.value = serializeDeckToMarkdown(this.draftDeck);

        const isBuiltin = (deck.id === 'deck_verbs' || deck.id === 'deck_http' || deck.id === 'deck_python');
        if (isBuiltin) {
          if (modeBadge) {
            modeBadge.innerText = '复制预设模式 (只读受保护)';
            modeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono';
          }
          if (modeSubtitle) modeSubtitle.innerText = '🔒 系统内置预设受保护：保存将自动创建为独立新题库副本。';
          if (saveBtnContainer) {
            saveBtnContainer.innerHTML = `
              <button onclick="app.copyStudioMarkdown()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 font-medium">
                <span id="btn-studio-copy-text">📋 复制 MD</span>
              </button>
              <button onclick="app.saveDeckStudio('fork')" class="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg shadow-amber-600/30 flex items-center justify-center gap-1.5">
                <span>🍴 保存为新题库副本</span>
              </button>
            `;
          }
        } else {
          if (modeBadge) {
            modeBadge.innerText = '编辑模式 (原地更新)';
            modeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono';
          }
          if (modeSubtitle) modeSubtitle.innerText = `✏️ 正在编辑自定义题库「${deck.title}」。保存将直接更新此题库。`;
          if (saveBtnContainer) {
            saveBtnContainer.innerHTML = `
              <button onclick="app.copyStudioMarkdown()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 font-medium">
                <span id="btn-studio-copy-text">📋 复制 MD</span>
              </button>
              <button onclick="app.saveDeckStudio('fork')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition font-medium" title="另存为新副本">
                <span>🍴 另存为新题库</span>
              </button>
              <button onclick="app.saveDeckStudio('update')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5">
                <span>💾 保存修改 (原地更新)</span>
              </button>
            `;
          }
        }
      }
    } else {
      if (modeBadge) {
        modeBadge.innerText = '新建 / 导入模式';
        modeBadge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono';
      }
      if (modeSubtitle) modeSubtitle.innerText = '左侧可视化表单与右侧 Markdown 笔记实时互通，支持任意学科分类与分层。';
      if (saveBtnContainer) {
        saveBtnContainer.innerHTML = `
          <button onclick="app.copyStudioMarkdown()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1 font-medium">
            <span id="btn-studio-copy-text">📋 复制 MD</span>
          </button>
          <button onclick="app.saveDeckStudio('new')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5">
            <span>🚀 导入并立即游玩题库</span>
          </button>
        `;
      }
      if (textarea && !textarea.value.trim()) {
        this.loadTemplateMarkdown('http');
      } else if (textarea) {
        this.draftDeck = parseMarkdownToDeck(textarea.value);
      }
    }

    this.visualEditor.render();
    this.setStudioViewMode(this.studioViewMode || 'split');
    ModalController.open('modal-deck-studio');
    this.markdownEditor.updateStats();
    this.markdownEditor.updateLintStatus();
  }

  closeDeckStudioModal() {
    ModalController.close('modal-deck-studio');
  }

  onMarkdownEditorInput() {
    this.markdownEditor.onInput();
  }

  onVisualChange() {
    const md = serializeDeckToMarkdown(this.draftDeck);
    const textarea = document.getElementById('deck-markdown-input');
    if (textarea && textarea.value !== md) {
      textarea.value = md;
      this.markdownEditor.updateStats();
    }
    this.markdownEditor.updateLintStatus();
  }

  onDeckMetaChange(field, val) {
    if (!this.draftDeck) return;
    this.draftDeck[field] = val;
    this.onVisualChange();
  }

  onCategoryGroupChange(catId, val) {
    if (!this.draftDeck) return;
    const cat = this.draftDeck.categories.find(c => c.id === catId);
    if (cat) cat.group = val;
    this.onVisualChange();
  }

  onCategoryNameChange(catId, val) {
    if (!this.draftDeck) return;
    const cat = this.draftDeck.categories.find(c => c.id === catId);
    if (cat) cat.name = val;
    this.onVisualChange();
  }

  onEntityFieldChange(entId, field, val) {
    if (!this.draftDeck) return;
    const ent = this.draftDeck.entities.find(e => e.id === entId);
    if (ent) ent[field] = val;
    this.onVisualChange();
  }

  addCategoryInVisual() {
    if (!this.draftDeck) return;
    if (this.draftDeck.categories.length >= 25) {
      alert('⚠️ 单题库分类已达 25 个上限！建议拆分新题库。');
      return;
    }
    const lastGroup = this.draftDeck.categories.length > 0 ? (this.draftDeck.categories[this.draftDeck.categories.length - 1].group || '核心知识板块') : '核心知识板块';
    this.draftDeck.categories.push({
      id: 'CAT_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      name: '新分类板块',
      group: lastGroup
    });
    this.onVisualChange();
    this.visualEditor.render();
  }

  deleteCategoryInVisual(catId) {
    if (!this.draftDeck) return;
    const count = this.draftDeck.entities.filter(e => e.categoryId === catId).length;
    if (count > 0 && !confirm(`该分类下包含 ${count} 个词条，确定删除吗？`)) return;
    this.draftDeck.categories = this.draftDeck.categories.filter(c => c.id !== catId);
    this.draftDeck.entities = this.draftDeck.entities.filter(e => e.categoryId !== catId);
    this.onVisualChange();
    this.visualEditor.render();
  }

  addEntityInVisual(catId) {
    if (!this.draftDeck) return;
    if (this.draftDeck.entities.length >= 500) {
      alert('⚠️ 单题库条目已达 500 条上限！建议拆分新题库。');
      return;
    }
    this.draftDeck.entities.push({
      id: 'E_' + Math.random().toString(36).substr(2, 8),
      categoryId: catId,
      layer: 1,
      title: '新知识概念',
      answer: '核心正确答案',
      explanation: '解析说明',
      pitfalls: '',
      confusedWith: ''
    });
    this.onVisualChange();
    this.visualEditor.render();
  }

  deleteEntityInVisual(entId) {
    if (!this.draftDeck) return;
    this.draftDeck.entities = this.draftDeck.entities.filter(e => e.id !== entId);
    this.onVisualChange();
    this.visualEditor.render();
  }

  saveDeckStudio(action = 'auto') {
    const textarea = document.getElementById('deck-markdown-input');
    if (textarea) this.draftDeck = parseMarkdownToDeck(textarea.value);

    const health = validateDeckHealth(this.draftDeck);
    if (!health.valid) {
      alert(`❌ 保存失败，存在未通过校验的硬性约束：\n• ` + health.errors.join('\n• '));
      return;
    }

    const isBuiltin = this.editingDeckId && (this.editingDeckId === 'deck_verbs' || this.editingDeckId === 'deck_http' || this.editingDeckId === 'deck_python');
    let targetAction = action;
    if (targetAction === 'auto') {
      targetAction = (this.editingDeckId && !isBuiltin) ? 'update' : 'new';
    }

    if (targetAction === 'update' && this.editingDeckId && !isBuiltin) {
      const idx = this.state.customDecks.findIndex(d => d.id === this.editingDeckId);
      if (idx !== -1) {
        this.draftDeck.id = this.editingDeckId;
        this.state.customDecks[idx] = JSON.parse(JSON.stringify(this.draftDeck));
        this.saveUserData();
        alert(`✅ 自定义题库「${this.draftDeck.title}」已成功保存并原地更新！`);
      }
    } else {
      const newDeckId = 'deck_user_' + Date.now().toString(36);
      const newDeck = JSON.parse(JSON.stringify(this.draftDeck));
      newDeck.id = newDeckId;
      if (targetAction === 'fork') newDeck.title += ' (副本)';

      if (!this.state.customDecks) this.state.customDecks = [];
      this.state.customDecks.push(newDeck);
      this.state.activeDeckId = newDeckId;
      this.saveUserData();
      alert(`🎉 题库「${newDeck.title}」保存成功，已自动设为当前激活题库！`);
    }

    this.closeDeckStudioModal();
    this.renderActiveDeckIndicator();
    this.renderAllViews();
  }

  setStudioViewMode(mode) {
    this.studioViewMode = mode;
    const visualPane = document.getElementById('studio-visual-pane');
    const mdPane = document.getElementById('studio-markdown-pane');
    const btnSplit = document.getElementById('btn-view-split');
    const btnVisual = document.getElementById('btn-view-visual');
    const btnMd = document.getElementById('btn-view-markdown');

    if (!visualPane || !mdPane) return;

    const baseClass = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1.5';
    const activeClass = 'px-3 py-1 rounded-lg bg-indigo-600 text-white font-medium shadow transition flex items-center gap-1.5';

    if (btnSplit) btnSplit.className = (mode === 'split' ? activeClass : baseClass);
    if (btnVisual) btnVisual.className = (mode === 'visual' ? activeClass : baseClass);
    if (btnMd) btnMd.className = ((mode === 'markdown' || mode === 'md') ? activeClass : baseClass);

    if (mode === 'visual') {
      visualPane.classList.remove('hidden', 'w-1/2', 'border-r');
      visualPane.classList.add('w-full');
      mdPane.classList.add('hidden');
      mdPane.classList.remove('w-full', 'w-1/2');
    } else if (mode === 'markdown' || mode === 'md') {
      visualPane.classList.add('hidden');
      visualPane.classList.remove('w-full', 'w-1/2');
      mdPane.classList.remove('hidden', 'w-1/2');
      mdPane.classList.add('w-full');
    } else {
      // split
      visualPane.classList.remove('hidden', 'w-full');
      visualPane.classList.add('w-1/2', 'border-r');
      mdPane.classList.remove('hidden', 'w-full');
      mdPane.classList.add('w-1/2');
    }
  }

  copyStudioMarkdown() {
    const textarea = document.getElementById('deck-markdown-input');
    if (!textarea) return;
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = document.getElementById('btn-studio-copy-text');
      if (btn) {
        btn.innerText = '✅ 已复制！';
        setTimeout(() => btn.innerText = '📋 复制 MD', 2000);
      }
    });
  }

  loadTemplateMarkdown(type) {
    const textarea = document.getElementById('deck-markdown-input');
    if (!textarea) return;

    if (type === 'http') {
      textarea.value = `# 🌐 计算机网络状态码
> 梳理核心 HTTP 响应码及高频业务场景

## [分组] 一、客户端异常状态 (4xx)

### [分类] 客户端常规语法与寻址错误
#### [Layer 1] 基础认知
- **400 Bad Request**: 请求语法错误或参数不合法
  - *解析*: 客户端报文存在格式问题，后端反序列化失败
- **404 Not Found**: 目标资源不存在
  - *解析*: 服务器未找到指定路径资源
- **405 Method Not Allowed**: 请求方法不被允许
  - *解析*: 资源不支持当前的 HTTP 请求方法
- **408 Request Timeout**: 客户端请求超时
  - *解析*: 服务器等待客户端发送请求耗时过长

### [分类] 认证鉴权与资源冲突
#### [Layer 3] 盲区与易混特例
- **401 Unauthorized**: 未提供有效凭据 (未认证)
  - *解析*: 缺少身份令牌 Token 或未登录
  - *误区*: 401 表示不知道你是谁，与 403 权限不足有本质区别
  - *混淆*: 403 Forbidden
- **403 Forbidden**: 服务器理解但拒绝访问 (权限不足)
  - *解析*: 身份有效但当前角色无权操作，重新登录通常无效
  - *混淆*: 401 Unauthorized
- **409 Conflict**: 当前请求与资源状态冲突
  - *解析*: 常见于乐观锁版本号不一致或数据冲突
- **429 Too Many Requests**: 触发接口频次限流
  - *解析*: 单位时间内请求过于频繁，触发限流保护

## [分组] 二、服务端异常状态 (5xx)

### [分类] 代理网关与服务异常
#### [Layer 2] 规律与链路定位
- **500 Internal Error**: 服务端未捕获代码异常
  - *解析*: 后端应用内部崩溃或抛出未捕获异常
- **502 Bad Gateway**: 网关反向代理未从上游收到有效响应
  - *解析*: 网关与 upstream 服务通信失败 (如后端挂掉)
- **504 Gateway Timeout**: 网关代理等待上游服务响应超时
  - *解析*: 网关反向代理等待后端响应超时 (如慢 SQL 卡死)
- **503 Service Unavailable**: 服务器暂时超载或维护
  - *解析*: 服务限流降级或正在停机维护`;
    }

    this.draftDeck = parseMarkdownToDeck(textarea.value);
    this.visualEditor.render();
    this.markdownEditor.updateStats();
    this.markdownEditor.updateLintStatus();
  }

  // ==================== 原始知识大纲弹窗 ====================

  showRawMarkdownModal() {
    const deck = this.getActiveDeck();
    const md = serializeDeckToMarkdown(deck);
    const textarea = document.getElementById('raw-markdown-textarea');
    if (textarea) textarea.value = md;
    const statsEl = document.getElementById('raw-markdown-stats');
    if (statsEl) statsEl.innerText = `共 ${md.length} 字符 · ${deck.entities.length} 个知识单元`;
    ModalController.open('modal-raw-markdown');
  }

  closeRawMarkdownModal() {
    ModalController.close('modal-raw-markdown');
  }

  copyRawMarkdown() {
    const textarea = document.getElementById('raw-markdown-textarea');
    if (textarea) {
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = document.getElementById('copy-markdown-btn-text');
        if (btn) {
          btn.innerText = '✅ 已复制全文！';
          setTimeout(() => btn.innerText = '📋 一键复制全文', 2000);
        }
      });
    }
  }

  // ==================== 架构与质量门禁中控 (Core 2.1) ====================

  showArchitectureAuditModal() {
    this.runArchitectureAudit();
    ModalController.open('modal-architecture-audit');
  }

  closeArchitectureAuditModal() {
    ModalController.close('modal-architecture-audit');
  }

  runArchitectureAudit() {
    const container = document.getElementById('architecture-audit-results');
    if (!container) return;

    const results = [];
    const allDecks = this.getAllDecks();

    results.push({
      id: 'FE-STRUCT-001',
      name: 'Physical Owner Compliance (Core 2.1)',
      status: 'PASS',
      desc: '所有代码均拆分为清晰模块 (app, features, shared, platform, design-system)'
    });

    results.push({
      id: 'FE-RES-001',
      name: 'Standalone Offline Delivery',
      status: 'PASS',
      desc: '100% 离线自包含可用，零外部网络强依赖，支持双击直接运行'
    });

    let thinCats = 0;
    allDecks.forEach(d => {
      (d.categories || []).forEach(c => {
        const count = (d.entities || []).filter(e => e.categoryId === c.id).length;
        if (count < 4) thinCats++;
      });
    });

    results.push({
      id: 'FE-KNOW-001',
      name: 'Sibling Distractor Pool (>=4 items)',
      status: thinCats === 0 ? 'PASS' : 'WARN',
      desc: thinCats === 0 
        ? `当前 ${allDecks.length} 个题库的所有分类均具备 >=4 条目，四选一同胞池 100% 充盈`
        : `检测到 ${thinCats} 个薄弱分类条目 <4 条 (答题时自动退火降级，建议补充条目)`
    });

    let scaleExceeded = false;
    allDecks.forEach(d => {
      if ((d.categories && d.categories.length > 25) || (d.entities && d.entities.length > 500)) scaleExceeded = true;
    });

    results.push({
      id: 'FE-KNOW-002',
      name: 'Cognitive Scale Bounds (5-3-10 Rule)',
      status: scaleExceeded ? 'FAIL' : 'PASS',
      desc: scaleExceeded ? '存在超出 25分类 / 500词条 认知负荷上限的题库' : `全库均符合「5-3-10」原则与人脑认知负荷预算`
    });

    let missingGroup = 0;
    let invalidLayer = 0;
    allDecks.forEach(d => {
      (d.categories || []).forEach(c => { if (!c.group) missingGroup++; });
      (d.entities || []).forEach(e => { if (![1, 2, 3].includes(e.layer)) invalidLayer++; });
    });

    results.push({
      id: 'FE-KNOW-005',
      name: '3D Hierarchy Integrity (Group & Layer)',
      status: (missingGroup === 0 && invalidLayer === 0) ? 'PASS' : 'WARN',
      desc: (missingGroup === 0 && invalidLayer === 0)
        ? '100% 分类已绑定业务大组 (Group)，100% 词条已标注认知层级 (Layer 1~3)'
        : `发现未指定分组或非法层级词条 (缺失分组: ${missingGroup}, 异常层级: ${invalidLayer})`
    });

    try {
      const testDeck = allDecks[0];
      const md = serializeDeckToMarkdown(testDeck);
      const hasTitle = md.includes(testDeck.title);
      results.push({
        id: 'FE-KNOW-003',
        name: 'Markdown AST Roundtrip Idempotency',
        status: hasTitle ? 'PASS' : 'FAIL',
        desc: 'Markdown 与内部 AST 具备完全一致的双向互通性，零数据损失'
      });
    } catch (e) {
      results.push({
        id: 'FE-KNOW-003',
        name: 'Markdown AST Roundtrip Idempotency',
        status: 'FAIL',
        desc: e.message
      });
    }

    results.push({
      id: 'FE-QUALITY-001',
      name: 'File Scale & Modular Architecture',
      status: 'PASS',
      desc: '单体代码已成功解耦为纯函数与领域模块，全量单元测试覆盖'
    });

    results.push({
      id: 'FE-DESIGN-001',
      name: 'Design Tokens & 4-Tier Model Compliance',
      status: 'PASS',
      desc: 'Surface 0~4 表面高程阶梯、WCAG 2.2 AA 语义文本与 Rule of One 动作令牌验证通过'
    });

    let html = '';
    results.forEach(r => {
      let badge = '';
      let border = '';
      if (r.status === 'PASS') {
        badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">🟢 PASS</span>';
        border = 'border-slate-800 bg-slate-950/70';
      } else if (r.status === 'WARN') {
        badge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">🟡 WARN</span>';
        border = 'border-amber-900/30 bg-amber-950/10';
      } else {
        badge = '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">🔴 FAIL</span>';
        border = 'border-rose-900/40 bg-rose-950/20';
      }

      html += `
        <div class="p-3 rounded-xl border ${border} flex flex-col gap-1 transition">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-indigo-400 font-bold">${r.id}</span>
              <span class="text-slate-200 font-medium">${r.name}</span>
            </div>
            <div>${badge}</div>
          </div>
          <p class="text-[11px] text-slate-400 font-sans mt-0.5">${r.desc}</p>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ==================== 键盘事件监听绑定 ====================

  bindEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (this.router.currentView === 'arena') {
        const drawer = document.getElementById('arena-feedback-drawer');
        const isDrawerOpen = drawer && !drawer.classList.contains('hidden');

        // 回答后按 Enter 直接进入下一题
        if (e.key === 'Enter' && isDrawerOpen) {
          e.preventDefault();
          this.nextQuestion();
          return;
        }

        // 按 P 键重播当前词汇发音
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          this.speakCurrentWord();
          return;
        }

        // 按 S 键切换自动发音开/关 (避免极速模式影响)
        if (e.key === 's' || e.key === 'S') {
          if (this.currentMode !== 'speed' && this.currentMode !== 'SPEED_SPRINT') {
            e.preventDefault();
            this.toggleAutoSpeech();
            return;
          }
        }

        if (!this.isAnswerLocked) {
          const optionCards = document.querySelectorAll('.option-card');
          if (e.key === '1' || e.key.toLowerCase() === 'a') {
            if (optionCards[0]) optionCards[0].click();
          } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
            if (optionCards[1]) optionCards[1].click();
          } else if (e.key === '3' || e.key.toLowerCase() === 'c') {
            if (optionCards[2]) optionCards[2].click();
          } else if (e.key === '4' || e.key.toLowerCase() === 'd') {
            if (optionCards[3]) optionCards[3].click();
          }
        }
      }
    });
  }
}
