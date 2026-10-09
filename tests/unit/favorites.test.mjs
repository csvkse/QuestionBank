/**
 * Unit Test: Question Favorites & Targeted Practice Dispatcher
 * tests/unit/favorites.test.mjs
 */

import assert from 'assert';
import { FavoritesManagerController } from '../../features/deck-manager/favorites-manager.js';

console.log('🧪 Testing favorites-manager.js (bookmarking & targeted practice)...');

// Mock Deck & State
const mockDeck = {
  id: 'deck_http',
  title: 'HTTP 协议核心体系',
  categories: [
    { id: 'cat_codes', name: '状态码体系', group: '协议报文' },
    { id: 'cat_headers', name: '首部字段', group: '协议报文' }
  ],
  entities: [
    { id: 'e_401', categoryId: 'cat_codes', layer: 1, title: '401 Unauthorized', answer: '未认证' },
    { id: 'e_403', categoryId: 'cat_codes', layer: 1, title: '403 Forbidden', answer: '已认证但无权限' },
    { id: 'e_500', categoryId: 'cat_codes', layer: 2, title: '500 Internal Error', answer: '服务器内部错误' },
    { id: 'e_auth', categoryId: 'cat_headers', layer: 2, title: 'Authorization', answer: '认证凭据' }
  ]
};

const mockDeckState = {
  totalAttempts: 10,
  totalCorrect: 9,
  streak: 3,
  cards: {
    e_401: { level: 2, attempts: 3, wrong: 1 },
    e_403: { level: 4, attempts: 5, wrong: 0 }
  },
  favorites: []
};

let savedDataCount = 0;
let lastSessionLaunched = null;

const mockApp = {
  getActiveDeck: () => mockDeck,
  getDeckState: (id) => {
    if (id === mockDeck.id) return mockDeckState;
    return { cards: {}, favorites: [] };
  },
  saveUserData: () => { savedDataCount++; },
  updateFavoritesBadge: () => {},
  startSession: (mode, queue, meta) => {
    lastSessionLaunched = { mode, queue, meta };
  }
};

const favMgr = new FavoritesManagerController(mockApp);

// 1. 基础状态验证
assert.strictEqual(favMgr.isFavorite('e_401'), false, 'Initially e_401 should not be favorited');
assert.deepStrictEqual(favMgr.getFavoritesArray(), [], 'Favorites array should initially be empty');
assert.strictEqual(favMgr.getFavoritesList().length, 0, 'Favorites list should be empty');

// 2. 收藏与取消收藏切换 (Toggle)
const addResult = favMgr.toggleFavorite('e_401');
assert.strictEqual(addResult, true, 'Toggling unstarred item should return true');
assert.strictEqual(favMgr.isFavorite('e_401'), true, 'e_401 should now be favorited');
assert.deepStrictEqual(favMgr.getFavoritesArray(), ['e_401'], 'e_401 should be in favorites array');
assert.strictEqual(favMgr.getFavoritesList().length, 1, 'Favorites list should have 1 item');
assert.strictEqual(favMgr.getFavoritesList()[0].id, 'e_401', 'Favorited item should match e_401');

// 再次收藏另一个考点
favMgr.toggleFavorite('e_500');
assert.strictEqual(favMgr.isFavorite('e_500'), true, 'e_500 should be favorited');
assert.strictEqual(favMgr.getFavoritesList().length, 2, 'Favorites list should have 2 items');

// 再次 toggle e_401 应当取消收藏
const removeResult = favMgr.toggleFavorite('e_401');
assert.strictEqual(removeResult, false, 'Toggling already favorited item should return false');
assert.strictEqual(favMgr.isFavorite('e_401'), false, 'e_401 should no longer be favorited');
assert.deepStrictEqual(favMgr.getFavoritesArray(), ['e_500'], 'Only e_500 should remain in favorites array');

// 恢复 e_401 与添加 e_auth
favMgr.toggleFavorite('e_401');
favMgr.toggleFavorite('e_auth');
assert.strictEqual(favMgr.getFavoritesList().length, 3, 'Should have 3 favorites: e_500, e_401, e_auth');

