/**
 * Concrete Question Queue Strategies (Strategy Pattern)
 * Core: shared/question-strategies/strategies.js
 */

import { DueCardSpecification, MistakeCardSpecification } from './specifications.js';

/**
 * 数组随机洗牌 (Fisher-Yates)
 */
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 策略 1：每日艾宾浩斯复习策略
 */
export class DailyReviewQueueStrategy {
  constructor(defaultQuota = 20) {
    this.defaultQuota = defaultQuota;
  }

  buildQueue({ deck, deckState, options = {} }) {
    const entities = deck?.entities || [];
    const cards = deckState?.cards || {};
    const targetTimestamp = options.targetTimestamp || Date.now();
    const quota = Math.min(options.quota || this.defaultQuota, 30);

    // 1. 规约筛选到期词条
    const dueEntities = entities.filter(e => DueCardSpecification.isSatisfiedBy(cards[e.id], targetTimestamp));

    // 2. 防假兜底：到期为 0 严格返回空数组
    if (dueEntities.length === 0) {
      return [];
    }

    // 3. 按逾期紧迫度与洗牌综合排序
    const sorted = [...dueEntities].sort((a, b) => {
      const cA = cards[a.id];
      const cB = cards[b.id];
      const overdueA = targetTimestamp - (cA.nextReviewAt || 0);
      const overdueB = targetTimestamp - (cB.nextReviewAt || 0);
      return overdueB - overdueA;
    });

    // 4. 防疲劳安全截断
    return sorted.slice(0, quota);
  }
}

/**
 * 策略 2：弱点歼灭战策略
 */
export class WeaknessQueueStrategy {
  constructor(defaultQuota = 15) {
    this.defaultQuota = defaultQuota;
  }

  buildQueue({ deck, deckState, options = {} }) {
    const entities = deck?.entities || [];
    const cards = deckState?.cards || {};
    const quota = options.quota || this.defaultQuota;

    // 1. 规约筛选错题
    const mistakeEntities = entities.filter(e => MistakeCardSpecification.isSatisfiedBy(cards[e.id]));

    // 2. 防假兜底：无错题严格返回空数组
    if (mistakeEntities.length === 0) {
      return [];
    }

    // 3. 错误权重综合降序加权排队
    const sorted = [...mistakeEntities].sort((a, b) => {
      const cA = cards[a.id] || { wrong: 0, level: 0, attempts: 1 };
      const cB = cards[b.id] || { wrong: 0, level: 0, attempts: 1 };
      const rateA = cA.wrong / Math.max(cA.attempts, 1);
      const rateB = cB.wrong / Math.max(cB.attempts, 1);
      const scoreA = (cA.wrong * 2.0) + (Math.max(0, 3 - (cA.level || 0)) * 1.5) + (rateA * 10);
      const scoreB = (cB.wrong * 2.0) + (Math.max(0, 3 - (cB.level || 0)) * 1.5) + (rateB * 10);
      return scoreB - scoreA;
    });

    return sorted.slice(0, quota);
  }
}

/**
 * 策略 3：分层阶梯战役策略
 */
export class CampaignSteppedQueueStrategy {
  constructor(defaultQuota = 8) {
    this.defaultQuota = defaultQuota;
  }

  buildQueue({ deck, options = {} }) {
    const entities = deck?.entities || [];
    const targetLayer = options.targetLayer || 1;
    const quota = options.quota || this.defaultQuota;

    const layerEntities = entities.filter(e => (e.layer || 1) === targetLayer);
    if (layerEntities.length === 0) return [];

    // 层级内 Fisher-Yates 充分随机乱序
    return shuffleArray(layerEntities).slice(0, quota);
  }
}

/**
 * 策略 4：极速生存策略
 */
export class SpeedSprintQueueStrategy {
  constructor(defaultQuota = 30) {
    this.defaultQuota = defaultQuota;
  }

  buildQueue({ deck, options = {} }) {
    const entities = deck?.entities || [];
    if (entities.length === 0) return [];
    const quota = options.quota || this.defaultQuota;
    return shuffleArray(entities).slice(0, quota);
  }
}

/**
 * 策略 5：专项速刷策略 (带上下文记忆)
 */
export class CategoryDrillQueueStrategy {
  buildQueue({ deck, options = {} }) {
    const entities = deck?.entities || [];
    const { filterType, filterValue } = options;

    let matched = [];
    if (filterType === 'group') {
      matched = entities.filter(e => {
        const c = (deck.categories || []).find(cat => cat.id === e.categoryId);
        return c && (c.group || '核心知识板块') === filterValue;
      });
    } else if (filterType === 'category') {
      matched = entities.filter(e => e.categoryId === filterValue);
    } else if (filterType === 'layer') {
      matched = entities.filter(e => e.layer === filterValue);
    } else if (filterType === 'single') {
      matched = entities.filter(e => e.id === filterValue);
    } else {
      matched = entities;
    }

    if (matched.length === 0) return [];
    return filterType === 'single' ? matched : shuffleArray(matched);
  }
}

/**
 * 策略 6：自由沙盒混合定制策略
 */
export class SandboxCustomQueueStrategy {
  buildQueue({ deck, deckState, options = {} }) {
    const entities = deck?.entities || [];
    const cards = deckState?.cards || {};
    const {
      selectedCategories = new Set(),
      selectedLayers = new Set([1, 2, 3]),
      trialMode = 'DEFAULT',
      questionCount = 10,
      isShuffle = true
    } = options;

    const matched = entities.filter(e => selectedCategories.has(e.categoryId) && selectedLayers.has(e.layer || 1));
    if (matched.length === 0) return [];

    let queue = [...matched];
    if (trialMode === 'WEAKNESS') {
      queue.sort((a, b) => {
        const cA = cards[a.id] || { level: 0, wrong: 0, attempts: 1 };
        const cB = cards[b.id] || { level: 0, wrong: 0, attempts: 1 };
        const rateA = cA.wrong / Math.max(cA.attempts, 1);
        const rateB = cB.wrong / Math.max(cB.attempts, 1);
        const scoreA = (cA.wrong * 2.0) + (Math.max(0, 3 - (cA.level || 0)) * 1.5) + (rateA * 10);
        const scoreB = (cB.wrong * 2.0) + (Math.max(0, 3 - (cB.level || 0)) * 1.5) + (rateB * 10);
        return scoreB - scoreA;
      });
    } else if (trialMode === 'STEPPED') {
      // 分层递进：层级升序，但相同层级内部充分洗牌，消除僵死顺序
      const layer1 = shuffleArray(queue.filter(e => (e.layer || 1) === 1));
      const layer2 = shuffleArray(queue.filter(e => (e.layer || 1) === 2));
      const layer3 = shuffleArray(queue.filter(e => (e.layer || 1) === 3));
      queue = [...layer1, ...layer2, ...layer3];
    } else if (isShuffle) {
      queue = shuffleArray(queue);
    }

    const count = questionCount === 9999 ? queue.length : Math.min(questionCount, queue.length);
    return queue.slice(0, count);
  }
}
