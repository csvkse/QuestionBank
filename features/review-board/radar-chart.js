/**
 * Knowledge Coverage & Radar Analytics Controller
 * Core: features/review-board/radar-chart.js
 */

export class RadarChartController {
  constructor(app) {
    this.app = app;
  }

  renderStats() {
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);
    const container = document.getElementById('stats-category-breakdown');
    if (!container) return;

    let totalPracticed = 0;
    (deck.entities || []).forEach(e => {
      const c = ds.cards[e.id];
      if (c && c.attempts > 0) totalPracticed++;
    });

    const totalEnts = (deck.entities || []).length;
    const overallPct = totalEnts > 0 ? Math.round((totalPracticed / totalEnts) * 100) : 0;
    const overallAcc = ds.totalAttempts > 0 ? Math.round((ds.totalCorrect / ds.totalAttempts) * 100) : 0;

    const overallPctEl = document.getElementById('stat-overall-coverage');
    const overallAccEl = document.getElementById('stat-overall-accuracy');
    if (overallPctEl) overallPctEl.innerText = `${overallPct}%`;
    if (overallAccEl) overallAccEl.innerText = `${overallAcc}%`;

    // 细分类别掌握度渲染 (按大类分组)
    const groupsMap = new Map();
    (deck.categories || []).forEach(cat => {
      const gName = cat.group || '核心知识板块';
      if (!groupsMap.has(gName)) {
        groupsMap.set(gName, { name: gName, categories: [] });
      }
      const catEnts = (deck.entities || []).filter(e => e.categoryId === cat.id);
      let catPracticed = 0;
      let catCorrect = 0;
      let catAttempts = 0;

      catEnts.forEach(e => {
        const c = ds.cards[e.id];
        if (c && c.attempts > 0) {
          catPracticed++;
          catCorrect += (c.correct || 0);
          catAttempts += (c.attempts || 0);
        }
      });

      const covPct = catEnts.length > 0 ? Math.round((catPracticed / catEnts.length) * 100) : 0;
      const accPct = catAttempts > 0 ? Math.round((catCorrect / catAttempts) * 100) : 0;

      groupsMap.get(gName).categories.push({
        ...cat,
        catPracticed,
        total: catEnts.length,
        catAttempts,
        covPct,
        accPct
      });
    });

    let html = '';
    groupsMap.forEach(group => {
      html += `
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
          <div class="flex items-center gap-2 pb-1 border-b border-slate-800/60">
            <svg class="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            <span class="text-xs font-bold text-slate-200 font-mono">${group.name}</span>
            <span class="text-[10px] text-slate-500 font-mono">(${group.categories.length}个小类)</span>
          </div>
          <div class="space-y-2">
            ${group.categories.map(c => `
              <div class="p-2.5 bg-slate-850/70 border border-slate-800/80 rounded-lg space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-slate-200 truncate">${c.name}</span>
                  <span class="font-mono text-slate-400 text-[11px]">${c.catPracticed}/${c.total} (${c.covPct}%)</span>
                </div>
                <div class="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                  <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" style="width: ${c.covPct}%"></div>
                </div>
                <div class="flex justify-between text-[10px] text-slate-500 font-mono pt-0.5">
                  <span>答题次数: ${c.catAttempts}</span>
                  <span>准确率: <b class="${c.accPct >= 80 ? 'text-emerald-400' : 'text-slate-300'}">${c.accPct}%</b></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}
