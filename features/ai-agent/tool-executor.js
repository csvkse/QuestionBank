/**
 * AI Agent Knowledge Deck Tool Execution Engine
 * Core 2.1: features/ai-agent/tool-executor.js
 */

import { validateDeckHealth } from '../../shared/deck-validator.js';
import { parseMarkdownToDeck } from '../../shared/markdown-ast.js';

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
        const deck = this.app.getAllDecks().find(d => d.id === args.deckId);
        if (!deck) throw new Error(`未找到 ID 为 ${args.deckId} 的题库`);
        return deck;
      }

      case 'tool_create_deck': {
        const newDeck = {
          id: 'deck_' + Date.now(),
          title: args.title,
          icon: args.icon || '📚',
          description: args.description || '',
          categories: args.categories || [],
          layers: args.layers || [
            { level: 1, name: 'Layer 1: 基础认知' },
            { level: 2, name: 'Layer 2: 规律运用' },
            { level: 3, name: 'Layer 3: 陷阱特例' }
          ],
          entities: args.entities || []
        };
        const health = validateDeckHealth(newDeck);
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
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new Error(`只能修改用户自定义题库，未找到目标题库 ${args.deckId}`);
        if (args.title) deck.title = args.title;
        if (args.icon) deck.icon = args.icon;
        if (args.description !== undefined) deck.description = args.description;
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, message: `题库元信息已更新` };
      }

      case 'tool_delete_deck': {
        const isBuiltin = ['deck_verbs', 'deck_http', 'deck_python'].includes(args.deckId);
        if (isBuiltin) throw new Error(`系统内置预设题库受系统保护，不可删除！`);
        this.app.state.customDecks = (this.app.state.customDecks || []).filter(d => d.id !== args.deckId);
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
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new Error(`未找到自定义题库 ${args.deckId}`);
        deck.entities = deck.entities || [];
        deck.entities.push(...args.entities);
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, addedCount: args.entities.length, total: deck.entities.length };
      }

      case 'tool_update_entity': {
        let deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) {
          const target = this.app.getAllDecks().find(d => d.id === args.deckId);
          if (target) {
            deck = JSON.parse(JSON.stringify(target));
            this.app.state.customDecks = this.app.state.customDecks || [];
            this.app.state.customDecks.push(deck);
          } else {
            throw new Error(`未找到目标题库 ${args.deckId}`);
          }
        }
        const entity = deck.entities.find(e => e.id === args.entityId);
        if (!entity) throw new Error(`未找到考点词条 ${args.entityId}`);
        Object.assign(entity, args.updates || args.patch || {});
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, updatedEntity: entity };
      }

      case 'tool_delete_entity': {
        const deck = (this.app.state.customDecks || []).find(d => d.id === args.deckId);
        if (!deck) throw new Error(`未找到自定义题库 ${args.deckId}`);
        deck.entities = deck.entities.filter(e => e.id !== args.entityId);
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, remainingCount: deck.entities.length };
      }

      case 'tool_search_entities': {
        const q = (args.query || '').toLowerCase();
        const decks = args.deckId ? this.app.getAllDecks().filter(d => d.id === args.deckId) : this.app.getAllDecks();
        let matches = [];
        decks.forEach(d => {
          (d.entities || []).forEach(e => {
            if (e.title.toLowerCase().includes(q) || (e.answer && e.answer.toLowerCase().includes(q)) || (e.explanation && e.explanation.toLowerCase().includes(q))) {
              matches.push({ deckTitle: d.title, ...e });
            }
          });
        });
        return matches.slice(0, 15);
      }

      case 'tool_import_markdown_deck': {
        const deck = parseMarkdownToDeck(args.markdownText);
        deck.id = 'deck_' + Date.now();
        this.app.state.customDecks = this.app.state.customDecks || [];
        this.app.state.customDecks.push(deck);
        this.app.saveUserData();
        this.app.renderAllViews();
        return { success: true, deckId: deck.id, title: deck.title, entitiesCount: deck.entities.length };
      }

      default:
        throw new Error(`未知工具调用: ${toolName}`);
    }
  }
}
