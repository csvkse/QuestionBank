/**
 * Single-Point Focused Deep Reading Card Controller
 * Core: features/study-hub/focus-reader.js
 * 
 * Provides a 3-phase structured visual focus:
 * Phase 1: Core Definition (with active recall blur mask)
 * Phase 2: Sibling Distinction Matrix (comparing against category distractors)
 * Phase 3: Pitfalls & Memory Hook (high-contrast mnemonic callout)
 */

import { renderIcon } from '../../design-system/icons/icons.js';
import { isLanguageDeck } from '../../platform/audio/speech-synth.js';

export class FocusReaderController {
  constructor(app) {
    this.app = app;
    this.activeEntityId = null;
    this.bindKeyboardShortcuts();
  }

  bindKeyboardShortcuts() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      // 仅在知识精读视图且焦点模式下响应左右方向键
      const studyView = document.getElementById('view-study');
      if (!studyView || studyView.classList.contains('hidden')) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === 'ArrowLeft') {
        this.navigatePrev();
      } else if (e.key === 'ArrowRight') {
        this.navigateNext();
      }
    });
  }

  setActiveEntity(entityId) {
    this.activeEntityId = entityId;
    this.render();
  }

  getFilteredEntities() {
    const deck = this.app.getActiveDeck();
    if (!deck) return [];

    const searchInput = document.getElementById('study-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    return (deck.entities || []).filter(item => {
      const cat = deck.categories.find(c => c.id === item.categoryId);
      const grp = cat ? (cat.group || '核心知识板块') : '核心知识板块';

      if (this.app.studySelectedGroup !== 'all' && grp !== this.app.studySelectedGroup) return false;
      if (this.app.studySelectedCategory !== 'all' && item.categoryId !== this.app.studySelectedCategory) return false;
      if (this.app.studySelectedLayer !== 'all' && item.layer !== this.app.studySelectedLayer) return false;

      if (query) {
        const text = `${item.title} ${item.answer} ${item.subtitle || ''} ${item.explanation || ''} ${item.pitfalls || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }

  render() {
    const container = document.getElementById('study-focus-card-pane');
    if (!container) return;

    const list = this.getFilteredEntities();
    if (list.length === 0) {
      container.innerHTML = `
        <div class="h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center text-slate-400 surface-card rounded-2xl border border-slate-800">
          <div class="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 mb-3">
            ${renderIcon('search', 'w-6 h-6')}
          </div>
          <p class="text-sm font-medium text-slate-300">未找到匹配的考点词条</p>
          <p class="text-xs text-slate-500 mt-1">请重置筛选或在左侧目录树选择其他分类</p>
        </div>
      `;
      return;
    }

    let currentIndex = list.findIndex(e => e.id === this.activeEntityId);
    if (currentIndex === -1) {
      currentIndex = 0;
      this.activeEntityId = list[0].id;
    }

    const entity = list[currentIndex];
    const deck = this.app.getActiveDeck();
    const cat = deck.categories.find(c => c.id === entity.categoryId) || { name: '通用考点', group: '核心体系' };
    const ds = this.app.getDeckState(deck.id);
    const cardState = ds.cards[entity.id] || { level: 0, attempts: 0 };
    const isMasked = this.app.isAnswerMasked;

    // 获取同分类同胞干扰项
    const siblings = (deck.entities || []).filter(e => e.categoryId === entity.categoryId && e.id !== entity.id).slice(0, 3);

    // 状态胶囊
    let statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">未开始学习</span>';
    if (cardState.attempts > 0) {
      if (cardState.level >= 4) {
        statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">稳固掌握 (Lv 4)</span>';
      } else {
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">巩固中 (Lv ${cardState.level})</span>`;
      }
    }

    const maskClass = isMasked ? 'filter blur-sm select-none hover:filter-none transition-all cursor-pointer' : '';

    container.innerHTML = `
      <div class="surface-card rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl flex flex-col justify-between min-h-[520px]">
        
        <!-- 卡片顶部面包屑与状态条 -->
        <div>
          <div class="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-800/80 text-xs">
            <div class="flex items-center gap-2 text-slate-400 font-mono truncate">
              <span class="text-indigo-400 font-bold">${cat.group || '核心体系'}</span>
              <span>/</span>
              <span class="text-slate-300">${cat.name}</span>
              <span>/</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400">Layer ${entity.layer}</span>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              ${statusBadge}
              <button onclick="app.drillSingleEntity('${entity.id}')" class="btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition" title="立即针对此考点发起单题测验">
                ${renderIcon('target', 'w-3 h-3 text-indigo-400')}
                <span>专项测验</span>
              </button>
            </div>
          </div>

          <!-- 词条大标题 -->
          <div class="mt-4 mb-5">
            <h3 class="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>${entity.title}</span>
              ${isLanguageDeck(deck) ? `
                <button onclick="app.speakWord('${entity.title.replace(/'/g, "\\'")}')" class="p-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-slate-700 transition" title="朗读发音">
                  <svg class="w-4 h-4 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
              ` : ''}
            </h3>
            ${entity.subtitle ? `<p class="text-xs text-slate-400 mt-1 font-mono">${entity.subtitle}</p>` : ''}
          </div>

          <!-- 三段式聚焦内容 -->
          <div class="space-y-4">
            
            <!-- 阶段 1: 核心定义 (Core Definition) -->
            <div class="surface-inset rounded-xl p-4 border border-slate-750/80">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
                  ${renderIcon('book', 'w-3.5 h-3.5 text-indigo-400')}
                  <span>核心答案 / 定义</span>
                </span>
                ${isMasked ? '<span class="text-[10px] text-amber-400 font-mono">遮挡中 · 悬停可透视</span>' : ''}
              </div>
              <div class="text-base sm:text-lg font-bold text-indigo-300 ${maskClass} leading-relaxed">
                ${entity.answer}
              </div>
              ${entity.explanation ? `
                <div class="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
                  ${entity.explanation}
                </div>
              ` : ''}
            </div>

            <!-- 阶段 2: 同胞干扰项辨析矩阵 (Sibling Distinction) -->
            ${siblings.length > 0 ? `
              <div class="surface-inset rounded-xl p-4 border border-slate-750/80">
                <div class="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                  ${renderIcon('layers', 'w-3.5 h-3.5 text-purple-400')}
                  <span>同胞概念横向辨析矩阵 (分类: ${cat.name})</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  ${siblings.map(s => `
                    <div onclick="app.focusReader.setActiveEntity('${s.id}')" class="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
                      <div class="font-bold text-slate-200 truncate flex items-center justify-between">
                        <span class="truncate">${s.title}</span>
                        <span class="text-[10px] font-mono text-slate-500">L${s.layer}</span>
                      </div>
                      <div class="text-[11px] text-slate-400 mt-1 line-clamp-2">${s.answer}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- 阶段 3: 避坑要点与记忆助记 (Pitfalls & Mnemonic) -->
            ${entity.pitfalls ? `
              <div class="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5">
                <div class="mt-0.5 shrink-0 text-amber-400">
                  ${renderIcon('bulb', 'w-4 h-4')}
                </div>
                <div>
                  <div class="font-bold text-[11px] uppercase font-mono tracking-wider mb-0.5 text-amber-200">避坑要点 / 易错盲区</div>
                  <div class="leading-relaxed">${entity.pitfalls}</div>
                </div>
              </div>
            ` : ''}

          </div>
        </div>

        <!-- 卡片底部翻页控制器与快捷键提示 -->
        <div class="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <button onclick="app.focusReader.navigatePrev()" ${currentIndex === 0 ? 'disabled' : ''} class="btn-secondary px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${currentIndex === 0 ? 'opacity-40 cursor-not-allowed' : ''}">
            ${renderIcon('arrowLeft', 'w-3.5 h-3.5')}
            <span>上一个</span>
          </button>

          <div class="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <span>第 <strong class="text-white">${currentIndex + 1}</strong> / ${list.length} 个考点</span>
            <span class="hidden sm:inline text-slate-600">|</span>
            <span class="hidden sm:inline text-slate-500">方向键 ← / → 快捷翻页</span>
          </div>

          <button onclick="app.focusReader.navigateNext()" ${currentIndex === list.length - 1 ? 'disabled' : ''} class="btn-secondary px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${currentIndex === list.length - 1 ? 'opacity-40 cursor-not-allowed' : ''}">
            <span>下一个</span>
            ${renderIcon('arrowRight', 'w-3.5 h-3.5')}
          </button>
        </div>

      </div>
    `;
  }

  navigatePrev() {
    const list = this.getFilteredEntities();
    const curIdx = list.findIndex(e => e.id === this.activeEntityId);
    if (curIdx > 0) {
      this.setActiveEntity(list[curIdx - 1].id);
      this.scrollTreeNodeIntoView(list[curIdx - 1].id);
    }
  }

  navigateNext() {
    const list = this.getFilteredEntities();
    const curIdx = list.findIndex(e => e.id === this.activeEntityId);
    if (curIdx >= 0 && curIdx < list.length - 1) {
      this.setActiveEntity(list[curIdx + 1].id);
      this.scrollTreeNodeIntoView(list[curIdx + 1].id);
    }
  }

  scrollTreeNodeIntoView(entityId) {
    const nodeEl = document.getElementById(`study-tree-node-${entityId}`);
    if (nodeEl) {
      nodeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
