/**
 * AI Agent Knowledge Deck Tool Execution Engine
 * Core 2.1: features/ai-agent/tool-executor.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';
import { parseMarkdownToDeck } from '../../shared/markdown-ast.js';
import {
  ToolFormatError,
  ToolReferenceError,
  ToolPermissionError,
  ToolExecutionError
} from './tool-errors.js';

export class DeckToolExecutor {
  constructor(app) {
    this.app = app;
  }

  async execute(toolName, args = {}) {
    switch (toolName) {
      case 'tool_list_decks': {
        return this.app.getAllDecks().map(d => {
          const ds = this.app.getDeckState(d.id);
          const health = validateDeckHealth(d);
          return {
            id: d.id,
            title: d.title,
            icon: d.icon,
            description: d.description,
            categoriesCount: d.categories.length,
            entitiesCount: d.entities.length,
            totalAttempts: ds.totalAttempts,
            healthStatus: health.valid ? (health.warnings.length > 0 ? '需补充' : '健壮') : '异常'
          };
        });
      }

      case 'tool_get_deck': {
        if (!args?.deckId) {
          throw new ToolFormatError('缺少必填参数 deckId', 'MISSING_FIELD', '调用 tool_get_deck 必须传入具体的 deckId 字符串');
        }
        const deck = this.app.getAllDecks().find(d => d.id === args.deckId);
        if (!deck) {
          throw new ToolReferenceError(`未找到 ID 为 "${args.deckId}" 的题库`, 'DECK_NOT_FOUND', '请先调用 tool_list_decks 查询当前系统内所有可用题库清单，核对准确的 deckId 后再重试', { requestedDeckId: args.deckId });
        }
        return deck;
      }

      case 'tool_create_deck': {
        if (!args?.title || !String(args.title).trim()) {
          throw new ToolFormatError('创建题库失败：缺少必填字段 title', 'MISSING_FIELD', '请在参数中提供 title 题库主标题');
        }
        if (!Array.isArray(args.categories) || args.categories.length === 0) {
          throw new ToolFormatError('创建题库失败：categories 必须是非空数组', 'INVALID_FIELD', '请至少提供一个分类对象 [{ id, name, group }]');
        }
        if (!Array.isArray(args.entities) || args.entities.length === 0) {
          throw new ToolFormatError('创建题库失败：entities 必须是非空数组', 'INVALID_FIELD', '请至少提供考点列表 [{ id, categoryId, layer, title, prompt, answer }]');
        }
        const categoryIds = new Set(args.categories.map(c => c.id));
        const orphan = args.entities.find(e => !categoryIds.has(e.categoryId));
        if (orphan) {
          throw new ToolReferenceError(`考点 "${orphan.title || orphan.id}" 引用的分类 "${orphan.categoryId}" 在 categories 中未声明`, 'ORPHAN_CATEGORY_REFERENCE', '请确保所有考点的 categoryId 均在 categories 数组中已声明');
        }

        const newDeck = {
          id: 'deck_' + Date.now(),
          title: args.title.trim(),
          icon: args.icon || '📚',
          description: args.description || '',
          categories: args.categories,
          layers: args.layers || [
            { level: 1, name: 'Layer 1: 基础认知' },
            { level: 2, name: 'Layer 2: 规律运用' },
            { level: 3, name: 'Layer 3: 陷阱特例' }
          ],
          entities: args.entities
        };

        const health = validateDeckHealth(newDeck);
        if (!health.valid) {
          throw new ToolFormatError(`题库未通过健康度门禁: ${health.errors.join('; ')}`, 'HEALTH_GATE_FAILED', `请纠正以下格式违规后重试: ${health.errors.join('; ')}`, { errors: health.errors, warnings: health.warnings });
        }

        this.app.state.customDecks = this.app.state.customDecks || [];
        this.app.state.customDecks.push(newDeck);
        this.app.saveUserData();
        this.app.renderAllViews();
        return {
          success: true,
          deckId: newDeck.id,
          title: newDeck.title,
          entitiesCount: newDeck.entities.length,
          healthWarning: health.warnings.join('; ') || null,
          message: `题库《${newDeck.title}》已成功落库保存！`
        };
      }

      case 'tool_update_deck_meta': {
        if (!args?.deckId) {
          throw new ToolFormatError('缺少必填参数 deckId', 'MISSING_FIELD', '必须指定要修改的 deckId');
        }
        if (['deck_verbs', 'deck_http', 'deck_python'].includes(args.deckId)) {
          throw new ToolPermissionError('系统内置预设题库元信息受保护不可直接修改', 'BUILTIN_PROTECTED', '系统预设题库为只读资源，如需定制建议使用 tool_create_deck 复制一份自定义题库');
        }
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) {
          throw new ToolReferenceError(`未找到可编辑的自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能修改用户自定义题库，请调用 tool_list_decks 确认可编辑题库 ID');
        }
        if (args.title) deck.title = args.title;
        if (args.icon) deck.icon = args.icon;
        if (args.description !== undefined) deck.description = args.description;
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, message: `题库元信息已更新` };
      }

      case 'tool_delete_deck': {
        if (!args?.deckId) {
          throw new ToolFormatError('缺少必填参数 deckId', 'MISSING_FIELD', '必须指定要删除的 deckId');
        }
        if (['deck_verbs', 'deck_http', 'deck_python'].includes(args.deckId)) {
          throw new ToolPermissionError('系统内置预设题库受系统保护，不可删除！', 'BUILTIN_PROTECTED', '系统内置题库(如 deck_verbs)受保护禁止删除。请向用户解释该保护机制，切勿重复发起删除。', { deckId: args.deckId });
        }
        const target = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!target) {
          throw new ToolReferenceError(`未找到欲删除的自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '该自定义题库不存在或已被删除');
        }
        this.app.state.customDecks = this.app.state.customDecks.filter(d => d.id !== args.deckId);
        if (this.app.state.deckStates && this.app.state.deckStates[args.deckId]) {
          delete this.app.state.deckStates[args.deckId];
        }
        if (this.app.state.activeDeckId === args.deckId) {
          this.app.state.activeDeckId = 'deck_verbs';
        }
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, message: `题库 ${args.deckId} 及其记录已安全删除` };
      }

      case 'tool_add_entities': {
        if (!args?.deckId || !Array.isArray(args.entities) || args.entities.length === 0) {
          throw new ToolFormatError('缺少 deckId 或 entities 非空数组', 'MISSING_FIELD', '调用 tool_add_entities 必须传入 deckId 与实体数组');
        }
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) {
          throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能向自定义题库追加实体，请确认题库 ID');
        }
        deck.entities = deck.entities || [];
        deck.entities.push(...args.entities);
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, addedCount: args.entities.length, total: deck.entities.length };
      }

      case 'tool_update_entity': {
        if (!args?.deckId || !args?.entityId) {
          throw new ToolFormatError('缺少必填参数 deckId 或 entityId', 'MISSING_FIELD', '必须同时指定 deckId 与 entityId');
        }
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
        deck.entities = deck.entities || [];
        const entity = deck.entities.find(e => e.id === args.entityId);
        if (!entity) {
          throw new ToolReferenceError(`考点词条 "${args.entityId}" 在题库 "${args.deckId}" 中不存在`, 'ENTITY_NOT_FOUND', `请先通过 tool_get_deck("${args.deckId}") 获取考点清单，核实 entityId`, { deckId: args.deckId, entityId: args.entityId });
        }
        Object.assign(entity, args.updates || args.patch || {});
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, updatedEntity: entity };
      }

      case 'tool_delete_entity': {
        if (!args?.deckId || !args?.entityId) {
          throw new ToolFormatError('缺少必填参数 deckId 或 entityId', 'MISSING_FIELD', '必须同时指定 deckId 与 entityId');
        }
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) {
          throw new ToolReferenceError(`未找到自定义题库 "${args.deckId}"`, 'DECK_NOT_FOUND', '只能从自定义题库中删除实体');
        }
        const entIdx = (deck.entities || []).findIndex(e => e.id === args.entityId);
        if (entIdx === -1) {
          throw new ToolReferenceError(`考点词条 "${args.entityId}" 在题库中不存在`, 'ENTITY_NOT_FOUND', '请核对考点 ID 是否正确');
        }
        deck.entities.splice(entIdx, 1);
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, remainingCount: deck.entities.length };
      }

      case 'tool_search_entities': {
        if (!args || typeof args.query !== 'string') {
          throw new ToolFormatError('缺少检索关键字 query', 'MISSING_FIELD', '请传入要检索的 query 字符串');
        }
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
        if (!args?.markdownText || !args.markdownText.trim()) {
          throw new ToolFormatError('缺少 markdownText 参数', 'MISSING_FIELD', '请传入符合 AST 语法的 Markdown 题库文本');
        }
        try {
          const deck = parseMarkdownToDeck(args.markdownText);
          deck.id = 'deck_' + Date.now();
          this.app.state.customDecks = this.app.state.customDecks || [];
          this.app.state.customDecks.push(deck);
          this.app.saveUserData();
          this.app.renderAllViews();
          return { success: true, deckId: deck.id, title: deck.title, entitiesCount: deck.entities.length };
        } catch (err) {
          throw new ToolExecutionError(`Markdown 语法解析入库失败: ${err.message}`, 'MARKDOWN_PARSE_FAILED', '请核对 Markdown 文本格式，确保包含 # 题库标题 与 ## 分类');
        }
      }

      default:
        throw new ToolExecutionError(`未知工具调用: ${toolName}`, 'UNKNOWN_TOOL', '请只调用系统已声明的 10 项题库工具之一');
    }
  }
}
