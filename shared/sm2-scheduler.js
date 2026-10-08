/**
 * SM-2 / Ebbinghaus Spaced Repetition Scheduler
 * Core: shared/sm2-scheduler.js
 */

export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30]; // Days

/**
 * 计算复习周期与记忆等级更新
 * @param {Object} currentCard - 当前卡片记忆状态 { level, attempts, correct, wrong, lastReviewedAt, nextReviewAt }
 * @param {boolean} isCorrect - 答题是否正确
 * @returns {Object} 更新后的卡片状态
 */
export function calculateNextReview(currentCard, isCorrect) {
  const card = currentCard ? { ...currentCard } : { level: 0, attempts: 0, correct: 0, wrong: 0 };
  const now = Date.now();

  card.attempts = (card.attempts || 0) + 1;
  card.lastReviewedAt = now;

  if (isCorrect) {
    card.correct = (card.correct || 0) + 1;
    card.level = Math.min((card.level || 0) + 1, REVIEW_INTERVALS.length);
    const intervalDays = REVIEW_INTERVALS[card.level - 1] || 30;
    card.nextReviewAt = now + intervalDays * 24 * 60 * 60 * 1000;
  } else {
    card.wrong = (card.wrong || 0) + 1;
    card.level = Math.max(0, (card.level || 0) - 1);
    // 答错立即进入今日或明日待复习池
    card.nextReviewAt = now + 4 * 60 * 60 * 1000; // 4小时后再次复现
  }

  return card;
}

/**
 * 计算题库整体知识覆盖率与掌握率
 * @param {Array} entities - 题库词条列表
 * @param {Object} cardStates - 词条进度映射 { [entityId]: CardState }
 * @returns {Object} { total, practiced, mastered, due, coveragePercent, masteryPercent }
 */
export function calculateDeckCoverage(entities = [], cardStates = {}) {
  const total = entities.length;
  if (total === 0) return { total: 0, practiced: 0, mastered: 0, due: 0, coveragePercent: 0, masteryPercent: 0 };

  const endOfToday = new Date().setHours(23, 59, 59, 999);
  let practiced = 0;
  let mastered = 0;
  let due = 0;

  entities.forEach(ent => {
    const card = cardStates[ent.id];
    if (card && card.attempts > 0) {
      practiced++;
      if (card.level >= 4) mastered++;
      if (card.nextReviewAt && card.nextReviewAt <= endOfToday) due++;
    }
  });

  const coveragePercent = Math.round((practiced / total) * 100);
  const masteryPercent = Math.round((mastered / total) * 100);

  return { total, practiced, mastered, due, coveragePercent, masteryPercent };
}