// 3. 多选与全选状态管理
favMgr.toggleSelectAll(true);
assert.strictEqual(favMgr.selectedIds.size, 3, 'toggleSelectAll(true) should select all 3 favorites');
assert.strictEqual(favMgr.selectedIds.has('e_401'), true, 'e_401 should be selected');
assert.strictEqual(favMgr.selectedIds.has('e_500'), true, 'e_500 should be selected');
assert.strictEqual(favMgr.selectedIds.has('e_auth'), true, 'e_auth should be selected');

favMgr.toggleSelectItem('e_500', false);
assert.strictEqual(favMgr.selectedIds.size, 2, 'Unselecting e_500 should leave 2 selected items');
assert.strictEqual(favMgr.selectedIds.has('e_500'), false, 'e_500 should not be selected');

favMgr.toggleSelectAll(false);
assert.strictEqual(favMgr.selectedIds.size, 0, 'toggleSelectAll(false) should clear all selections');

// 4. 单题针对性练习调度 (practiceSingle)
lastSessionLaunched = null;
favMgr.practiceSingle('e_401');
assert.notStrictEqual(lastSessionLaunched, null, 'practiceSingle should trigger startSession');
assert.strictEqual(lastSessionLaunched.mode, 'CATEGORY_DRILL', 'Practice mode should be CATEGORY_DRILL');
assert.strictEqual(lastSessionLaunched.queue.length, 1, 'Queue should contain exactly 1 question');
assert.strictEqual(lastSessionLaunched.queue[0].id, 'e_401', 'Target question should be e_401');
assert.strictEqual(lastSessionLaunched.meta.origin, 'favorite_single', 'Meta origin should be favorite_single');

// 5. 批量勾选练习调度 (practiceBatch)
lastSessionLaunched = null;
favMgr.toggleSelectItem('e_401', true);
favMgr.toggleSelectItem('e_auth', true);
favMgr.practiceBatch();
assert.notStrictEqual(lastSessionLaunched, null, 'practiceBatch should trigger startSession');
assert.strictEqual(lastSessionLaunched.queue.length, 2, 'Batch queue should contain 2 questions');
const queueIds = lastSessionLaunched.queue.map(q => q.id);
assert.strictEqual(queueIds.includes('e_401') && queueIds.includes('e_auth'), true, 'Batch should contain selected e_401 and e_auth');
assert.strictEqual(lastSessionLaunched.meta.origin, 'favorite_batch', 'Meta origin should be favorite_batch');

// 6. 全部收藏练习调度 (practiceAll)
lastSessionLaunched = null;
favMgr.practiceAll();
assert.notStrictEqual(lastSessionLaunched, null, 'practiceAll should trigger startSession');
assert.strictEqual(lastSessionLaunched.queue.length, 3, 'practiceAll queue should contain all 3 favorited questions');
assert.strictEqual(lastSessionLaunched.meta.origin, 'favorite_all', 'Meta origin should be favorite_all');

// 7. 批量取消收藏 (batchRemoveFavorites)
favMgr.selectedIds.clear();
favMgr.toggleSelectItem('e_401', true);
favMgr.toggleSelectItem('e_500', true);
favMgr.batchRemoveFavorites();
assert.strictEqual(favMgr.isFavorite('e_401'), false, 'e_401 should be removed after batch removal');
assert.strictEqual(favMgr.isFavorite('e_500'), false, 'e_500 should be removed after batch removal');
assert.strictEqual(favMgr.isFavorite('e_auth'), true, 'e_auth should remain favorited');
assert.strictEqual(favMgr.selectedIds.size, 0, 'Selection should be cleared after batch removal');

// 8. 边界容错测试
assert.strictEqual(favMgr.toggleFavorite(null), false, 'toggleFavorite(null) should return false');
assert.strictEqual(favMgr.isFavorite(''), false, 'isFavorite("") should return false');

console.log('✅ favorites.test.mjs PASSED!');
