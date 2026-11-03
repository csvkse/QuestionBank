/**
 * EduGraph-Native 3.0: Assessment Probe Visitor Engine
 * Core 2.1: shared/edugraph/edugraph-visitors.js
 * 
 * Compiles dynamic cognitive probes (quizzes) directly from graph topology:
 * - InterleavedSprintVisitor: CapsuleNode -> Interleaved Verification Probe Batch
 * - DiscriminationProbeVisitor: CONTRASTS_WITH Edge -> High-Discrimination Probe
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export class AssessmentProbeVisitor {
  visitGraph(graph) {
    throw new Error('visitGraph must be implemented by subclass');
  }
}

export class InterleavedSprintVisitor extends AssessmentProbeVisitor {
  constructor(capsuleId) {
    super();
    this.capsuleId = String(capsuleId);
  }

  visitGraph(graph) {
    const capsule = graph.getCapsule(this.capsuleId);
    if (!capsule) {
      throw new Error(`微考点胶囊 "${this.capsuleId}" 不存在于知识图谱中`);
    }

    const concepts = capsule.conceptIds.map(id => graph.getNode(id)).filter(Boolean);
    if (concepts.length < 2) {
      throw new Error(`微考点胶囊 "${this.capsuleId}" 内有效概念不足 2 个，无法编译交错微测`);
    }

    const probes = [];

    for (let i = 0; i < concepts.length; i++) {
      const target = concepts[i];
      // 干扰项优先取同一胶囊内的其他同胞概念
      let siblingCandidates = concepts.filter(c => c.id !== target.id);

      // 若同胞少于 3 个，通过 CONTRASTS_WITH 出度边进一步丰富干扰项
      if (siblingCandidates.length < 3) {
        const contrastSiblings = graph.getContrastSiblings(target.id);
        for (const cs of contrastSiblings) {
          if (!siblingCandidates.some(s => s.id === cs.id) && cs.id !== target.id) {
            siblingCandidates.push(cs);
          }
        }
      }

      const distractorNames = siblingCandidates.map(c => c.name);
      // 选取最多 3 个干扰项
      const chosenDistractors = distractorNames.slice(0, 3);
      const options = [target.name, ...chosenDistractors];

      // Fisher-Yates 伪随机洗牌 (保留正确答案索引)
      for (let j = options.length - 1; j > 0; j--) {
        const rand = Math.floor(Math.random() * (j + 1));
        [options[j], options[rand]] = [options[rand], options[j]];
      }

      const correctIndex = options.indexOf(target.name);

      probes.push({
        id: `probe_${capsule.id}_${target.id}`,
        targetId: target.id,
        targetName: target.name,
        prompt: `【微考点微测】以下哪一项是关于“${target.definition}”的核心概念？`,
        definition: target.definition,
        options,
        correctAnswer: target.name,
        correctIndex,
        layer: target.layer,
        dimension: target.properties?.dimension || '概念定义辨析'
      });
    }

    return probes;
  }
}

export class DiscriminationProbeVisitor extends AssessmentProbeVisitor {
  constructor(sourceId, targetId) {
    super();
    this.sourceId = String(sourceId);
    this.targetId = String(targetId);
  }

  visitGraph(graph) {
    const source = graph.getNode(this.sourceId);
    const target = graph.getNode(this.targetId);
    if (!source || !target) {
      throw new Error(`对偶概念节点不存在: ${this.sourceId} 或 ${this.targetId}`);
    }

    const outEdges = graph.outgoing.get(this.sourceId) || [];
    const contrastEdge = outEdges.find(e => e.type === 'CONTRASTS_WITH' && e.target === this.targetId);

    const dimension = contrastEdge?.properties?.dimension || '核心区别与应用边界';

    return {
      id: `probe_contrast_${this.sourceId}_${this.targetId}`,
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: 'DISCRIMINATION_PROBE',
      dimension,
      prompt: `【对偶深度辨析】在维度 [${dimension}] 上，关于“${source.name}”与“${target.name}”的本质区别，以下表述正确的是？`,
      sourceDefinition: source.definition,
      targetDefinition: target.definition,
      sourceName: source.name,
      targetName: target.name,
      phoneticsSource: source.phonetics,
      phoneticsTarget: target.phonetics
    };
  }
}
