/**
 * AI Agent Knowledge Deck Tool Execution Engine (SPEC 13, 31, 32, 33)
 * Core 2.1: features/ai-agent/tool-executor.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';
import { parseMarkdownToDeck } from '../../shared/markdown-ast.js';
import { ToolFormatError, ToolReferenceError, ToolPermissionError, ToolExecutionError } from './tool-errors.js';

export class DeckToolExecutor {
  constructor(app) {
    this.app = app;
  }

  _saveAndRender() {
    this.app.saveUserData();
    this.app.renderAllViews();
  }

  _resolveDeck(queryId, queryTitle, customOnly = false) {
    const list = customOnly ? (this.app.state.customDecks || []) : this.app.getAllDecks();
    if (queryId) {
      const byId = list.find(d => d.id === queryId);
      if (byId) return byId;
      const byTitleAsId = list.find(d => d.title === queryId);
      if (byTitleAsId) return byTitleAsId;
    }
    if (queryTitle) {
      const byTitle = list.find(d => d.title === queryTitle || d.title.includes(queryTitle));
      if (byTitle) return byTitle;
    }
    return null;
  }

  async execute(toolName, args = {}) {
    switch (toolName) {
      case 'tool_list_decks': {
        return this.app.getAllDecks().map(d => {
          const ds = this.app.getDeckState(d.id);
          const health = validateDeckHealth(d);
          return {
            id: d.id, title: d.title, icon: d.icon, description: d.description,
            categoriesCount: d.categories.length, entitiesCount: d.entities.length,
            totalAttempts: ds.totalAttempts,
            healthStatus: health.valid ? (health.warnings.length > 0 ? '需补充' : '健壮') : '异常'
          };
        });
      }

      case 'tool_get_deck': {
        const target = this._resolveDeck(args?.deckId || args?.id, args?.title || args?.deckTitle, false);
        if (!target) throw new ToolReferenceError(`未找到题库 "${args?.deckId || args?.title || ''}"`, 'DECK_NOT_FOUND', '请核对准确的 deckId 或题库名称后再重试', { requested: args?.deckId || args?.title });
        return target;
      }

      case 'tool_create_deck': {
        if (!args?.title || !String(args.title).trim()) throw new ToolFormatError('缺少必填字段 title', 'MISSING_FIELD', '请在参数中提供 title 题库主标题');
        if (!Array.isArray(args.categories) || args.categories.length === 0) throw new ToolFormatError('categories 必须是非空数组', 'INVALID_FIELD', '请至少提供一个分类对象 [{ id, name, group }]');
        if (!Array.isArray(args.entities) || args.entities.length === 0) throw new ToolFormatError('entities 必须是非空数组', 'INVALID_FIELD', '请至少提供考点列表');

        const categoryIds = new Set(args.categories.map(c => c.id));
        const orphan = args.entities.find(e => !categoryIds.has(e.categoryId));
        if (orphan) throw new ToolReferenceError(`考点 "${orphan.title || orphan.id}" 引用的分类 "${orphan.categoryId}" 未声明`, 'ORPHAN_CATEGORY_REFERENCE', '请确保所有考点的 categoryId 均已在 categories 中声明');

        const newDeck = {
          id: 'deck_' + Date.now(),
          title: args.title.trim(),
          icon: args.icon || '📚',
          description: args.description || '',
          categories: args.categories,
          layers: args.layers || [{ level: 1, name: 'Layer 1: 基础认知' }, { level: 2, name: 'Layer 2: 规律运用' }, { level: 3, name: 'Layer 3: 陷阱特例' }],
          entities: args.entities,
          guide: args.guide ? { summary: String(args.guide.summary || '').trim(), markdown: String(args.guide.markdown || '').trim() } : undefined
        };

        const health = validateDeckHealth(newDeck);
        if (!health.valid) throw new ToolFormatError(`题库未通过健康度门禁: ${health.errors.join('; ')}`, 'HEALTH_GATE_FAILED', `请纠正格式违规: ${health.errors.join('; ')}`, { errors: health.errors, warnings: health.warnings });

        this.app.state.customDecks = this.app.state.customDecks || [];
        this.app.state.customDecks.push(newDeck);
        this._saveAndRender();
        return { success: true, deckId: newDeck.id, title: newDeck.title, entitiesCount: newDeck.entities.length, message: `题库《${newDeck.title}》已成功落库保存！` };
      }

      case 'tool_update_deck_meta': {
        if (!args?.deckId) throw new ToolFormatError('缺少必填参数 deckId', 'MISSING_FIELD', '必须指定要修改的 deckId');
        if (['deck_verbs', 'deck_http', 'deck_python'].includes(args.deckId)) throw new ToolPermissionError('系统内置题库元信息受保护不可修改', 'BUILTIN_PROTECTED', '系统预设题库为只读资源');
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能修改用户自定义题库');
        if (args.title) deck.title = args.title;
        if (args.icon) deck.icon = args.icon;
        if (args.description !== undefined) deck.description = args.description;
        this._saveAndRender();
        return { success: true, message: `题库元信息已更新` };
      }

      case 'tool_delete_deck': {
        if (!args?.deckId) throw new ToolFormatError('缺少必填参数 deckId', 'MISSING_FIELD', '必须指定要删除的 deckId');
        if (['deck_verbs', 'deck_http', 'deck_python'].includes(args.deckId)) throw new ToolPermissionError('系统预设题库禁止删除', 'BUILTIN_PROTECTED', '系统内置题库受保护禁止删除');
        try {
          if (this.app.deckVersioning) return this.app.deckVersioning.softDeleteDeck(args.deckId);
          this.app.state.customDecks = (this.app.state.customDecks || []).filter(d => d.id !== args.deckId);
          this._saveAndRender();
          return { success: true, message: `题库 ${args.deckId} 已删除` };
        } catch (e) {
          throw new ToolReferenceError(e.message, 'DECK_NOT_FOUND', '删除题库失败');
        }
      }

      case 'tool_add_entities': {
        if (!args?.deckId || !Array.isArray(args.entities) || args.entities.length === 0) throw new ToolFormatError('缺少 deckId 或 entities 数组', 'MISSING_FIELD', '必须传入 deckId 与实体数组');
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能向自定义题库追加实体');
        deck.entities = deck.entities || [];
        deck.entities.push(...args.entities);
        this._saveAndRender();
        return { success: true, addedCount: args.entities.length, total: deck.entities.length };
      }

      case 'tool_update_entity': {
        if (!args?.deckId || !args?.entityId) throw new ToolFormatError('缺少必填参数 deckId 或 entityId', 'MISSING_FIELD', '必须同时指定 deckId 与 entityId');
        let deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) {
          const target = this.app.getAllDecks().find(d => d.id === args.deckId);
          if (target) {
            deck = JSON.parse(JSON.stringify(target));
            this.app.state.customDecks = this.app.state.customDecks || [];
            this.app.state.customDecks.push(deck);
          } else {
            throw new ToolReferenceError(`未找到目标题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '请调用 tool_list_decks 确认题库 ID');
          }
        }
        const entity = (deck.entities || []).find(e => e.id === args.entityId);
        if (!entity) throw new ToolReferenceError(`考点词条 "${args.entityId}" 在题库 "${args.deckId}" 中不存在`, 'ENTITY_NOT_FOUND', '请核对考点 ID', { deckId: args.deckId, entityId: args.entityId });
        Object.assign(entity, args.updates || args.patch || {});
        this._saveAndRender();
        return { success: true, updatedEntity: entity };
      }

      case 'tool_delete_entity': {
        if (!args?.deckId || !args?.entityId) throw new ToolFormatError('缺少必填参数 deckId 或 entityId', 'MISSING_FIELD', '必须同时指定 deckId 与 entityId');
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能从自定义题库中删除实体');
        const entIdx = (deck.entities || []).findIndex(e => e.id === args.entityId);
        if (entIdx === -1) throw new ToolReferenceError(`考点词条 "${args.entityId}" 不存在`, 'ENTITY_NOT_FOUND', '请核对考点 ID');
        deck.entities.splice(entIdx, 1);
        this._saveAndRender();
        return { success: true, remainingCount: deck.entities.length };
      }

      case 'tool_search_entities': {
        if (!args || typeof args.query !== 'string') throw new ToolFormatError('缺少检索关键字 query', 'MISSING_FIELD', '请传入要检索的 query 字符串');
        const q = args.query.toLowerCase();
        const decks = args.deckId ? this.app.getAllDecks().filter(d => d.id === args.deckId) : this.app.getAllDecks();
        let matches = [];
        decks.forEach(d => {
          (d.entities || []).forEach(e => {
            if (e.title?.toLowerCase().includes(q) || (e.answer && e.answer.toLowerCase().includes(q)) || (e.explanation && e.explanation.toLowerCase().includes(q))) {
              matches.push({ deckTitle: d.title, ...e });
            }
          });
        });
        return matches.slice(0, 15);
      }

      case 'tool_import_markdown_deck': {
        if (!args?.markdownText || !args.markdownText.trim()) throw new ToolFormatError('缺少 markdownText 参数', 'MISSING_FIELD', '请传入符合 AST 语法的 Markdown 文本');
        try {
          const deck = parseMarkdownToDeck(args.markdownText);
          deck.id = 'deck_' + Date.now();
          this.app.state.customDecks = this.app.state.customDecks || [];
          this.app.state.customDecks.push(deck);
          this._saveAndRender();
          return { success: true, deckId: deck.id, title: deck.title, entitiesCount: deck.entities.length };
        } catch (err) {
          throw new ToolExecutionError(`Markdown 解析入库失败: ${err.message}`, 'MARKDOWN_PARSE_FAILED', '请核对 Markdown 格式');
        }
      }

      case 'tool_get_deck_guide': {
        const queryId = args?.deckId || args?.id;
        const queryTitle = args?.title || args?.deckTitle;
        if (!queryId && !queryTitle) throw new ToolFormatError('缺少必填参数 deckId 或 title', 'MISSING_FIELD', '必须传入具体的 deckId 或 title 字符串');
        const deck = this._resolveDeck(queryId, queryTitle, false);
        if (!deck) throw new ToolReferenceError(`未找到题库 "${queryId || queryTitle}"`, 'DECK_NOT_FOUND', '请核对 deckId 或题库名称是否正确');
        return { deckId: deck.id, title: deck.title, hasGuide: Boolean(deck.guide && (deck.guide.summary || deck.guide.markdown)), guide: deck.guide || null };
      }

      case 'tool_update_deck_guide': {
        const queryId = args?.deckId || args?.id;
        const queryTitle = args?.title || args?.deckTitle;
        if ((!queryId && !queryTitle) || !args?.guide || typeof args.guide !== 'object') throw new ToolFormatError('缺少 deckId/title 或 guide 对象', 'MISSING_FIELD', 'guide 必须包含 summary 和 markdown 字段');
        const target = this._resolveDeck(queryId, queryTitle, false);
        if (!target) throw new ToolReferenceError(`未找到题库 "${queryId || queryTitle}"`, 'DECK_NOT_FOUND', '请检查题库是否存在');
        if (['deck_verbs', 'deck_http', 'deck_python'].includes(target.id)) throw new ToolPermissionError(`预设题库 "${target.title}" 导学页受只读保护`, 'READONLY_PRESET_DECK', '内置题库导学页不支持在线覆盖');
        const deck = (this.app.state.customDecks || []).find(d => d.id === target.id);
        if (!deck) throw new ToolReferenceError(`未找到自定义题库 "${target.title}"`, 'DECK_NOT_FOUND', '只能修改用户自定义题库');
        deck.guide = { summary: String(args.guide.summary || '').trim(), markdown: String(args.guide.markdown || '').trim() };
        this._saveAndRender();
        return { success: true, deckId: deck.id, title: deck.title, guide: deck.guide };
      }

      case 'tool_delete_deck_guide': {
        const target = this._resolveDeck(args?.deckId || args?.id, args?.title || args?.deckTitle, true);
        const resolvedId = target ? target.id : (args?.deckId || args?.id);
        if (!resolvedId) throw new ToolFormatError('缺少 deckId 或 title', 'MISSING_FIELD', '必须指定 deckId 或 title');
        try {
          return this.app.deckVersioning.deleteDeckGuide(resolvedId);
        } catch (e) {
          throw new ToolReferenceError(e.message, 'DELETE_GUIDE_FAILED', '清空导学失败');
        }
      }

      case 'tool_patch_deck_guide': {
        const target = this._resolveDeck(args?.deckId || args?.id, args?.title || args?.deckTitle, true);
        const resolvedId = target ? target.id : (args?.deckId || args?.id);
        if (!resolvedId || !args?.operation) throw new ToolFormatError('缺少 deckId/title 或 operation', 'MISSING_FIELD', '必须指定 deckId/title 与 operation');
        try {
          return this.app.deckVersioning.patchDeckGuide(resolvedId, args);
        } catch (e) {
          throw new ToolReferenceError(e.message, 'PATCH_GUIDE_FAILED', '导学增量修改失败');
        }
      }

      case 'tool_batch_update_entities': {
        if (!args?.deckId || !Array.isArray(args.updates)) throw new ToolFormatError('缺少 deckId 或 updates 数组', 'MISSING_FIELD', '必须指定 deckId 与 updates 数组');
        try {
          return this.app.deckVersioning.batchUpdateEntities(args.deckId, args.updates, { mode: args.mode, author: 'agent' });
        } catch (e) {
          throw new ToolReferenceError(e.message, 'BATCH_UPDATE_FAILED', '批量更新考点失败');
        }
      }

      case 'tool_batch_delete_entities': {
        if (!args?.deckId || !Array.isArray(args.entityIds)) throw new ToolFormatError('缺少 deckId 或 entityIds 数组', 'MISSING_FIELD', '必须指定 deckId 与 entityIds 数组');
        try {
          return this.app.deckVersioning.batchDeleteEntities(args.deckId, args.entityIds, { author: 'agent' });
        } catch (e) {
          throw new ToolReferenceError(e.message, 'BATCH_DELETE_FAILED', '批量删除考点失败');
        }
      }

      case 'tool_list_deck_versions': {
        if (!args?.deckId) throw new ToolFormatError('缺少 deckId', 'MISSING_FIELD', '必须指定 deckId');
        return this.app.deckVersioning ? this.app.deckVersioning.getVersions(args.deckId) : [];
      }

      case 'tool_rollback_deck_version': {
        if (!args?.deckId || !args?.versionId) throw new ToolFormatError('缺少 deckId 或 versionId', 'MISSING_FIELD', '必须指定 deckId 与 versionId');
        try {
          return this.app.deckVersioning.rollbackToVersion(args.deckId, args.versionId);
        } catch (e) {
          throw new ToolReferenceError(e.message, 'ROLLBACK_FAILED', '版本回滚失败');
        }
      }

      case 'tool_create_deck_snapshot': {
        if (!args?.deckId) throw new ToolFormatError('缺少 deckId', 'MISSING_FIELD', '必须指定 deckId');
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能为自定义题库打桩快照');
        const snap = this.app.deckVersioning.createSnapshot(deck, { trigger: 'ai_batch', author: 'agent', note: args.note });
        return { success: true, versionId: snap.versionId, note: snap.versionName };
      }

      default:
        throw new ToolExecutionError(`未知工具调用: ${toolName}`, 'UNKNOWN_TOOL', '请只调用系统已声明的可用题库工具之一');
    }
  }
}
