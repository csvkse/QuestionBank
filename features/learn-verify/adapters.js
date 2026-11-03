/**
 * Learn & Verify Node Adapter (Adapter Pattern)
 * Core: features/learn-verify/adapters.js
 * 
 * Adapts heterogenous Deck Entities (English verbs, HTTP codes, Python models)
 * into a normalized, structured LearnVerifyNodeViewModel for the FSM & UI.
 */

import { generateDistractors } from '../../shared/distractor-sampler.js';

export class LearnVerifyNodeAdapter {
  /**
   * 将 Entity 转化为学练一体全景节点
   * @param {Object} entity - 原始实体对象
   * @param {Object} deck - 题库元数据
   * @param {Object} deckState - 用户当前题库熟练度状态
   * @returns {Object} 结构化视图模型
   */
  static adapt(entity, deck, deckState = {}) {
    if (!entity || !deck) {
      throw new Error('[LearnVerifyNodeAdapter] entity and deck are required');
    }

    const cards = deckState.cards || {};
    const cardState = cards[entity.id] || { level: 0, attempts: 0, correct: 0, wrong: 0 };
    const isNew = cardState.attempts === 0 || cardState.level === 0;

    const categories = deck.categories || [];
    const category = categories.find(c => c.id === entity.categoryId) || {
      id: entity.categoryId || 'unknown',
      name: '核心考点',
      group: '基础知识板块'
    };

    // 提取强混淆对比条目
    let confusedSibling = null;
    if (entity.confusedWith) {
      const target = (deck.entities || []).find(e => e.id === entity.confusedWith);
      if (target) {
        confusedSibling = {
          id: target.id,
          title: target.title,
          answer: target.answer,
          prompt: target.prompt || '',
          explanation: target.explanation || ''
        };
      }
    }

    // 提取同分类同胞对比列表 (取同类别非自身的前 3 项)
    const siblings = (deck.entities || [])
      .filter(e => e.categoryId === entity.categoryId && e.id !== entity.id)
      .slice(0, 3)
      .map(s => ({
        id: s.id,
        title: s.title,
        answer: s.answer,
        subtitle: s.subtitle || ''
      }));

    // 即时生成同胞诱惑项 (4 选 1，含已打乱的正确项)
    const allEntities = Array.isArray(deck) ? deck : (deck.entities || []);
    const options = generateDistractors(entity, allEntities);

    return {
      id: entity.id,
      title: entity.title,
      subtitle: entity.subtitle || '',
      layer: entity.layer || 1,
      categoryId: category.id,
      categoryName: category.name,
      groupName: category.group || '基础知识板块',
      isNew,
      cardState: {
        level: cardState.level || 0,
        attempts: cardState.attempts || 0,
        correct: cardState.correct || 0,
        wrong: cardState.wrong || 0
      },

      // 阶段 1: 认知输入研读载荷 (Encoding View)
      encoding: {
        prompt: entity.prompt || '考核要点：',
        answer: entity.answer,
        explanation: entity.explanation || '',
        pitfalls: entity.pitfalls || null,
        confusedSibling,
        siblings
      },

      // 阶段 2: 即时微测题目载荷 (Verification Question)
      verification: {
        prompt: entity.prompt || '请选出对应正确形态：',
        correctAnswer: entity.answer,
        options
      },

      // 阶段 3: 错因干预载荷 (Remediation Payload)
      remediation: {
        correctAnswer: entity.answer,
        explanation: entity.explanation || '',
        pitfalls: entity.pitfalls || null,
        confusedSibling
      },

      rawEntity: entity,
      rawDeck: deck
    };
  }
}
