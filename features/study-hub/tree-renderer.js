/**
 * 3-Tier Card Tree Renderer (Group -> Category -> Layer -> Entity)
 * Core: features/study-hub/tree-renderer.js
 */

export class TreeRenderer {
  constructor(app) {
    this.app = app;
  }

  renderCards() {
    const container = document.getElementById('study-cards-container');
    if (!container) return;

    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);
    const searchInput = document.getElementById('study-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const endOfToday = new Date().setHours(23, 59, 59, 999);

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

    if (filteredEntities.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
          <div class="text-3xl">🔍</div>
          <p class="text-sm">未匹配到符合当前筛选条件的概念词条</p>
          <button onclick="app.resetStudyFilters()" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition">
            重置所有筛选
          </button>
        </div>
      `;
      return;
    }

    // 2. 组装三层结构树: tree[groupName][catId].layers[layerNum] = [...]
    const tree = {};
    filteredEntities.forEach(item => {
      const cat = deck.categories.find(c => c.id === item.categoryId) || { id: 'unknown', name: '未知分类', group: '核心知识板块' };
      const grpName = cat.group || '核心知识板块';

      if (!tree[grpName]) tree[grpName] = {};
      if (!tree[grpName][cat.id]) {
        tree[grpName][cat.id] = {
          category: cat,
          layers: { 1: [], 2: [], 3: [] }
        };
      }
      const l = item.layer || 1;
      if (!tree[grpName][cat.id].layers[l]) tree[grpName][cat.id].layers[l] = [];
      tree[grpName][cat.id].layers[l].push(item);
    });

    // 3. 递归渲染 Group 容器 -> Category 容器 -> Layer 色带 -> Entity 卡片
    let html = '';
    Object.keys(tree).forEach(grpName => {
      const catsObj = tree[grpName];
      let groupTotalEnts = 0;
      Object.values(catsObj).forEach(cObj => {
        [1, 2, 3].forEach(l => { groupTotalEnts += cObj.layers[l].length; });
      });

      html += `
        <div class="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-5 shadow-lg">
          <!-- 📦 顶级大组标头 -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 flex-wrap gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
                📦
              </span>
              <div>
                <h3 class="text-base font-black text-white tracking-wide">${grpName}</h3>
                <p class="text-xs text-slate-400 font-mono">共包含 ${Object.keys(catsObj).length} 个细分类别 · ${groupTotalEnts} 个考点词条</p>
              </div>
            </div>
            <button onclick="app.drillGroup('${grpName.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition flex items-center gap-1 shadow-sm">
              <span>🚀 专项练习此大组 (${groupTotalEnts})</span>
            </button>
          </div>

          <!-- 分类列表 -->
          <div class="space-y-6">
      `;

      Object.keys(catsObj).forEach(catId => {
        const { category, layers } = catsObj[catId];
        let catTotalEnts = layers[1].length + layers[2].length + layers[3].length;

        html += `
          <div class="bg-slate-950/60 border border-slate-800/70 rounded-xl p-3.5 sm:p-4 space-y-4">
            <!-- 🏷️ 二级分类标头 -->
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-indigo-300 font-bold font-mono border border-slate-700">🏷️ ${category.name}</span>
                <span class="text-xs text-slate-500 font-mono">(${catTotalEnts} 词条)</span>
              </div>
              <button onclick="app.drillCategory('${category.id}')" class="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition flex items-center gap-1">
                <span>练习此分类 &rarr;</span>
              </button>
            </div>

            <!-- 三级层级色带与卡片流 -->
            <div class="space-y-4">
        `;

        [1, 2, 3].forEach(lNum => {
          const items = layers[lNum];
          if (!items || items.length === 0) return;

          const lIcon = lNum === 1 ? '🌱' : (lNum === 2 ? '🌿' : '🔥');
          const lName = lNum === 1 ? '基础认知' : (lNum === 2 ? '规律运用' : '陷阱与特例');
          const lColor = lNum === 1 
            ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' 
            : (lNum === 2 ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30');

          html += `
            <div class="space-y-2.5">
              <!-- 层级标头 -->
              <div class="flex items-center gap-2 pt-1">
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded border font-mono ${lColor} flex items-center gap-1.5 shadow-sm">
                  <span>${lIcon}</span>
                  <span>Layer ${lNum}: ${lName}</span>
                  <span class="opacity-80">(${items.length} 词条)</span>
                </span>
                <div class="h-px bg-slate-800/80 flex-1"></div>
                <button onclick="app.drillLayer(${lNum})" class="text-[10px] text-slate-500 hover:text-slate-300 transition">只练此层 &rarr;</button>
              </div>

              <!-- 词条卡片网格 -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          `;

          items.forEach(item => {
            const card = ds.cards[item.id] || { level: 0, attempts: 0, correct: 0, wrong: 0 };
            
            // 记忆状态标签
            let stateBadge = '';
            if (card.attempts === 0) {
              stateBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">未学习</span>';
            } else if (card.level >= 4) {
              stateBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🟢 稳固掌握</span>';
            } else if (card.nextReviewAt && card.nextReviewAt <= endOfToday) {
              stateBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">🟡 今日到期</span>';
            } else {
              stateBadge = '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">🔵 记忆冷却中</span>';
            }

            // 核心答案样式 (支持遮挡自测)
            const answerClass = this.app.isAnswerMasked 
              ? 'filter blur-[5px] hover:filter-none transition-all cursor-pointer select-none bg-slate-800 px-2 py-0.5 rounded text-indigo-400 hover:text-indigo-200 border border-slate-700 inline-block font-mono'
              : 'text-indigo-300 font-mono font-bold bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded inline-block';

            html += `
              <div class="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition shadow-sm">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h4 class="text-base font-black text-white tracking-wide">${item.title}</h4>
                      <p class="text-xs text-slate-400 font-mono mt-0.5">${item.subtitle || ''}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <span class="text-[10px] px-2 py-0.5 rounded border font-mono ${lColor}">L${item.layer}</span>
                      ${stateBadge}
                    </div>
                  </div>

                  <!-- 核心答案与考核目标 -->
                  <div class="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div class="text-slate-400 text-[11px] font-medium">${item.prompt || '核心对应与特征：'}</div>
                    <div>
                      <span class="${answerClass}" title="${this.app.isAnswerMasked ? '点击或鼠标悬停查看答案' : ''}">${item.answer}</span>
                    </div>
                  </div>

                  <!-- 规则精要 -->
                  <div class="mt-3 text-xs leading-relaxed text-slate-300">
                    <span class="text-indigo-400 font-bold">【规则精要】:</span> ${item.explanation}
                  </div>

                  <!-- 避坑提醒 -->
                  ${item.pitfalls ? `
                    <div class="mt-2 text-xs text-rose-300 leading-relaxed bg-rose-950/20 border border-rose-900/30 rounded-lg p-2">
                      <span class="font-bold">⚠️ 【易错避坑】:</span> ${item.pitfalls}
                    </div>
                  ` : ''}

                  <!-- 混淆同胞 -->
                  ${item.confusedWith ? `
                    <div class="mt-2 text-[11px] text-amber-300/90 font-mono">
                      <span>🔗 强辨析同胞:</span> <span class="underline">${item.confusedWith}</span>
                    </div>
                  ` : ''}
                </div>

                <!-- 底部做题记录与专项突破 -->
                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>历史做题: <b class="text-emerald-400">${card.correct}</b>对 / <b class="text-rose-400">${card.wrong}</b>错</span>
                  <button onclick="app.drillSingleEntity('${item.id}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition font-medium">
                    🎯 专项突破
                  </button>
                </div>
              </div>
            `;
          });

          html += `
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}
