/**
 * Sandbox Custom Selection Controller
 * Core: features/arena/sandbox-config.js
 * 
 * Provides custom category selection, cognitive layer filtering,
 * trial mode rules, question count options, and shuffle mode for Free Lab.
 */

import { strategyFactory } from '../../shared/question-strategies/index.js';

export class SandboxConfigController {
  constructor(app) {
    this.app = app;
    this.selectedCategories = new Set();
    this.selectedLayers = new Set([1, 2, 3]);
    this.trialMode = 'DEFAULT'; // 'DEFAULT' | 'WEAKNESS' | 'STEPPED' | 'SPEED_SPRINT'
    this.questionCount = 10;
    this.isShuffle = true;
  }

  openModal() {
    const deck = this.app.getActiveDeck();
    if (!deck) return;
    this._setupAndOpen(new Set((deck.categories || []).map(c => c.id)));
  }

  openModalForGroup(groupName) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;
    const cats = (deck.categories || []).filter(c => (c.group || '核心知识板块') === groupName);
    this._setupAndOpen(new Set(cats.map(c => c.id)));
  }

  openModalForCategory(categoryId) {
    if (!this.app.getActiveDeck()) return;
    this._setupAndOpen(new Set([categoryId]));
  }

  _setupAndOpen(catSet) {
    this.selectedCategories = catSet;
    this.selectedLayers = new Set([1, 2, 3]);
    this.trialMode = 'DEFAULT';
    const matched = this.getMatchedEntities();
    this.questionCount = Math.min(10, matched.length || 10);
    this.isShuffle = true;
    this.renderModalContent();
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('modal-sandbox-config');
      if (modal) modal.classList.remove('hidden');
    }
  }

  closeModal() {
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('modal-sandbox-config');
      if (modal) modal.classList.add('hidden');
    }
  }

  renderModalContent() {
    const deck = this.app.getActiveDeck();
    if (!deck || typeof document === 'undefined') return;

    const catContainer = document.getElementById('sandbox-categories-list');
    if (catContainer) {
      // 提取业务大组 (参考知识精读 Study Hub 分类方案)
      const groups = [];
      (deck.categories || []).forEach(c => {
        const gName = c.group || '核心知识板块';
        if (!groups.includes(gName)) groups.push(gName);
      });

      let html = '';
      groups.forEach(groupName => {
        const groupCats = (deck.categories || []).filter(c => (c.group || '核心知识板块') === groupName);
        const groupEntitiesCount = (deck.entities || []).filter(e => {
          const c = deck.categories.find(cat => cat.id === e.categoryId);
          return c && (c.group || '核心知识板块') === groupName;
        }).length;

        html += `
          <div class="space-y-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div class="flex items-center justify-between pb-1 border-b border-slate-800/60">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                <span class="text-[11px] font-bold text-slate-200 truncate font-mono">${groupName}</span>
                <span class="text-[10px] text-slate-500 font-mono">(${groupEntitiesCount}题)</span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] shrink-0 font-mono">
                <button type="button" onclick="app.sandboxConfig.selectGroupCategories('${groupName.replace(/'/g, "\\'")}', true)" class="text-cyan-400 hover:underline">全选</button>
                <span class="text-slate-600">|</span>
                <button type="button" onclick="app.sandboxConfig.selectGroupCategories('${groupName.replace(/'/g, "\\'")}', false)" class="text-slate-500 hover:underline">清空</button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              ${groupCats.map(cat => {
                const count = (deck.entities || []).filter(e => e.categoryId === cat.id).length;
                const checked = this.selectedCategories.has(cat.id) ? 'checked' : '';
                return `
                  <label class="flex items-center justify-between p-2 rounded-lg surface-inset hover:bg-slate-800/80 cursor-pointer border border-slate-750 transition text-xs select-none">
                    <div class="flex items-center gap-2 min-w-0">
                      <input type="checkbox" data-cat-id="${cat.id}" ${checked}
                        onchange="app.sandboxConfig.toggleCategory('${cat.id}', this.checked)"
                        class="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0">
                      <span class="text-slate-300 truncate text-[11px] font-medium">${cat.name}</span>
                    </div>
                    <span class="text-[10px] text-slate-500 font-mono shrink-0 pl-1">${count}题</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });
      catContainer.innerHTML = html;
    }

    // 更新层级复选框状态
    [1, 2, 3].forEach(layer => {
      const el = document.getElementById(`sandbox-layer-${layer}`);
      if (el) el.checked = this.selectedLayers.has(layer);
    });

    // 更新模式与题量按钮状态
    this.updateModeStyles();
    this.updateCountPillStyles();

    // 更新乱序开关
    const shuffleEl = document.getElementById('sandbox-shuffle-toggle');
    if (shuffleEl) shuffleEl.checked = this.isShuffle;

    this.updateMatchingCount();
  }

  toggleCategory(catId, isChecked) {
    if (isChecked) {
      this.selectedCategories.add(catId);
    } else {
      this.selectedCategories.delete(catId);
    }
    this.updateMatchingCount();
  }

  selectGroupCategories(groupName, select) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    const groupCats = (deck.categories || []).filter(c => (c.group || '核心知识板块') === groupName);
    groupCats.forEach(c => {
      if (select) this.selectedCategories.add(c.id);
      else this.selectedCategories.delete(c.id);
    });

    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      groupCats.forEach(c => {
        const cbs = document.querySelectorAll(`#sandbox-categories-list input[data-cat-id="${c.id}"]`);
        cbs.forEach(cb => { cb.checked = select; });
      });
    }
    this.updateMatchingCount();
  }

  selectAllCategories(select) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;
    if (select) {
      (deck.categories || []).forEach(c => this.selectedCategories.add(c.id));
    } else {
      this.selectedCategories.clear();
    }
    if (typeof document !== 'undefined') {
      const checkboxes = document.querySelectorAll('#sandbox-categories-list input[type="checkbox"]');
      checkboxes.forEach(cb => { cb.checked = select; });
    }
    this.updateMatchingCount();
  }

  toggleLayer(layerNum, isChecked) {
    if (isChecked) this.selectedLayers.add(layerNum);
    else this.selectedLayers.delete(layerNum);
    this.updateMatchingCount();
  }

  setTrialMode(mode) {
    this.trialMode = mode;
    this.updateModeStyles();
    if (mode === 'STEPPED') {
      this.isShuffle = false;
      if (typeof document !== 'undefined') {
        const shuffleEl = document.getElementById('sandbox-shuffle-toggle');
        if (shuffleEl) shuffleEl.checked = false;
      }
    }
  }

  updateModeStyles() {
    if (typeof document === 'undefined') return;
    ['DEFAULT', 'WEAKNESS', 'STEPPED', 'SPEED_SPRINT'].forEach(m => {
      const el = document.getElementById(`sandbox-mode-${m.toLowerCase()}`);
      if (!el) return;
      const isSelected = this.trialMode === m;
      el.className = isSelected
        ? 'flex flex-col p-2.5 rounded-xl border border-indigo-500 bg-indigo-600/20 text-white shadow-sm transition text-left select-none'
        : 'flex flex-col p-2.5 rounded-xl border border-slate-750 surface-inset hover:bg-slate-800 text-slate-300 transition text-left select-none';
      const indicator = el.querySelector('.mode-indicator');
      if (indicator) indicator.className = `mode-indicator w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-600'}`;
    });
  }

  setQuestionCount(count) {
    this.questionCount = count;
    this.updateCountPillStyles();
    this.updateMatchingCount();
  }

  updateCountPillStyles() {
    if (typeof document === 'undefined') return;
    [5, 10, 15, 'all'].forEach(c => {
      const btn = document.getElementById(`sandbox-count-${c}`);
      if (!btn) return;
      const isSelected = (c === 'all' && this.questionCount === 9999) || (this.questionCount === c);
      btn.className = isSelected
        ? 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm transition'
        : 'px-3 py-1.5 rounded-lg surface-inset hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition border border-slate-750';
    });
  }

  toggleShuffle(isChecked) {
    this.isShuffle = isChecked;
  }

  getMatchedEntities() {
    const deck = this.app.getActiveDeck();
    if (!deck || !deck.entities) return [];
    return deck.entities.filter(item => this.selectedCategories.has(item.categoryId) && this.selectedLayers.has(item.layer));
  }

  buildQueue(matched) {
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck ? deck.id : '');
    const strategy = strategyFactory.getStrategy('SANDBOX_CUSTOM');
    return strategy.buildQueue({
      deck,
      deckState: ds,
      options: {
        selectedCategories: this.selectedCategories,
        selectedLayers: this.selectedLayers,
        trialMode: this.trialMode,
        questionCount: this.questionCount,
        isShuffle: this.isShuffle
      }
    });
  }

  updateMatchingCount() {
    if (typeof document === 'undefined') return;
    const matched = this.getMatchedEntities();
    const badge = document.getElementById('sandbox-matched-count-text');
    const startBtn = document.getElementById('sandbox-start-btn');
    const targetCount = this.questionCount === 9999 ? matched.length : Math.min(this.questionCount, matched.length);
    if (badge) badge.innerText = `已匹配 ${matched.length} 道词条 · 将抽取 ${targetCount} 题`;
    if (startBtn) {
      startBtn.disabled = matched.length === 0;
      startBtn.classList.toggle('opacity-50', matched.length === 0);
      startBtn.classList.toggle('cursor-not-allowed', matched.length === 0);
    }
  }

  startCustomQuiz() {
    const matched = this.getMatchedEntities();
    if (matched.length === 0) {
      alert('请至少选择一个分类和一个认知层级以匹配题目。');
      return;
    }

    const queue = this.buildQueue(matched);
    const sessionMode = this.trialMode === 'SPEED_SPRINT' ? 'SPEED_SPRINT'
      : this.trialMode === 'WEAKNESS' ? 'WEAKNESS'
      : this.trialMode === 'STEPPED' ? 'CAMPAIGN'
      : 'FREE_LAB';

    this.closeModal();
    this.app.startSession(sessionMode, queue, { origin: 'sandbox', allowPromotion: false });
  }
}
