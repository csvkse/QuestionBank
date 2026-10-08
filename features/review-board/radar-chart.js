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

    // 细分类别掌握度渲染
    let html = '';
    (deck.categories || []).forEach(cat => {
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

      html += `
        <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-white truncate">${cat.name}</span>
            <span class="font-mono text-slate-400">${catPracticed}/${catEnts.length} (${covPct}%)</span>
          </div>
          <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500" style="width: ${covPct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>答题次数: ${catAttempts}</span>
            <span>准确率: <b class="${accPct >= 80 ? 'text-emerald-400' : 'text-slate-300'}">${accPct}%</b></span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}
