/**
 * Deck Lifecycle CRUD Controller (Presets vs Custom, Versioning & Recycle Bin)
 * Core: features/deck-manager/deck-crud.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';

export class DeckCrudController {
  constructor(app) {
    this.app = app;
    this.pendingDeleteDeckId = null;
    this.activeTab = 'active'; // 'active' | 'recycle'
    this.inspectingVersionDeckId = null;
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.renderList();
  }

  renderList() {
    const container = document.getElementById('deck-manager-list-container');
    const badge = document.getElementById('deck-manager-total-badge');
    if (!container) return;

    const allDecks = this.app.getAllDecks();
    const activeDeck = this.app.getActiveDeck();
    const recycleItems = this.app.deckVersioning ? this.app.deckVersioning.recycleBin : [];
    if (badge) badge.innerText = `共 ${allDecks.length} 个活跃题库 · 回收站 ${recycleItems.length}`;

    // 顶部活跃与回收站标签栏
    let html = `
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
        <div class="flex items-center gap-2">
          <button onclick="app.deckCrud.switchTab('active')" class="px-3 py-1 rounded-lg font-medium transition ${this.activeTab === 'active' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}">
            活跃题库 (${allDecks.length})
          </button>
          <button onclick="app.deckCrud.switchTab('recycle')" class="px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${this.activeTab === 'recycle' ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-800/60' : 'text-slate-400 hover:text-slate-200'}">
            <span>回收站 (${recycleItems.length})</span>
          </button>
        </div>
      </div>
    `;

    if (this.activeTab === 'recycle') {
      html += this.renderRecycleBinList(recycleItems);
      container.innerHTML = html;
      return;
    }

    if (this.inspectingVersionDeckId) {
      html += this.renderVersionDrawer(this.inspectingVersionDeckId);
      container.innerHTML = html;
      return;
    }

    allDecks.forEach(deck => {
      const isBuiltin = ['deck_verbs', 'deck_http', 'deck_python'].includes(deck.id);
      const isActive = (deck.id === activeDeck.id);
      const ds = this.app.getDeckState(deck.id);
      const health = validateDeckHealth(deck);
      const versionCount = this.app.deckVersioning ? this.app.deckVersioning.getVersions(deck.id).length : 0;

      let practiced = 0;
      Object.values(ds.cards || {}).forEach(c => { if (c.attempts > 0) practiced++; });
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
        <div class="p-4 rounded-xl border mb-3 ${isActive ? 'bg-indigo-950/20 border-indigo-500/60 shadow-lg shadow-indigo-950/50' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xl">${deck.icon}</span>
              <h4 class="text-sm font-bold text-white tracking-wide truncate">${deck.title}</h4>
              ${isBuiltin ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">系统预设</span>` : `<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50 font-mono">用户自定义</span>`}
              ${isActive ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold font-mono">当前激活</span>` : ''}
              ${healthBadge}
              ${!isBuiltin && versionCount > 0 ? `<span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700 font-mono">${versionCount}个快照</span>` : ''}
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
              <button onclick="app.switchDeck('${deck.id}'); app.renderDeckManagerList();" class="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-medium transition">
                激活
              </button>
            ` : ''}
            <button onclick="app.closeDeckManagerModal(); app.showDeckStudioModal('${deck.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition" title="在 Studio 中编辑">
              <span>编辑</span>
            </button>
            ${!isBuiltin ? `
              <button onclick="app.deckCrud.inspectVersions('${deck.id}')" class="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-medium transition" title="查看历史版本快照">
                <span>版本</span>
              </button>
              <button onclick="app.promptDeleteDeck('${deck.id}')" class="px-2 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-900/50 text-xs font-medium transition" title="安全移入回收站">
                <svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  inspectVersions(deckId) {
    this.inspectingVersionDeckId = deckId;
    this.renderList();
  }

  renderVersionDrawer(deckId) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) { this.inspectingVersionDeckId = null; return ''; }
    const versions = this.app.deckVersioning ? this.app.deckVersioning.getVersions(deckId) : [];

    let vHtml = `
      <div class="space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <button onclick="app.deckCrud.inspectVersions(null)" class="text-xs text-indigo-400 hover:underline">← 返回题库列表</button>
            <span class="text-slate-600">|</span>
            <span class="text-xs font-bold text-white">《${deck.title}》版本快照 (${versions.length}/10)</span>
          </div>
          <button onclick="app.deckCrud.createManualSnapshot('${deckId}')" class="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition">
            + 打桩快照
          </button>
        </div>
    `;

    if (versions.length === 0) {
      vHtml += `<div class="p-8 text-center text-xs text-slate-500 surface-card rounded-xl">当前题库暂无历史快照，可在修改前后随时打桩。</div>`;
    } else {
      versions.forEach((v, idx) => {
        vHtml += `
          <div class="p-3 rounded-xl surface-card border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-white truncate">${v.versionName}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-mono ${v.author === 'agent' ? 'bg-indigo-950 text-indigo-300' : 'bg-slate-800 text-slate-300'}">
                  ${v.author === 'agent' ? 'AI' : '用户'}
                </span>
                ${idx === 0 ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 font-mono">最新</span>' : ''}
              </div>
              <p class="text-slate-400 text-[11px] truncate">${v.changeSummary}</p>
              <div class="text-[10px] text-slate-500 font-mono">
                ${new Date(v.timestamp).toLocaleString()} · 包含 ${v.stats.entitiesCount} 题 · 导学: ${v.stats.hasGuide ? '有' : '无'}
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="app.deckCrud.rollback('${deckId}', '${v.versionId}')" class="px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition">
                回滚
              </button>
              <button onclick="app.deckCrud.removeVersion('${deckId}', '${v.versionId}')" class="p-1 text-slate-500 hover:text-rose-400 transition" title="删除快照">
                ✕
              </button>
            </div>
          </div>
        `;
      });
    }
    vHtml += `</div>`;
    return vHtml;
  }

  createManualSnapshot(deckId) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) return;
    const note = prompt('请输入快照备注说明（如：重构分类前备份）：', '手动快照');
    if (note && this.app.deckVersioning) {
      this.app.deckVersioning.createSnapshot(deck, { trigger: 'user_manual', author: 'user', note });
      this.renderList();
    }
  }

  rollback(deckId, versionId) {
    if (confirm('确认将当前题库回滚至此版本？回滚前会自动对当前状态进行快照留底。')) {
      try {
        this.app.deckVersioning.rollbackToVersion(deckId, versionId);
        alert('✅ 题库已成功恢复至历史版本！');
        this.renderList();
      } catch (e) {
        alert('回滚失败: ' + e.message);
      }
    }
  }

  removeVersion(deckId, versionId) {
    if (this.app.deckVersioning) {
      this.app.deckVersioning.deleteVersion(deckId, versionId);
      this.renderList();
    }
  }

  renderRecycleBinList(items) {
    if (items.length === 0) {
      return `<div class="p-12 text-center text-xs text-slate-500 surface-card rounded-xl">回收站为空，没有任何已删除题库。</div>`;
    }
    return items.map(item => `
      <div class="p-4 rounded-xl border border-rose-950/60 bg-rose-950/10 mb-3 flex items-center justify-between gap-3 transition">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xl">${item.icon || '📚'}</span>
            <h4 class="text-sm font-bold text-white">${item.deckTitle}</h4>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-rose-900/40 text-rose-300 border border-rose-800 font-mono">已软删除</span>
          </div>
          <p class="text-xs text-slate-400">删除时间: ${new Date(item.deletedAt).toLocaleString()} · 包含 ${item.entitiesCount} 个考点</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="app.deckCrud.restore('${item.deckId}')" class="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-medium transition">
            恢复题库
          </button>
          <button onclick="app.deckCrud.permanentDelete('${item.deckId}')" class="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-medium border border-rose-800 transition">
            彻底销毁
          </button>
        </div>
      </div>
    `).join('');
  }

  restore(deckId) {
    if (this.app.deckVersioning) {
      this.app.deckVersioning.restoreFromRecycleBin(deckId);
      this.renderList();
    }
  }

  permanentDelete(deckId) {
    if (confirm('⚠️ 警告：彻底粉碎后将无法恢复，确认彻底删除？') && this.app.deckVersioning) {
      this.app.deckVersioning.permanentDeleteFromRecycleBin(deckId);
      this.renderList();
    }
  }

  promptDelete(deckId) {
    if (['deck_verbs', 'deck_http', 'deck_python'].includes(deckId)) {
      alert('🔒 系统内置预设题库受系统保护，不可删除！');
      return;
    }
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) { alert('❌ 未找到该题库！'); return; }

    this.pendingDeleteDeckId = deckId;
    const impactBox = document.getElementById('deck-delete-impact-info');
    if (impactBox) {
      impactBox.innerHTML = `
        <div>• 题库名称：<b class="text-white">${deck.icon} ${deck.title}</b></div>
        <div>• 包含数据：<span class="text-indigo-300">${deck.categories.length} 个分类</span> · <span class="text-indigo-300">${deck.entities.length} 个考点</span></div>
        <div class="text-emerald-400 font-medium pt-1">🛡️ 安全保护：删除后将暂存至回收站，可随时一键恢复出库！</div>
      `;
    }
    const modal = document.getElementById('modal-deck-delete-confirm');
    if (modal) modal.classList.remove('hidden');
  }

  executeDelete() {
    if (!this.pendingDeleteDeckId) return;
    const deckId = this.pendingDeleteDeckId;
    if (this.app.deckVersioning) {
      this.app.deckVersioning.softDeleteDeck(deckId);
    }
    this.pendingDeleteDeckId = null;
    const modal = document.getElementById('modal-deck-delete-confirm');
    if (modal) modal.classList.add('hidden');
    this.renderList();
  }
}
