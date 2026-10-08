/**
 * Knowledge Deck Health & Capacity Validator (5-3-10 Scale Rule)
 * Core: shared/deck-validator.js
 */

/**
 * 校验题库对象的健康度与约束合规性
 * @param {Object} draft - 待校验题库对象
 * @returns {Object} { valid, errors, warnings, thinCategories }
 */
export function validateDeckHealth(draft) {
  const errors = [];
  const warnings = [];
  const thinCategories = [];

  if (!draft) {
    return { valid: false, errors: ['题库数据为空'], warnings: [], thinCategories: [] };
  }

  // 1. 基础信息校验
  if (!draft.title || !draft.title.trim()) {
    errors.push('知识库标题不能为空');
  } else if (draft.title.length > 30) {
    errors.push('知识库标题不能超过 30 个字');
  }

  // 2. 分类数量限制 (认知负荷上限 25 个)
  const cats = draft.categories || [];
  if (cats.length === 0) {
    errors.push('知识库至少需要包含 1 个分类板块');
  } else if (cats.length > 25) {
    errors.push(`分类数量 (${cats.length}) 超出 25 个上限，请拆分为独立题库`);
  } else if (cats.length > 15) {
    warnings.push(`分类数量已达 ${cats.length} 个，建议适当归并业务大组`);
  }

  // 3. 词条总数限制与最小有效题库量
  const ents = draft.entities || [];
  if (ents.length < 4) {
    errors.push(`总词条数必须至少 4 条（当前仅 ${ents.length} 条），不足以生成四选一干扰项`);
  } else if (ents.length > 500) {
    errors.push(`总词条数 (${ents.length}) 超过 500 条上限，请拆分子库以防卡顿`);
  } else if (ents.length > 300) {
    warnings.push(`词条数已达 ${ents.length} 条，建议分库以获得更好的艾宾浩斯复习节奏`);
  }

  // 4. 空白标题或空答案检查
  let emptyAnswerCount = 0;
  let emptyTitleCount = 0;
  ents.forEach(e => {
    if (!e.title || !e.title.trim()) emptyTitleCount++;
    if (!e.answer || !e.answer.trim()) emptyAnswerCount++;
  });
  if (emptyTitleCount > 0) errors.push(`存在 ${emptyTitleCount} 个标题为空的概念条目`);
  if (emptyAnswerCount > 0) errors.push(`存在 ${emptyAnswerCount} 个核心答案为空的概念条目`);

  // 5. 各分类条目健康度与薄弱分类扫描 (同胞池充盈度 >= 4)
  cats.forEach(cat => {
    const count = ents.filter(e => e.categoryId === cat.id).length;
    if (count < 4) {
      thinCategories.push({ catId: cat.id, name: cat.name, count });
    }
  });

  if (thinCategories.length > 0) {
    const names = thinCategories.map(t => `${t.name}(${t.count}条)`).join(', ');
    warnings.push(`发现 ${thinCategories.length} 个薄弱分类 [${names}]，条目少于4条将导致答题时同胞干扰项退火降级`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    thinCategories
  };
}
