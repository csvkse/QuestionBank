/**
 * Favorites / Starred Questions Manager Controller
 * Core: features/deck-manager/favorites-manager.js
 */

import { ModalController } from '../../design-system/components/modal.js';
import { renderIcon } from '../../design-system/icons/icons.js';

export class FavoritesManagerController {
  constructor(app) {
    this.app = app;
    this.selectedIds = new Set();
  }

  getFavoritesArray() {
    const deck = this.app.getActiveDeck();
    if (!deck) return [];
    const ds = this.app.getDeckState(deck.id);
    if (!Array.isArray(ds.favorites)) {
      ds.favorites = [];
    }
    return ds.favorites;
  }

  isFavorite(entityId) {
    if (!entityId) return false;
    const favs = this.getFavoritesArray();
    return favs.includes(entityId);
  }

  toggleFavorite(entityId) {
    if (!entityId) return false;
    const deck = this.app.getActiveDeck();
    if (!deck) return false;
    const ds = this.app.getDeckState(deck.id);
    if (!Array.isArray(ds.favorites)) {
      ds.favorites = [];
    }

    const idx = ds.favorites.indexOf(entityId);
    let isFav = false;
    if (idx >= 0) {
      ds.favorites.splice(idx, 1);
      this.selectedIds.delete(entityId);
      isFav = false;
    } else {
      ds.favorites.push(entityId);
      isFav = true;
    }

    this.app.saveUserData();
    this.updateVisibleStarButtons(entityId, isFav);
    if (typeof this.app.updateFavoritesBadge === 'function') {
      this.app.updateFavoritesBadge();
    }
    return isFav;
  }

  updateVisibleStarButtons(entityId, isFav) {
    if (typeof document === 'undefined') return;
    // 1. 竞技场题卡右上角收藏按钮
    const arenaStarBtn = document.getElementById('arena-btn-favorite');
    if (arenaStarBtn && this.app.quizQueue && this.app.quizQueue[this.app.currentIndex]?.id === entityId) {
      arenaStarBtn.innerHTML = renderIcon(isFav ? 'starFilled' : 'star', `w-4 h-4 ${isFav ? 'text-amber-400' : 'text-slate-400'}`);
      arenaStarBtn.title = isFav ? '已收藏 (快捷键 F 取消)' : '收藏本题 (快捷键 F)';
    }

    // 2. 知识精读 Focus Reader 收藏按钮
    const focusStarBtn = document.getElementById('focus-btn-favorite');
    if (focusStarBtn && this.app.focusReader?.activeEntityId === entityId) {
      focusStarBtn.innerHTML = renderIcon(isFav ? 'starFilled' : 'star', `w-4 h-4 ${isFav ? 'text-amber-400' : 'text-slate-400'}`);
      focusStarBtn.title = isFav ? '已收藏 (点击取消)' : '收藏本题 (点击收藏)';
    }

    // 3. 若收藏弹窗处于开启状态，局部重绘
    const modal = document.getElementById('modal-favorites');
    if (modal && !modal.classList.contains('hidden')) {
      this.renderModal();
    }
  }

  getFavoritesList() {
    const deck = this.app.getActiveDeck();
    if (!deck || !Array.isArray(deck.entities)) return [];
    const favs = new Set(this.getFavoritesArray());
    return deck.entities.filter(e => favs.has(e.id));
  }

  openModal() {
    this.selectedIds.clear();
    this.renderModal();
    if (typeof document !== 'undefined') ModalController.open('modal-favorites');
  }

  closeModal() {
    if (typeof document !== 'undefined') ModalController.close('modal-favorites');
  }

  toggleSelectAll(isChecked) {
    const list = this.getFavoritesList();
    if (isChecked) {
      list.forEach(e => this.selectedIds.add(e.id));
    } else {
      this.selectedIds.clear();
    }
    this.renderModal();
  }

  toggleSelectItem(entityId, isChecked) {
    if (isChecked) {
      this.selectedIds.add(entityId);
    } else {
      this.selectedIds.delete(entityId);
    }
    this.updateBulkActionBar();
  }

