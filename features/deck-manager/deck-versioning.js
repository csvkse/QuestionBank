/**
 * Deck Versioning & Recycle Bin Engine (SPEC 33)
 * Core: features/deck-manager/deck-versioning.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';

export const MAX_VERSIONS_PER_DECK = 10;
export const MAX_RECYCLE_BIN_ITEMS = 20;

export class DeckVersionController {
  constructor(app) {
    this.app = app;
    this.storage = app?.storage;
    this.versionsMap = this.storage?.loadDeckVersions ? this.storage.loadDeckVersions() : {};
    this.recycleBin = this.storage?.loadRecycleBin ? this.storage.loadRecycleBin() : [];
  }

  createSnapshot(deck, { trigger = 'user_manual', author = 'user', note = '', changeSummary = '' } = {}) {
    if (!deck || !deck.id) return null;
    if (['deck_verbs', 'deck_http', 'deck_python'].includes(deck.id)) return null;

    const versionId = 'ver_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const snapshot = {
      versionId,
      deckId: deck.id,
      versionName: note || `快照 ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      trigger,
      author,
      changeSummary: changeSummary || (author === 'agent' ? 'AI 智能体操作打桩' : '用户操作检查点'),
      stats: {
        entitiesCount: (deck.entities || []).length,
        categoriesCount: (deck.categories || []).length,
        hasGuide: Boolean(deck.guide && (deck.guide.summary || deck.guide.markdown))
      },
      snapshotDeck: JSON.parse(JSON.stringify(deck))
    };

    if (!this.versionsMap[deck.id]) this.versionsMap[deck.id] = [];
    this.versionsMap[deck.id].unshift(snapshot);
    if (this.versionsMap[deck.id].length > MAX_VERSIONS_PER_DECK) {
      this.versionsMap[deck.id] = this.versionsMap[deck.id].slice(0, MAX_VERSIONS_PER_DECK);
    }
    if (this.storage?.saveDeckVersions) this.storage.saveDeckVersions(this.versionsMap);
    return snapshot;
  }

  getVersions(deckId) {
    return (this.versionsMap[deckId] || []).map(v => ({
      versionId: v.versionId, deckId: v.deckId, versionName: v.versionName,
      timestamp: v.timestamp, trigger: v.trigger, author: v.author,
      changeSummary: v.changeSummary, stats: v.stats
    }));
  }

  getSnapshot(deckId, versionId) {
    return (this.versionsMap[deckId] || []).find(v => v.versionId === versionId) || null;
  }

  rollbackToVersion(deckId, versionId) {
    const snapshot = this.getSnapshot(deckId, versionId);
    if (!snapshot) throw new Error(`未找到版本快照 "${versionId}"`);

    const customDecks = this.app.state.customDecks || [];
    const deckIdx = customDecks.findIndex(d => d.id === deckId);
    if (deckIdx === -1) throw new Error(`当前自定义题库中未找到 "${deckId}"`);

    this.createSnapshot(customDecks[deckIdx], {
      trigger: 'pre_rollback', author: 'user',
      note: `回滚前快照 (恢复至 ${snapshot.versionName})`,
      changeSummary: `在执行回滚至 ${versionId} 之前自动备份`
    });

    const restored = JSON.parse(JSON.stringify(snapshot.snapshotDeck));
    customDecks[deckIdx] = restored;

    if (this.app.state.deckStates && this.app.state.deckStates[deckId]) {
      const validEntityIds = new Set(restored.entities.map(e => e.id));
      const ds = this.app.state.deckStates[deckId];
      if (ds.cards) {
        Object.keys(ds.cards).forEach(cid => {
          if (!validEntityIds.has(cid)) delete ds.cards[cid];
        });
      }
    }

    this.app.saveUserData();
    this.app.renderAllViews();
    return {
      success: true, deckId, restoredVersionId: versionId,
      versionName: snapshot.versionName, entitiesCount: restored.entities.length
    };
  }

  deleteVersion(deckId, versionId) {
    if (!this.versionsMap[deckId]) return false;
    const initialLen = this.versionsMap[deckId].length;
    this.versionsMap[deckId] = this.versionsMap[deckId].filter(v => v.versionId !== versionId);
    if (this.storage?.saveDeckVersions) this.storage.saveDeckVersions(this.versionsMap);
    return this.versionsMap[deckId].length < initialLen;
  }

  softDeleteDeck(deckId) {
    if (['deck_verbs', 'deck_http', 'deck_python'].includes(deckId)) throw new Error('系统预设题库受保护，不可删除！');
    const customDecks = this.app.state.customDecks || [];
    const idx = customDecks.findIndex(d => d.id === deckId);
    if (idx === -1) throw new Error(`未找到自定义题库 "${deckId}"`);

    const targetDeck = customDecks[idx];
    this.recycleBin.unshift({
      deckId: targetDeck.id, deckTitle: targetDeck.title, icon: targetDeck.icon,
      deletedAt: Date.now(), entitiesCount: targetDeck.entities.length,
      snapshotDeck: JSON.parse(JSON.stringify(targetDeck))
    });
    if (this.recycleBin.length > MAX_RECYCLE_BIN_ITEMS) this.recycleBin = this.recycleBin.slice(0, MAX_RECYCLE_BIN_ITEMS);
    if (this.storage?.saveRecycleBin) this.storage.saveRecycleBin(this.recycleBin);

    customDecks.splice(idx, 1);
    if (this.app.state.activeDeckId === deckId) {
      this.app.state.activeDeckId = 'deck_verbs';
      if (this.storage?.saveActiveDeckId) this.storage.saveActiveDeckId('deck_verbs');
    }
    this.app.saveUserData();
    this.app.renderAllViews();
    return { success: true, deckId, title: targetDeck.title };
  }

  restoreFromRecycleBin(deckId) {
    const idx = this.recycleBin.findIndex(t => t.deckId === deckId);
    if (idx === -1) throw new Error(`回收站中未找到题库 "${deckId}"`);

    const item = this.recycleBin[idx];
    this.app.state.customDecks = this.app.state.customDecks || [];
    this.app.state.customDecks.push(item.snapshotDeck);

    this.recycleBin.splice(idx, 1);
    if (this.storage?.saveRecycleBin) this.storage.saveRecycleBin(this.recycleBin);
    this.app.saveUserData();
    this.app.renderAllViews();
    return { success: true, deckId, title: item.deckTitle };
  }

  permanentDeleteFromRecycleBin(deckId) {
    const idx = this.recycleBin.findIndex(t => t.deckId === deckId);
    if (idx === -1) return false;
    this.recycleBin.splice(idx, 1);
    if (this.storage?.saveRecycleBin) this.storage.saveRecycleBin(this.recycleBin);
    return true;
  }

  batchUpdateEntities(deckId, updates, { mode = 'atomic_strict', author = 'agent' } = {}) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) throw new Error(`未找到自定义题库 "${deckId}"`);
    if (!Array.isArray(updates) || updates.length === 0) throw new Error('updates 必须是非空数组');

    const entityMap = new Map((deck.entities || []).map(e => [e.id, e]));
    if (mode === 'atomic_strict') {
      const missing = updates.find(u => !entityMap.has(u.id));
      if (missing) throw new Error(`考点 ID "${missing.id}" 在题库中不存在，已终止批量更新`);
    }

    this.createSnapshot(deck, {
      trigger: 'ai_batch', author,
      note: `[AI] 批量修改前快照 (${updates.length}题)`,
      changeSummary: `批量更新 ${updates.length} 个考点属性`
    });

    let updatedCount = 0;
    updates.forEach(u => {
      const ent = entityMap.get(u.id);
      if (ent) {
        ['prompt', 'answer', 'explanation', 'pitfalls', 'title', 'categoryId'].forEach(f => {
          if (u[f] !== undefined) ent[f] = String(u[f]);
        });
        if (u.layer !== undefined && [1, 2, 3].includes(Number(u.layer))) ent.layer = Number(u.layer);
        updatedCount++;
      }
    });

    const health = validateDeckHealth(deck);
    this.app.saveUserData();
    this.app.renderAllViews();
    return { success: true, deckId, title: deck.title, updatedCount, warnings: health.warnings };
  }

  batchDeleteEntities(deckId, entityIds, { author = 'agent' } = {}) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) throw new Error(`未找到自定义题库 "${deckId}"`);
    if (!Array.isArray(entityIds) || entityIds.length === 0) throw new Error('entityIds 必须是非空数组');

    this.createSnapshot(deck, {
      trigger: 'ai_batch', author,
      note: `[AI] 批量删除前快照 (${entityIds.length}题)`,
      changeSummary: `批量删除 ${entityIds.length} 个考点`
    });

    const toDeleteSet = new Set(entityIds);
    const beforeCount = deck.entities.length;
    deck.entities = deck.entities.filter(e => !toDeleteSet.has(e.id));
    const deletedCount = beforeCount - deck.entities.length;

    const health = validateDeckHealth(deck);
    this.app.saveUserData();
    this.app.renderAllViews();
    return {
      success: true, deckId, deletedCount,
      remainingCount: deck.entities.length, warnings: health.warnings
    };
  }

  patchDeckGuide(deckId, { operation = 'append_section', heading = '', content = '', summary = '' } = {}) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) throw new Error(`未找到自定义题库 "${deckId}"`);

    this.createSnapshot(deck, {
      trigger: 'guide_update', author: 'agent',
      note: `导学增量修改前快照`, changeSummary: `执行 ${operation} 操作`
    });

    deck.guide = deck.guide || { summary: '', markdown: '' };
    if (operation === 'update_summary') {
      deck.guide.summary = String(summary || '').trim();
    } else if (operation === 'append_section') {
      const sectionText = `\n\n### ${heading}\n${content}`.trim();
      deck.guide.markdown = (deck.guide.markdown ? deck.guide.markdown + '\n\n' : '') + sectionText;
    } else if (operation === 'replace_section') {
      const escapedHead = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`###\\s+${escapedHead}[\\s\\S]*?(?=\\n###|$)`);
      if (regex.test(deck.guide.markdown)) {
        deck.guide.markdown = deck.guide.markdown.replace(regex, `### ${heading}\n${content}`);
      } else {
        deck.guide.markdown += `\n\n### ${heading}\n${content}`;
      }
    }

    this.app.saveUserData();
    this.app.renderAllViews();
    return { success: true, deckId, title: deck.title, guide: deck.guide };
  }

  deleteDeckGuide(deckId) {
    const deck = (this.app.state.customDecks || []).find(d => d.id === deckId);
    if (!deck) throw new Error(`未找到自定义题库 "${deckId}"`);

    this.createSnapshot(deck, {
      trigger: 'guide_update', author: 'agent',
      note: `清空导学前快照`, changeSummary: `清空重置体系化导学页`
    });

    deck.guide = null;
    this.app.saveUserData();
    this.app.renderAllViews();
    return { success: true, deckId, guide: null };
  }
}
