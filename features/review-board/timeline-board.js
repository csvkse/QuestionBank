/**
 * Spaced Repetition Timeline Board Controller
 * Core: features/review-board/timeline-board.js
 */

export class TimelineBoardController {
  constructor(app) {
    this.app = app;
  }

  renderBoard() {
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);
    const container = document.getElementById('review-due-cards-list');
    if (!container) return;

    const all = deck.entities || [];
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const dueCards = all.filter(e => {
      const c = ds.cards[e.id];
      return c && c.nextReviewAt && c.nextReviewAt <= endOfToday;
    });

    const masteredCards = all.filter(e => {
      const c = ds.cards[e.id];
      return c && c.level >= 4;
    });

    const coolingCards = all.filter(e => {
      const c = ds.cards[e.id];
      return c && c.nextReviewAt && c.nextReviewAt > endOfToday;
    });

    // 更新各标签统计数字
    const badgeDue = document.getElementById('stat-due-count');
    const badgeMastered = document.getElementById('stat-mastered-count');
    const badgeCooling = document.getElementById('stat-cooling-count');
    if (badgeDue) badgeDue.innerText = dueCards.length;
    if (badgeMastered) badgeMastered.innerText = masteredCards.length;
    if (badgeCooling) badgeCooling.innerText = coolingCards.length;

    let targetCards = dueCards;
    if (this.app.reviewViewTab === 'mastered') targetCards = masteredCards;
    else if (this.app.reviewViewTab === 'cooling') targetCards = coolingCards;

    if (targetCards.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 font-mono text-xs">
          当前分类下无词条
        </div>
      `;
      return;
    }

    let html = '';
    targetCards.forEach(e => {
      const c = ds.cards[e.id] || { level: 0, attempts: 0, correct: 0, wrong: 0 };
      const cat = deck.categories.find(cat => cat.id === e.categoryId);
      html += `
        <div class="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-white text-sm">${e.title}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">${cat ? cat.name : ''}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 font-mono">Lv.${c.level}</span>
            </div>
            <div class="text-slate-400 font-mono text-[11px] mt-0.5">答案: ${e.answer}</div>
          </div>
          <button onclick="app.drillSingleEntity('${e.id}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition font-medium text-xs">
            复习 &rarr;
          </button>
        </div>
      `;
    });
    container.innerHTML = html;
  }
}