  updateBulkActionBar() {
    if (typeof document === 'undefined') return;
    const batchBtn = document.getElementById('fav-btn-batch-practice');
    const batchDeleteBtn = document.getElementById('fav-btn-batch-delete');
    const selectedCountEl = document.getElementById('fav-selected-count');
    const selectAllCb = document.getElementById('fav-select-all-checkbox');

    const totalFavs = this.getFavoritesList().length;
    const selectedCount = this.selectedIds.size;

    if (selectedCountEl) selectedCountEl.innerText = selectedCount;
    if (selectAllCb) selectAllCb.checked = (totalFavs > 0 && selectedCount === totalFavs);

    if (batchBtn) {
      batchBtn.disabled = selectedCount === 0;
      if (selectedCount > 0) {
        batchBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        batchBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }

    if (batchDeleteBtn) {
      batchDeleteBtn.disabled = selectedCount === 0;
      if (selectedCount > 0) {
        batchDeleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        batchDeleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }

  renderModal() {
    if (typeof document === 'undefined') return;
    const deck = this.getActiveDeckSafe();
    const list = this.getFavoritesList();
    const container = document.getElementById('fav-list-container');
    const totalCountEl = document.getElementById('fav-total-badge');
    const emptyStateEl = document.getElementById('fav-empty-state');
    const bulkBarEl = document.getElementById('fav-bulk-bar');

    if (totalCountEl) totalCountEl.innerText = `共 ${list.length} 道收藏题目`;

    if (list.length === 0) {
      if (container) container.innerHTML = '';
      if (emptyStateEl) emptyStateEl.classList.remove('hidden');
      if (bulkBarEl) bulkBarEl.classList.add('hidden');
      return;
    }

    if (emptyStateEl) emptyStateEl.classList.add('hidden');
    if (bulkBarEl) bulkBarEl.classList.remove('hidden');

    if (container) {
      const cards = this.app.getDeckState(deck.id).cards || {};
      container.innerHTML = list.map(item => {
        const isChecked = this.selectedIds.has(item.id);
        const card = cards[item.id] || { level: 0, attempts: 0 };
        const cat = (deck.categories || []).find(c => c.id === item.categoryId);
        const catName = cat ? cat.name : '核心概念';

        return `
          <div class="p-3 rounded-xl surface-inset border border-slate-750 flex items-center justify-between gap-3 hover:border-slate-700 transition">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="app.favoritesManager.toggleSelectItem('${item.id}', this.checked)" class="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 shrink-0">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-sm text-slate-100 truncate">${item.title}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">${catName}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono border border-indigo-800/40">Layer ${item.layer || 1}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded ${card.level >= 4 ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-850 text-slate-400'} font-mono">Lv.${card.level || 0}</span>
                </div>
                <p class="text-xs text-slate-400 truncate mt-0.5">${item.answer || item.subtitle || item.explanation || ''}</p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" onclick="app.favoritesManager.practiceSingle('${item.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1">
                ${renderIcon('target', 'w-3 h-3')} 练此题
              </button>
              <button type="button" onclick="app.favoritesManager.toggleFavorite('${item.id}')" title="取消收藏" class="p-1 rounded-lg text-amber-400 hover:text-slate-400 hover:bg-slate-800 transition">
                ${renderIcon('starFilled', 'w-4 h-4 text-amber-400')}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    this.updateBulkActionBar();
  }

  getActiveDeckSafe() {
    return this.app.getActiveDeck() || { id: '', categories: [], entities: [] };
  }

  practiceSingle(entityId) {
    const deck = this.getActiveDeckSafe();
    const entity = (deck.entities || []).find(e => e.id === entityId);
    if (!entity) return;
    this.closeModal();
    this.app.startSession('CATEGORY_DRILL', [entity], { origin: 'favorite_single' });
  }

  practiceBatch() {
    if (this.selectedIds.size === 0) return;
    const deck = this.getActiveDeckSafe();
    const entities = (deck.entities || []).filter(e => this.selectedIds.has(e.id));
    if (entities.length === 0) return;
    this.closeModal();
    this.app.startSession('CATEGORY_DRILL', entities, { origin: 'favorite_batch' });
  }

  practiceAll() {
    const list = this.getFavoritesList();
    if (list.length === 0) return;
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    this.closeModal();
    this.app.startSession('CATEGORY_DRILL', shuffled, { origin: 'favorite_all' });
  }

  batchRemoveFavorites() {
    if (this.selectedIds.size === 0) return;
    const deck = this.getActiveDeckSafe();
    const ds = this.app.getDeckState(deck.id);
    if (!Array.isArray(ds.favorites)) return;

    ds.favorites = ds.favorites.filter(id => !this.selectedIds.has(id));
    this.selectedIds.clear();
    this.app.saveUserData();
    this.renderModal();
    if (typeof this.app.updateFavoritesBadge === 'function') {
      this.app.updateFavoritesBadge();
    }
  }
}
