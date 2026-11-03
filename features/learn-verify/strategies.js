/**
 * Learn & Verify Progression & Quiz Strategies (Strategy Pattern)
 * Core: features/learn-verify/strategies.js
 */

import { LearnVerifyNodeAdapter } from './adapters.js';

/**
 * 策略 1：层级阶梯学习推进策略 (Layer 1 基础 -> Layer 2 规律 -> Layer 3 陷阱)
 */
export class HierarchicalLayerProgressionStrategy {
  constructor(targetLayer = 1, options = {}) {
    this.targetLayer = targetLayer;
    this.requiredAccuracy = options.requiredAccuracy || 80;
    this.maxQuota = options.maxQuota || 15;
  }

  /**
   * 构建待学习节点序列
   */
  prepareNodes(deck, deckState = {}) {
    if (!deck || !Array.isArray(deck.entities)) return [];

    const entities = deck.entities.filter(e => (e.layer || 1) === this.targetLayer);
    const cards = deckState.cards || {};

    // 优先排布未学考点 (level === 0 || attempts === 0)，次之排布低熟练度考点
    const sorted = [...entities].sort((a, b) => {
      const cA = cards[a.id] || { level: 0, attempts: 0 };
      const cB = cards[b.id] || { level: 0, attempts: 0 };

      const isNewA = (cA.attempts === 0 || cA.level === 0) ? 1 : 0;
      const isNewB = (cB.attempts === 0 || cB.level === 0) ? 1 : 0;

      if (isNewA !== isNewB) return isNewB - isNewA; // 新考点排前
      return (cA.level || 0) - (cB.level || 0); // 低分考点排前
    });

    const chosen = sorted.slice(0, this.maxQuota);
    return chosen.map(ent => LearnVerifyNodeAdapter.adapt(ent, deck, deckState));
  }

  /**
   * 判断当前层级是否达成晋级门禁 (>=80% 正确率)
   */
  canUnlockNextTier(stats = {}) {
    const accuracy = stats.accuracy !== undefined ? stats.accuracy : 100;
    return accuracy >= this.requiredAccuracy;
  }
}

/**
 * 策略 2：分类模块专精推进策略 (按指定 Category 全层级纵深穿透)
 */
export class CategoryMasteryProgressionStrategy {
  constructor(categoryId, options = {}) {
    this.categoryId = categoryId;
    this.maxQuota = options.maxQuota || 20;
  }

  prepareNodes(deck, deckState = {}) {
    if (!deck || !Array.isArray(deck.entities)) return [];

    const entities = deck.entities.filter(e => e.categoryId === this.categoryId);
    const cards = deckState.cards || {};

    // 分类内按 Layer 1 -> Layer 2 -> Layer 3 递进排布
    const sorted = [...entities].sort((a, b) => {
      const lA = a.layer || 1;
      const lB = b.layer || 1;
      if (lA !== lB) return lA - lB;

      const cA = cards[a.id] || { level: 0, attempts: 0 };
      const cB = cards[b.id] || { level: 0, attempts: 0 };
      return (cA.level || 0) - (cB.level || 0);
    });

    const chosen = sorted.slice(0, this.maxQuota);
    return chosen.map(ent => LearnVerifyNodeAdapter.adapt(ent, deck, deckState));
  }

  canUnlockNextTier() {
    return true;
  }
}

/**
 * 测验策略 1：同胞干扰项 4 选 1 测验
 */
export class SiblingChoiceVerificationStrategy {
  evaluate(userChoice, correctAnswer) {
    if (typeof userChoice !== 'string') return false;
    return userChoice.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }
}

/**
 * 测验策略 2：主动拼写默写测验
 */
export class ActiveSpellingVerificationStrategy {
  evaluate(userSpelling, correctAnswer) {
    if (typeof userSpelling !== 'string') return false;
    return userSpelling.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }
}
