/**
 * Learn & Verify Micro-Topic Progression & Interleaved Strategies (Strategy Pattern)
 * Core: features/learn-verify/cluster-strategies.js
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { TopicCapsuleAdapter } from './cluster-adapters.js';

/**
 * 策略 1：微考点交错微测生成策略 (Interleaved Sibling Quiz Strategy)
 * 强制优先提取本考点同胞实体作为互斥干扰项，消除单题死记硬背
 */
export class InterleavedClusterQuizStrategy {
  /**
   * Fisher-Yates 洗牌算法
   */
  static shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * 为实体生成 4 个选项（优先使用本考点兄弟实体）
   */
  static generateIntraClusterOptions(targetEntity, clusterEntities = [], allDeckEntities = []) {
    const correctAnswer = targetEntity.answer || targetEntity.title;
    const siblingDistractors = [];

    // 1. 优先提取当前考点内的其他同胞实体
    clusterEntities.forEach(sib => {
      if (sib.id !== targetEntity.id) {
        const text = sib.answer || sib.title;
        if (text && text !== correctAnswer && !siblingDistractors.includes(text)) {
          siblingDistractors.push(text);
        }
      }
    });

    // 2. 若同胞不足 3 个，从全题库相同分类或大组补充
    if (siblingDistractors.length < 3) {
      const candidates = allDeckEntities.filter(e => 
        e.id !== targetEntity.id && 
        (e.category === targetEntity.category || e.group === targetEntity.group)
      );
      for (const cand of candidates) {
        const text = cand.answer || cand.title;
        if (text && text !== correctAnswer && !siblingDistractors.includes(text)) {
          siblingDistractors.push(text);
          if (siblingDistractors.length >= 3) break;
        }
      }
    }

    // 3. 兜底回退补充
    if (siblingDistractors.length < 3) {
      for (const cand of allDeckEntities) {
        const text = cand.answer || cand.title;
        if (text && text !== correctAnswer && !siblingDistractors.includes(text)) {
          siblingDistractors.push(text);
          if (siblingDistractors.length >= 3) break;
        }
      }
    }

    // 截取前 3 个干扰项并混洗
    const finalDistractors = siblingDistractors.slice(0, 3);
    const allOptions = this.shuffle([correctAnswer, ...finalDistractors]);
    const correctIndex = allOptions.indexOf(correctAnswer);

    return {
      options: allOptions,
      correctIndex,
      correctAnswer
    };
  }

  /**
   * 为考点生成交错测试题组
   */
  static generateBatch(clusterEntities = [], allDeckEntities = []) {
    if (!Array.isArray(clusterEntities) || clusterEntities.length === 0) return [];

    // 洗牌出题顺序，形成交错效应
    const shuffledTargets = this.shuffle(clusterEntities);

    return shuffledTargets.map((target, qIdx) => {
      const { options, correctIndex, correctAnswer } = this.generateIntraClusterOptions(
        target,
        clusterEntities,
        allDeckEntities
      );

      return {
        id: `q_${target.id}_${qIdx}`,
        targetEntityId: target.id,
        targetTitle: target.title,
        prompt: target.prompt || `请根据定义选择对应的考点特征：`,
        explanation: target.explanation || '',
        options,
        correctIndex,
        correctAnswer,
        category: target.category,
        layer: target.layer || 1
      };
    });
  }
}

/**
 * 策略 2：自然分类与认知层级微考点聚类推进策略
 */
export class TaxonomyCapsuleProgressionStrategy {
  constructor(targetLayer = 1, options = {}) {
    this.targetLayer = targetLayer;
    this.maxCapsules = options.maxCapsules || 6;
    this.targetChunkSize = options.targetChunkSize || 4;
  }

  /**
   * 提炼并构建所有微考点胶囊
   */
  prepareCapsules(deck, deckState = {}) {
    if (!deck || !Array.isArray(deck.entities)) return [];

    // 1. 过滤当前目标层级实体
    const entities = deck.entities.filter(e => (e.layer || 1) === this.targetLayer);
    const cards = deckState.cards || {};

    // 2. 按 category 分组
    const categoryMap = new Map();
    entities.forEach(ent => {
      const cat = ent.category || '核心考点';
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat).push(ent);
    });

    const capsules = [];

    categoryMap.forEach((catEntities, catName) => {
      // 若实体过多 (> 6)，分片拆解为 Part 1 与 Part 2
      if (catEntities.length > 6) {
        const half = Math.ceil(catEntities.length / 2);
        const chunk1 = catEntities.slice(0, half);
        const chunk2 = catEntities.slice(half);

        const qBatch1 = InterleavedClusterQuizStrategy.generateBatch(chunk1, deck.entities);
        const cap1 = TopicCapsuleAdapter.adapt(`${catName} (Part 1)`, this.targetLayer, chunk1, deckState, qBatch1);
        if (cap1) capsules.push(cap1);

        const qBatch2 = InterleavedClusterQuizStrategy.generateBatch(chunk2, deck.entities);
        const cap2 = TopicCapsuleAdapter.adapt(`${catName} (Part 2)`, this.targetLayer, chunk2, deckState, qBatch2);
        if (cap2) capsules.push(cap2);
      } else {
        const qBatch = InterleavedClusterQuizStrategy.generateBatch(catEntities, deck.entities);
        const cap = TopicCapsuleAdapter.adapt(catName, this.targetLayer, catEntities, deckState, qBatch);
        if (cap) capsules.push(cap);
      }
    });

    // 3. 排序策略：包含新考点最多或平均熟练度最低的胶囊排在最前
    capsules.sort((a, b) => {
      const newCountA = a.entities.filter(e => e.isNew).length;
      const newCountB = b.entities.filter(e => e.isNew).length;
      if (newCountA !== newCountB) return newCountB - newCountA;

      const avgLevelA = a.entities.reduce((acc, e) => acc + (cards[e.id]?.level || 0), 0) / a.entities.length;
      const avgLevelB = b.entities.reduce((acc, e) => acc + (cards[e.id]?.level || 0), 0) / b.entities.length;
      return avgLevelA - avgLevelB;
    });

    return capsules.slice(0, this.maxCapsules);
  }
}
