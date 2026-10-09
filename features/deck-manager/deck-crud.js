/**
 * Deck Lifecycle CRUD Controller (Presets vs Custom, Delete Confirmation)
 * Core: features/deck-manager/deck-crud.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';

export class DeckCrudController {
  constructor(app) {
    this.app = app;
    this.pendingDeleteDeckId = null;
  }

  renderList() {
    const container = document.getElementById('deck-manager-list-container');
    const badge = document.getElementById('deck-manager-total-badge');
    if (!container) return;

    const allDecks = this.app.getAllDecks();
    const activeDeck = this.app.getActiveDeck();
    if (badge) badge.innerText = `共 ${allDecks.length} 个题库`;

    let html = '';
    allDecks.forEach(deck => {
      const isBuiltin = (deck.id === 'deck_verbs' || deck.id === 'deck_http' || deck.id === 'deck_python');
      const isActive = (deck.id === activeDeck.id);
      const ds = this.app.getDeckState(deck.id);
      const health = validateDeckHealth(deck);

      let practiced = 0;
      Object.values(ds.cards).forEach(c => { if (c.attempts > 0) practiced++; });
      const pct = deck.entities.length > 0 ? Math.round((practiced / deck.entities.length) * 100) : 0;
      const acc = ds.totalAttempts > 0 ? Math.round((ds.totalCorrect / ds.totalAttempts) * 100) : 0;

      let healthBadge = '';
      if (!health.valid) {
        healthBadge = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">异常</span>`;
      } else if (health.warnings.length > 0) {
        healthBadge = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">需补充</span>`;
      } else {
        healthBadge = `<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">健壮</span>`;
      }

      html += `
        <div class="p-4 rounded-xl border ${isActive ? 'bg-indigo-950/20 border-indigo-500/60 shadow-lg shadow-indigo-950/50' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xl">${deck.icon}</span>
              <h4 class="text-sm font-bold text-white tracking-wide truncate">${deck.title}</h4>
              ${isBuiltin ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">系统预设</span>` : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 font-mono">用户自定义</span>`}
              ${isActive ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold font-mono">当前激活</span>` : ''}
              ${healthBadge}
            </div>
            <p class="text-xs text-slate-400">${deck.description || '无简要说明'}</p>
            <div class="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap pt-1">
              <span>分类: <b class="text-slate-200">${deck.categories.length}</b></span>
              <span>•</span>
              <span>词条: <b class="text-slate-200">${deck.entities.length}</b></span>
              <span>•</span>
              <span>覆盖: <b class="${pct >= 80 ? 'text-emerald-400' : 'text-slate-200'}">${pct}%</b> (${practiced}/${deck.entities.length})</span>
              <span>•</span>
              <span>答题: <b class="text-slate-200">${ds.totalAttempts}</b>次 (准确率: <b class="${acc >= 80 ? 'text-emerald-400' : 'text-amber-400'}">${acc}%</b>)</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            ${!isActive ? `
              <button onclick="app.switchDeck('${deck.id}'); app.renderDeckManagerList();" class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition">
                设为激活
              </button>
            ` : ''}
            <button onclick="app.closeDeckManagerModal(); app.showDeckStudioModal('${deck.id}')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1" title="在 Studio 中编辑或另存">
              <span>编辑</span>
            </button>
            ${isBuiltin ? `
              <button disabled class="px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-600 border border-slate-800 text-xs cursor-not-allowed flex items-center justify-center" title="系统内置预设受保护，不可删除">
                <svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </button>
            ` : `
              <button onclick="app.promptDeleteDeck('${deck.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-900/50 text-xs font-medium transition flex items-center justify-center" title="删除自定义题库">
                <svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            `}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  promptDelete(deckId) {
    const isBuiltin = (deckId === 'deck_verbs' || deckId === 'deck_http' || deckId === 'deck_python');
    if (isBuiltin) {
      alert('🔒 系统内置预设题库受系统保护，不可删除！');
      return;
    }

    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) {
      alert('❌ 未找到该题库！');
      return;
    }

    this.pendingDeleteDeckId = deckId;
    const ds = this.app.getDeckState(deckId);
    const impactBox = document.getElementById('deck-delete-impact-info');
    if (impactBox) {
      impactBox.innerHTML = `
        <div>• 题库名称：<b class="text-white">${deck.icon} ${deck.title}</b></div>
        <div>• 包含数据：<span class="text-indigo-300">${deck.categories.length} 个分类板块</span> · <span class="text-indigo-300">${deck.entities.length} 个概念词条</span></div>
        <div>• 刷题记录：已累计答题 <span class="text-amber-400">${ds.totalAttempts} 次</span> (将被同步清空)</div>
      `;
    }

    document.getElementById('modal-deck-delete-confirm').classList.remove('hidden');
  }

  executeDelete() {
    if (!this.pendingDeleteDeckId) return;
    const deckId = this.pendingDeleteDeckId;

    this.app.state.customDecks = (this.app.state.customDecks || []).filter(d => d.id !== deckId);
    if (this.app.state.deckStates && this.app.state.deckStates[deckId]) {
      delete this.app.state.deckStates[deckId];
    }

    if (this.app.state.activeDeckId === deckId) {
      this.app.state.activeDeckId = 'deck_verbs';
    }

    this.app.saveUserData();
    this.pendingDeleteDeckId = null;
    document.getElementById('modal-deck-delete-confirm').classList.add('hidden');
    this.renderList();
    this.app.renderAllViews();
  }
}
