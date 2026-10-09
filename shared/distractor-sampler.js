/**
 * Distractor Synthesis Pipeline (Pipeline Pattern)
 * Core: shared/distractor-sampler.js
 * 
 * Implements 4-stage synthesis pipeline:
 * Stage 1: Preset & Strong Confusion (confusedWith) Injection
 * Stage 2: Form-Preserving Sibling Sampler (prevents cross-tense giveaway)
 * Stage 3: Domain-Adaptive Fallback Sampler (prevents absurd suffixes on concept decks)
 * Stage 4: Fisher-Yates Shuffler
 */

/**
 * 判断条目是否属于英文动词变位考查
 */
function isGrammarInflectionEntity(entity, answer) {
  if (!entity || !answer) return false;
  const prompt = (entity.prompt || '').toLowerCase();
  const isEnglishWord = /^[a-zA-Z\s\-']+$/.test(answer);
  return isEnglishWord && (
    answer.endsWith('ing') ||
    answer.endsWith('ed') ||
    prompt.includes('分词') ||
    prompt.includes('过去') ||
    prompt.includes('-ing') ||
    prompt.includes('-ed') ||
    prompt.includes('第三人称')
  );
}

/**
 * 针对英语变位生成高仿语法陷阱选项
 */
function generateGrammarTraps(entity, correctAnswer) {
  const traps = [];
  const base = (entity.title || '').trim().toLowerCase();
  const ans = correctAnswer.trim().toLowerCase();

  if (ans.endsWith('ing')) {
    // -ic 结尾漏加 k: panicking -> panicing
    if (base.endsWith('ic')) {
      traps.push(base + 'ing');
      traps.push(base + 'king');
      traps.push(base + 'cing');
    } else if (base.endsWith('e') && !base.endsWith('ee')) {
      // 漏去 e: writing -> writeing
      traps.push(base + 'ing');
      traps.push(base.slice(0, -1) + 'ying');
    } else if (base.endsWith('ie')) {
      // ie 误直接加 ing: lying -> lieing
      traps.push(base + 'ing');
      traps.push(base.slice(0, -2) + 'ing');
    } else {
      // 错误双写或漏双写: running -> runing, working -> workking
      if (ans.length > base.length + 3) {
        traps.push(base + 'ing'); // 漏双写
      } else {
        const lastChar = base[base.length - 1];
        traps.push(base + lastChar + 'ing'); // 乱双写
      }
    }
  } else if (ans.endsWith('ed')) {
    if (base.endsWith('ic')) {
      traps.push(base + 'ed');
      traps.push(base + 'ked');
      traps.push(base + 'ced');
    } else if (base.endsWith('e')) {
      traps.push(base + 'ed'); // 重复加 ed
    } else if (base.endsWith('y')) {
      traps.push(base + 'ed'); // 没变 y 为 i
    } else {
      traps.push(base + 'd');
    }
  }

  return traps.filter(t => t.toLowerCase() !== ans);
}

/**
 * 4 阶段干扰项合成管道
 * @param {Object} targetEntity - 目标考点实体
 * @param {Array} allEntities - 题库中全部实体
 * @returns {Array<string>} 包含 1 个正确答案与 3 个干扰项的选项数组 (已乱序)
 */
export function generateDistractors(targetEntity, allEntities = []) {
  if (!targetEntity) return [];
  const correctAnswer = (targetEntity.answer || '').trim();
  const distractors = new Set();
  const isGrammar = isGrammarInflectionEntity(targetEntity, correctAnswer);

  // ==================== Stage 1: 预设项与强混淆对注入 ====================
  if (Array.isArray(targetEntity.presetDistractors)) {
    for (const p of targetEntity.presetDistractors) {
      if (distractors.size >= 3) break;
      const clean = (p || '').trim();
      if (clean && clean !== correctAnswer) distractors.add(clean);
    }
  }

  if (distractors.size < 3 && targetEntity.confusedWith) {
    const cf = allEntities.find(e => e.id === targetEntity.confusedWith);
    if (cf && cf.answer) {
      const clean = cf.answer.trim();
      if (clean && clean !== correctAnswer) {
        let compatible = true;
        if (isGrammar) {
          if (correctAnswer.endsWith('ing') && !clean.endsWith('ing')) compatible = false;
          if (correctAnswer.endsWith('ed') && !clean.endsWith('ed')) compatible = false;
        }
        if (compatible) distractors.add(clean);
      }
    }
  }

  // ==================== Stage 2: 同形态约束的同胞池采样 ====================
  if (distractors.size < 3) {
    const siblings = allEntities.filter(e => {
      if (e.categoryId !== targetEntity.categoryId || e.id === targetEntity.id || !e.answer) return false;
      const ans = e.answer.trim();
      if (ans === correctAnswer || distractors.has(ans)) return false;

      // 语法形态对齐过滤：考 -ing 只选 -ing；考 -ed 只选 -ed，避免一眼秒杀
      if (isGrammar) {
        if (correctAnswer.endsWith('ing') && !ans.endsWith('ing')) return false;
        if (correctAnswer.endsWith('ed') && !ans.endsWith('ed')) return false;
      }
      return true;
    }).sort(() => Math.random() - 0.5);

    for (const s of siblings) {
      if (distractors.size >= 3) break;
      distractors.add(s.answer.trim());
    }
  }

  // 若因形态过滤导致同胞不足，且非变位题，允许放宽同胞条件作为补充
  if (distractors.size < 3 && !isGrammar) {
    const relaxedSiblings = allEntities.filter(e => 
      e.categoryId === targetEntity.categoryId &&
      e.id !== targetEntity.id &&
      e.answer &&
      e.answer.trim() !== correctAnswer &&
      !distractors.has(e.answer.trim())
    ).sort(() => Math.random() - 0.5);

    for (const s of relaxedSiblings) {
      if (distractors.size >= 3) break;
      distractors.add(s.answer.trim());
    }
  }

  // ==================== Stage 3: 领域自适应退火兜底 ====================
  if (distractors.size < 3) {
    if (isGrammar) {
      // 语言类：使用形态变异生成器生成真实陷阱
      const traps = generateGrammarTraps(targetEntity, correctAnswer);
      for (const t of traps) {
        if (distractors.size >= 3) break;
        if (t && t !== correctAnswer) distractors.add(t);
      }

      // 从其他分类补充同后缀词条 (如同为 -ing)
      if (distractors.size < 3) {
        const otherGrammar = allEntities.filter(e => {
          if (e.id === targetEntity.id || !e.answer) return false;
          const ans = e.answer.trim();
          if (ans === correctAnswer || distractors.has(ans)) return false;
          if (correctAnswer.endsWith('ing') && !ans.endsWith('ing')) return false;
          if (correctAnswer.endsWith('ed') && !ans.endsWith('ed')) return false;
          return true;
        }).sort(() => Math.random() - 0.5);

        for (const og of otherGrammar) {
          if (distractors.size >= 3) break;
          distractors.add(og.answer.trim());
        }
      }
    } else {
      // 概念题库：跨分类概念采样 (优先同 Layer 难度层概念)
      const sameLayerOthers = allEntities.filter(e => 
        e.id !== targetEntity.id &&
        (e.layer || 1) === (targetEntity.layer || 1) &&
        e.answer &&
        e.answer.trim() !== correctAnswer &&
        !distractors.has(e.answer.trim())
      ).sort(() => Math.random() - 0.5);

      for (const o of sameLayerOthers) {
        if (distractors.size >= 3) break;
        distractors.add(o.answer.trim());
      }
    }

    // 全库采样最后补齐
    if (distractors.size < 3) {
      const allOthers = allEntities.filter(e => 
        e.id !== targetEntity.id &&
        e.answer &&
        e.answer.trim() !== correctAnswer &&
        !distractors.has(e.answer.trim())
      ).sort(() => Math.random() - 0.5);

      for (const o of allOthers) {
        if (distractors.size >= 3) break;
        distractors.add(o.answer.trim());
      }
    }
  }

  // 极小题库硬兜底 (防止题库少于 4 个实体时无法凑齐选项)
  let fallbackCounter = 1;
  while (distractors.size < 3) {
    distractors.add(`备选项 ${fallbackCounter++}`);
  }

  // ==================== Stage 4: 数组洗牌并输出 ====================
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
