/**
 * Sibling Distractor Sampler with Annealing Degradation
 * Core: shared/distractor-sampler.js
 */

/**
 * 为题目生成 4 选 1 干扰项 (优先同分类同胞 -> 退火至全库 -> 退火至通用变形)
 * @param {Object} targetEntity - 目标考点实体
 * @param {Array} allEntities - 题库中全部实体
 * @returns {Array<string>} 包含1个正确答案与3个干扰项的数组 (已乱序)
 */
export function generateDistractors(targetEntity, allEntities = []) {
  if (!targetEntity) return [];
  const correctAnswer = targetEntity.answer.trim();
  const distractors = new Set();

  // 1. 同胞池采样 (优先同一 categoryId 的兄弟词条，具备最高混淆度)
  const siblings = allEntities.filter(e => 
    e.categoryId === targetEntity.categoryId && 
    e.id !== targetEntity.id && 
    e.answer && 
    e.answer.trim() !== correctAnswer
  );

  // 随机打乱兄弟池
  const shuffledSiblings = [...siblings].sort(() => Math.random() - 0.5);
  for (const s of shuffledSiblings) {
    if (distractors.size >= 3) break;
    distractors.add(s.answer.trim());
  }

  // 2. 一级退火 (若同胞不足3个，从同一题库的其他分类补充)
  if (distractors.size < 3) {
    const deckOthers = allEntities.filter(e => 
      e.id !== targetEntity.id && 
      e.answer && 
      e.answer.trim() !== correctAnswer &&
      !distractors.has(e.answer.trim())
    ).sort(() => Math.random() - 0.5);

    for (const o of deckOthers) {
      if (distractors.size >= 3) break;
      distractors.add(o.answer.trim());
    }
  }

  // 3. 二级退火 (若仍不足3个，生成通用的变体干扰伪项)
  if (distractors.size < 3) {
    const fallbacks = [
      correctAnswer + 's',
      correctAnswer + 'ed',
      correctAnswer.replace(/ing$/, 'ed'),
      correctAnswer.replace(/ed$/, 'ing'),
      'None of the above',
      'Undefined'
    ];
    for (const f of fallbacks) {
      if (distractors.size >= 3) break;
      if (f !== correctAnswer) distractors.add(f);
    }
  }

  // 组合答案并最终乱序
  const options = [correctAnswer, ...Array.from(distractors).slice(0, 3)];
  return shuffleOptions(options);
}

/**
 * Fisher-Yates 数组乱序
 * @param {Array} arr 
 * @returns {Array}
 */
export function shuffleOptions(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
