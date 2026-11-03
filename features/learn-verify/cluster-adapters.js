/**
 * Learn & Verify Topic Capsule Adapter (Adapter Pattern)
 * Core: features/learn-verify/cluster-adapters.js
 * 
 * Aggregates individual entities into cohesive Micro-Topic Knowledge Capsules
 * containing comparative matrices and interleaved quiz sets.
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export class KnowledgeCapsule {
  constructor({
    id,
    title,
    groupName,
    categoryName,
    layer = 1,
    entities = [],
    comparativeMatrix = [],
    questions = []
  }) {
    this.id = id;
    this.title = title;
    this.groupName = groupName;
    this.categoryName = categoryName;
    this.layer = layer;
    this.entities = entities;
    this.comparativeMatrix = comparativeMatrix;
    this.questions = questions;
  }
}

export class TopicCapsuleAdapter {
  /**
   * 提炼单个实体的核心助记锚点与易错特征
   */
  static extractMnemonicAnchor(entity) {
    if (entity.anchor) return entity.anchor;
    if (entity.explanation) {
      // 提取前 25 个字符作为关键锚点提炼
      const firstSentence = entity.explanation.split(/[。！？\n]/)[0].trim();
      return firstSentence.length > 28 ? firstSentence.slice(0, 25) + '...' : firstSentence;
    }
    return entity.answer || '';
  }

  /**
   * 提炼易混淆陷阱警示
   */
  static extractPitfall(entity, siblingEntities = []) {
    if (entity.pitfalls) return entity.pitfalls;
    if (entity.confusedWith) {
      return `极易与同胞概念【${entity.confusedWith}】混淆，注意语义分界`;
    }
    const other = siblingEntities.find(s => s.id !== entity.id);
    if (other) {
      return `辨析对照：注意与【${other.title}】的定义差异`;
    }
    return '考点重点：注意识别边界条件';
  }

  /**
   * 构建微考点全景横向对比矩阵 (Synoptic Comparative Matrix)
   */
  static buildComparativeMatrix(entities = []) {
    return entities.map((ent, idx) => {
      return {
        index: idx,
        id: ent.id,
        title: ent.title,
        prompt: ent.prompt || '核心释义与特征',
        answer: ent.answer || '',
        anchor: this.extractMnemonicAnchor(ent),
        pitfall: this.extractPitfall(ent, entities),
        explanation: ent.explanation || '',
        layer: ent.layer || 1
      };
    });
  }

  /**
   * 将指定 Category 与 Layer 的实体群适配为微考点胶囊
   */
  static adapt(categoryName, layer, entities, deckState = {}, generatedQuestions = []) {
    if (!Array.isArray(entities) || entities.length === 0) return null;

    const cards = deckState.cards || {};
    const groupName = entities[0].group || '核心知识域';
    const id = `capsule_${groupName}_${categoryName}_l${layer}`.replace(/[\s/\\.]+/g, '_');

    // 附带熟练度与初学状态
    const enrichedEntities = entities.map(ent => {
      const card = cards[ent.id] || { level: 0, attempts: 0, repetitions: 0 };
      const isNew = card.attempts === 0 || card.level === 0;
      return {
        ...ent,
        cardState: card,
        isNew
      };
    });

    const comparativeMatrix = this.buildComparativeMatrix(enrichedEntities);

    return new KnowledgeCapsule({
      id,
      title: `${categoryName} · 核心考点群`,
      groupName,
      categoryName,
      layer,
      entities: enrichedEntities,
      comparativeMatrix,
      questions: generatedQuestions
    });
  }
}
