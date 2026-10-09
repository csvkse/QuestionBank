/**
 * Study Hub Tree Renderer & Layout Controller
 * Core: features/study-hub/tree-renderer.js
 * 
 * Manages dual-mode display:
 * 1. Focus Mode (Default): Left outline tree + Right 3-phase single-focus card
 * 2. Overview Mode: Multi-card matrix view
 */

import { renderIcon } from '../../design-system/icons/icons.js';

export class TreeRenderer {
  constructor(app) {
    this.app = app;
    this.studyViewMode = 'focus'; // 'focus' | 'overview'
  }

  setStudyViewMode(mode) {
    this.studyViewMode = mode;
    this.renderCards();
    if (this.app?.router?.scrollToTop) {
      this.app.router.scrollToTop();
    }
  }

  renderCards() {
    const container = document.getElementById('study-content-container') || document.getElementById('study-cards-container');
    if (!container) return;

    const deck = this.app.getActiveDeck();
    if (!deck) return;

    const ds = this.app.getDeckState(deck.id);
    const searchInput = document.getElementById('study-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 1. 筛选词条列表
    const filteredEntities = (deck.entities || []).filter(item => {
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

    // 顶部模式切换栏
    const modeToggleBar = `
      <div class="flex items-center justify-between pb-1 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-slate-400 font-medium">视图模式:</span>
          <div class="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button onclick="app.treeRenderer.setStudyViewMode('focus')" class="px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${this.studyViewMode === 'focus' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}">
              ${renderIcon('target', 'w-3.5 h-3.5')}
              <span>聚焦精读模式</span>
            </button>
            <button onclick="app.treeRenderer.setStudyViewMode('overview')" class="px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${this.studyViewMode === 'overview' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}">
              ${renderIcon('book', 'w-3.5 h-3.5')}
              <span>全景大纲模式</span>
            </button>
          </div>
        </div>
        <span class="text-[11px] text-slate-500 font-mono">共匹配 ${filteredEntities.length} 个考点</span>
      </div>
    `;

    if (filteredEntities.length === 0) {
      container.innerHTML = `
        ${modeToggleBar}
        <div class="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
          <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            ${renderIcon('search', 'w-5 h-5')}
          </div>
          <p class="text-sm">未匹配到符合当前筛选条件的概念词条</p>
          <button onclick="app.resetStudyFilters()" class="btn-primary-cta px-4 py-1.5 rounded-lg text-xs font-medium transition">
            重置所有筛选
          </button>
        </div>
      `;
      return;
    }

    if (this.studyViewMode === 'focus') {
      this.renderFocusLayout(container, modeToggleBar, deck, ds, filteredEntities);
    } else {
      this.renderOverviewLayout(container, modeToggleBar, deck, ds, filteredEntities);
    }
  }

  renderFocusLayout(container, modeToggleBar, deck, ds, filteredEntities) {
    const activeId = this.app.focusReader.activeEntityId || filteredEntities[0].id;
    if (!this.app.focusReader.activeEntityId) {
      this.app.focusReader.activeEntityId = activeId;
    }

    // 组装树形导航
    const tree = {};
    filteredEntities.forEach(item => {
      const cat = deck.categories.find(c => c.id === item.categoryId) || { id: 'unknown', name: '未知分类', group: '核心知识板块' };
      const grpName = cat.group || '核心知识板块';
      if (!tree[grpName]) tree[grpName] = {};
      if (!tree[grpName][cat.id]) {
        tree[grpName][cat.id] = { category: cat, entities: [] };
      }
      tree[grpName][cat.id].entities.push(item);
    });

    let navHtml = '';
    Object.keys(tree).forEach(grpName => {
      const cats = tree[grpName];
      navHtml += `
        <div class="space-y-2">
          <div class="text-[11px] font-bold text-slate-400 font-mono flex items-center gap-1 px-1">
            ${renderIcon('layers', 'w-3 h-3 text-indigo-400')}
            <span>${grpName}</span>
          </div>
          <div class="space-y-2 pl-1.5 border-l border-slate-800">
      `;

      Object.keys(cats).forEach(catId => {
        const { category, entities } = cats[catId];
        navHtml += `
          <div class="space-y-1">
            <div class="text-[10px] font-semibold text-slate-500 uppercase px-1.5 py-0.5">
              ${category.name} (${entities.length})
            </div>
            <div class="space-y-0.5">
        `;

        entities.forEach(ent => {
          const isActive = ent.id === activeId;
          const cardState = ds.cards[ent.id] || { level: 0, attempts: 0 };
          let dotColor = 'bg-slate-600';
          if (cardState.attempts > 0) {
            dotColor = cardState.level >= 4 ? 'bg-emerald-400' : 'bg-indigo-400';
          }

          navHtml += `
            <div id="study-tree-node-${ent.id}" onclick="app.focusReader.setActiveEntity('${ent.id}')"
              class="group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${isActive ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/50 font-bold' : 'hover:bg-slate-850 text-slate-300 hover:text-white border border-transparent'}">
              <div class="flex items-center gap-2 min-w-0 pr-1">
                <span class="w-1.5 h-1.5 rounded-full ${dotColor} shrink-0"></span>
                <span class="truncate">${ent.title}</span>
              </div>
              <span class="text-[10px] font-mono text-slate-500 shrink-0">L${ent.layer}</span>
            </div>
          `;
        });

        navHtml += `</div></div>`;
      });

      navHtml += `</div></div>`;
    });

    container.innerHTML = `
      <div class="space-y-3">
        ${modeToggleBar}
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          
          <!-- 左侧目录树导航侧边栏 -->
          <div class="md:col-span-4 surface-card rounded-2xl border border-slate-800 p-3.5 max-h-[640px] overflow-y-auto space-y-4 shadow-md">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[11px] text-slate-400 font-mono">
              <span>知识大纲目录</span>
              <span>${filteredEntities.length} 项</span>
            </div>
            <div class="space-y-3 text-xs">
              ${navHtml}
            </div>
          </div>

          <!-- 右侧单点聚焦卡片容器 -->
          <div id="study-focus-card-pane" class="md:col-span-8 min-h-[520px]">
            <!-- 由 app.focusReader.render() 填充 -->
          </div>

        </div>
      </div>
    `;

    this.app.focusReader.render();
  }

  renderOverviewLayout(container, modeToggleBar, deck, ds, filteredEntities) {
    let cardsHtml = '';
    filteredEntities.forEach(item => {
      const cat = deck.categories.find(c => c.id === item.categoryId) || { name: '通用考点', group: '核心体系' };
      const cardState = ds.cards[item.id] || { level: 0, attempts: 0 };
      const isMasked = this.app.isAnswerMasked;
      const maskClass = isMasked ? 'filter blur-sm select-none hover:filter-none transition-all cursor-pointer' : '';

      cardsHtml += `
        <div class="surface-card rounded-xl border border-slate-800 p-4 space-y-3 shadow-sm hover:border-slate-700 transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-slate-400 font-mono pb-2 border-b border-slate-800/60">
              <span class="truncate text-indigo-400">${cat.name}</span>
              <span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px]">L${item.layer}</span>
            </div>
            <h4 class="font-bold text-white text-base mt-2.5">${item.title}</h4>
            <div class="mt-2 p-2.5 surface-inset rounded-lg text-sm text-indigo-300 font-semibold ${maskClass}">
              ${item.answer}
            </div>
            ${item.explanation ? `<p class="mt-2 text-xs text-slate-400 line-clamp-3">${item.explanation}</p>` : ''}
          </div>
          <div class="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
            <span class="text-[11px] text-slate-500 font-mono">熟练度 Lv.${cardState.level}</span>
            <button onclick="app.drillSingleEntity('${item.id}')" class="text-indigo-400 hover:text-indigo-300 font-medium transition flex items-center gap-1">
              <span>单题测验 &rarr;</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="space-y-4">
        ${modeToggleBar}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${cardsHtml}
        </div>
      </div>
    `;
  }
}
