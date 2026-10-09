import { renderIcon } from '../../design-system/icons/icons.js';

export class MatrixConsoleController {
  constructor(app) {
    this.app = app;
  }

  renderFilters() {
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    // 1. STEP 1: 业务大组 (Group)
    const groupContainer = document.getElementById('study-group-filters');
    if (groupContainer) {
      const groups = [];
      (deck.categories || []).forEach(c => {
        const gName = c.group || '核心知识板块';
        if (!groups.includes(gName)) groups.push(gName);
      });

      let gHtml = `
        <button onclick="app.setStudyGroupFilter('all')" class="px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${this.app.studySelectedGroup === 'all' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-800 text-slate-400 hover:text-white'}">
          全部分组 (${deck.entities.length})
        </button>
      `;

      groups.forEach(g => {
        const count = deck.entities.filter(e => {
          const c = deck.categories.find(cat => cat.id === e.categoryId);
          return c && (c.group || '核心知识板块') === g;
        }).length;
        const active = this.app.studySelectedGroup === g;
        gHtml += `
          <button onclick="app.setStudyGroupFilter('${g.replace(/'/g, "\\'")}')" class="px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'}">
            ${renderIcon('layers', 'w-3 h-3 text-current')}
            <span>${g}</span>
            <span class="text-[10px] opacity-75 font-mono">(${count})</span>
          </button>
        `;
      });
      groupContainer.innerHTML = gHtml;
    }

    // 2. STEP 2: 细分类别 (Category，随 Group 动态联动)
    const catContainer = document.getElementById('study-category-filters');
    if (catContainer) {
      let filteredCats = deck.categories || [];
      if (this.app.studySelectedGroup !== 'all') {
        filteredCats = filteredCats.filter(c => (c.group || '核心知识板块') === this.app.studySelectedGroup);
      }

      let cHtml = `
        <button onclick="app.setStudyCategoryFilter('all')" class="px-2.5 py-0.5 rounded-md text-[11px] font-medium transition ${this.app.studySelectedCategory === 'all' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'}">
          全部分类
        </button>
      `;

      filteredCats.forEach(c => {
        const count = deck.entities.filter(e => e.categoryId === c.id).length;
        const active = this.app.studySelectedCategory === c.id;
        cHtml += `
          <button onclick="app.setStudyCategoryFilter('${c.id}')" class="px-2.5 py-0.5 rounded-md text-[11px] transition flex items-center gap-1 ${active ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 font-bold' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'}">
            <span>${c.name}</span>
            <span class="text-[10px] opacity-70 font-mono">(${count})</span>
          </button>
        `;
      });
      catContainer.innerHTML = cHtml;
    }

    // 3. STEP 3: 认知层级 (Layer)
    const layerContainer = document.getElementById('study-layer-filters');
    if (layerContainer) {
      const layers = [
        { id: 'all', label: '全部认知层级' },
        { id: 1, label: 'Layer 1: 基础认知' },
        { id: 2, label: 'Layer 2: 规律运用' },
        { id: 3, label: 'Layer 3: 陷阱特例' }
      ];

      let lHtml = '';
      layers.forEach(l => {
        const active = (this.app.studySelectedLayer === l.id);
        lHtml += `
          <button onclick="app.setStudyLayerFilter('${l.id}')" class="px-2.5 py-0.5 rounded-md text-[11px] font-medium transition ${active ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'}">
            ${l.label}
          </button>
        `;
      });
      layerContainer.innerHTML = lHtml;
    }
  }

  setGroupFilter(grp) {
    this.app.studySelectedGroup = grp;
    this.app.studySelectedCategory = 'all';
    this.renderFilters();
    this.app.renderStudyHub();
  }

  setCategoryFilter(catId) {
    this.app.studySelectedCategory = catId;
    this.renderFilters();
    this.app.renderStudyHub();
  }

  setLayerFilter(layerVal) {
    this.app.studySelectedLayer = (layerVal === 'all') ? 'all' : parseInt(layerVal);
    this.renderFilters();
    this.app.renderStudyHub();
  }

  resetFilters() {
    this.app.studySelectedGroup = 'all';
    this.app.studySelectedCategory = 'all';
    this.app.studySelectedLayer = 'all';
    const searchInput = document.getElementById('study-search-input');
    if (searchInput) searchInput.value = '';
    this.renderFilters();
    this.app.renderStudyHub();
  }
}
