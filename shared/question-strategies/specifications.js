/**
 * Unified Card Specifications & Domain Metrics (Specification Pattern)
 * Core: shared/question-strategies/specifications.js
 */

/**
 * 统一错题判定规约：
 * 判定条件：做错次数 > 0，且 (错误率 >= 25% 或 掌握度仍处于 Level 0/1 浅层记忆)
 */
export const MistakeCardSpecification = {
  isSatisfiedBy(card) {
    if (!card || typeof card !== 'object' || !card.attempts || card.attempts <= 0) return false;
    const wrong = card.wrong || 0;
    if (wrong <= 0) return false;
    const errorRate = wrong / card.attempts;
    const level = card.level || 0;
    return errorRate >= 0.25 || level <= 1;
  }
};

/**
 * 统一艾宾浩斯到期判定规约：
 * 判定条件：卡片已学过，且 nextReviewAt <= 当天结束时间戳 (23:59:59.999)
 */
export const DueCardSpecification = {
  isSatisfiedBy(card, targetTimestamp = Date.now()) {
    if (!card || typeof card !== 'object' || !card.nextReviewAt) return false;
    const endOfDay = new Date(targetTimestamp).setHours(23, 59, 59, 999);
    return card.nextReviewAt <= endOfDay;
  }
};

/**
 * 记忆生锈判定规约：
 * 判定条件：已到期，且逾期时长超过记忆稳定期 (stabilityDays) 的 2 倍以上
 */
export const RustyCardSpecification = {
  isSatisfiedBy(card, targetTimestamp = Date.now()) {
    if (!DueCardSpecification.isSatisfiedBy(card, targetTimestamp)) return false;
    const overdueMs = targetTimestamp - card.nextReviewAt;
    const stabilityMs = Math.max(card.stabilityDays || 1, 1) * 24 * 3600 * 1000;
    return overdueMs > stabilityMs * 2;
  }
};

/**
 * 永久掌握判定规约：
 * 判定条件：已学过且 SM-2 记忆等级达到 Level 4 以上
 */
export const MasteredCardSpecification = {
  isSatisfiedBy(card) {
    if (!card || typeof card !== 'object' || !card.attempts || card.attempts <= 0) return false;
    return (card.level || 0) >= 4;
  }
};

/**
 * 统一计算题库整体熟练度与全景指标
 * 为 Dashboard 看板、导航栏角标、推荐横幅提供单源基准 (Single Source of Truth)
 * @param {Array} entities - 题库实体集合
 * @param {Object} cardStates - 用户卡片状态映射 { [id]: CardState }
 * @param {number} targetTimestamp - 研判时间戳
 * @returns {Object} 统一计算指标
 */
export function calculateUnifiedMetrics(entities = [], cardStates = {}, targetTimestamp = Date.now()) {
  const total = entities.length;
  if (total === 0) {
    return {
      total: 0,
      practicedCount: 0,
      masteredCount: 0,
      dueCount: 0,
      rustyCount: 0,
      mistakeCount: 0,
      dueEntities: [],
      mistakeEntities: [],
      coverageRate: 0,
      masteryRate: 0
    };
  }

  let practicedCount = 0;
  let masteredCount = 0;
  let dueCount = 0;
  let rustyCount = 0;
  let mistakeCount = 0;
  const dueEntities = [];
  const mistakeEntities = [];

  entities.forEach(ent => {
    const card = cardStates[ent.id];
    if (card && card.attempts > 0) {
      practicedCount++;
      if (MasteredCardSpecification.isSatisfiedBy(card)) masteredCount++;
      if (DueCardSpecification.isSatisfiedBy(card, targetTimestamp)) {
        dueCount++;
        dueEntities.push(ent);
        if (RustyCardSpecification.isSatisfiedBy(card, targetTimestamp)) rustyCount++;
      }
      if (MistakeCardSpecification.isSatisfiedBy(card)) {
        mistakeCount++;
        mistakeEntities.push(ent);
      }
    }
  });

  const coverageRate = Math.round((practicedCount / total) * 100);
  const masteryRate = Math.round((masteredCount / total) * 100);

  return {
    total,
    practicedCount,
    masteredCount,
    dueCount,
    rustyCount,
    mistakeCount,
    dueEntities,
    mistakeEntities,
    coverageRate,
    masteryRate
  };
}
