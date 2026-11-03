/**
 * EduGraph-Native 3.0: First-Principles Educational Property Graph Engine
 * Core 2.1: shared/edugraph/edugraph-model.js
 * 
 * In-memory heterogenous directed property graph with:
 * - O(1) bi-directional adjacency hash maps
 * - Kahn's Algorithm DAG cycle prevention guard (PREREQUISITE_OF)
 * - Cascading mutation policy preventing dangling edges
 * - Visitor Pattern support for dynamic assessment probes
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export class ConceptNode {
  constructor({ id, name, definition, phonetics = {}, layer = 1, taxonomyId = null, properties = {} }) {
    if (!id || !name) throw new Error('ConceptNode requires id and name');
    this.id = String(id);
    this.name = String(name);
    this.definition = String(definition || '');
    this.phonetics = {
      text: phonetics.text || name,
      ipa: phonetics.ipa || '',
      lang: phonetics.lang || 'en-US',
      tts_clean: phonetics.tts_clean || name
    };
    this.layer = Number(layer) || 1;
    this.taxonomyId = taxonomyId ? String(taxonomyId) : null;
    this.properties = { ...properties };
  }
}

export class CapsuleNode {
  constructor({ id, title, taxonomyId, layer = 1, conceptIds = [], properties = {} }) {
    if (!id || !title) throw new Error('CapsuleNode requires id and title');
    this.id = String(id);
    this.title = String(title);
    this.taxonomyId = taxonomyId ? String(taxonomyId) : null;
    this.layer = Number(layer) || 1;
    this.conceptIds = Array.isArray(conceptIds) ? conceptIds.map(String) : [];
    this.properties = { ...properties };
  }
}

export class EduGraphEdge {
  constructor({ id, source, target, type, properties = {} }) {
    if (!source || !target || !type) throw new Error('EduGraphEdge requires source, target, and type');
    this.id = id ? String(id) : `${source}_${type}_${target}`;
    this.source = String(source);
    this.target = String(target);
    this.type = String(type); // 'CONTRASTS_WITH' | 'PREREQUISITE_OF'
    this.properties = { ...properties };
  }
}

export class EduGraph {
  constructor({ id = 'default_graph', title = 'EduGraph', defaultLocale = 'zh-CN' } = {}) {
    this.id = id;
    this.title = title;
    this.defaultLocale = defaultLocale;
    this.nodes = new Map();
    this.capsules = new Map();
    this.outgoing = new Map(); // nodeId -> Array<EduGraphEdge>
    this.incoming = new Map(); // nodeId -> Array<EduGraphEdge>
  }

  addNode(nodeData) {
    const node = nodeData instanceof ConceptNode ? nodeData : new ConceptNode(nodeData);
    this.nodes.set(node.id, node);
    if (!this.outgoing.has(node.id)) this.outgoing.set(node.id, []);
    if (!this.incoming.has(node.id)) this.incoming.set(node.id, []);
    return node;
  }

  getNode(nodeId) {
    return this.nodes.get(String(nodeId)) || null;
  }

  addCapsule(capsuleData) {
    const capsule = capsuleData instanceof CapsuleNode ? capsuleData : new CapsuleNode(capsuleData);
    this.capsules.set(capsule.id, capsule);
    return capsule;
  }

  getCapsule(capsuleId) {
    return this.capsules.get(String(capsuleId)) || null;
  }

  addEdge(edgeData) {
    const edge = edgeData instanceof EduGraphEdge ? edgeData : new EduGraphEdge(edgeData);
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`悬垂边拒绝: 节点 "${edge.source}" 或 "${edge.target}" 不存在于图谱中`);
    }

    // 拓扑无环强校验门禁：对 PREREQUISITE_OF 关系执行环路侦测
    if (edge.type === 'PREREQUISITE_OF') {
      if (edge.source === edge.target) {
        throw new Error(`拓扑死锁: 节点 "${edge.source}" 不能以前置依赖指向自身`);
      }
      if (this._wouldCreateCycle(edge.source, edge.target)) {
        throw new Error(`拓扑死锁: 添加前置依赖 ${edge.source} -> ${edge.target} 会在知识图谱中形成环路闭环`);
      }
    }

    // O(1) 索引注入
    const outList = this.outgoing.get(edge.source) || [];
    outList.push(edge);
    this.outgoing.set(edge.source, outList);

    const inList = this.incoming.get(edge.target) || [];
    inList.push(edge);
    this.incoming.set(edge.target, inList);

    return edge;
  }

  _wouldCreateCycle(source, target) {
    // 检查从 target 顺着 PREREQUISITE_OF 是否能够反向到达 source
    const visited = new Set();
    const queue = [target];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr === source) return true;
      if (!visited.has(curr)) {
        visited.add(curr);
        const nextEdges = this.outgoing.get(curr) || [];
        for (const e of nextEdges) {
          if (e.type === 'PREREQUISITE_OF') {
            queue.push(e.target);
          }
        }
      }
    }
    return false;
  }

  removeNode(nodeId) {
    const id = String(nodeId);
    if (!this.nodes.has(id)) return false;

    // 级联变更管理：熔断所有出入度边
    const outEdges = this.outgoing.get(id) || [];
    for (const e of outEdges) {
      const inList = this.incoming.get(e.target) || [];
      this.incoming.set(e.target, inList.filter(x => x.id !== e.id));
    }
    this.outgoing.delete(id);

    const inEdges = this.incoming.get(id) || [];
    for (const e of inEdges) {
      const outList = this.outgoing.get(e.source) || [];
      this.outgoing.set(e.source, outList.filter(x => x.id !== e.id));
    }
    this.incoming.delete(id);

    // 级联清理胶囊内的节点引用
    for (const capsule of this.capsules.values()) {
      capsule.conceptIds = capsule.conceptIds.filter(cid => cid !== id);
    }

    this.nodes.delete(id);
    return true;
  }

  getContrastSiblings(nodeId) {
    const id = String(nodeId);
    const edges = this.outgoing.get(id) || [];
    const contrastIds = edges.filter(e => e.type === 'CONTRASTS_WITH').map(e => e.target);
    return contrastIds.map(cid => this.nodes.get(cid)).filter(Boolean);
  }

  getPrerequisites(nodeId) {
    const id = String(nodeId);
    const edges = this.incoming.get(id) || [];
    const prereqIds = edges.filter(e => e.type === 'PREREQUISITE_OF').map(e => e.source);
    return prereqIds.map(pid => this.nodes.get(pid)).filter(Boolean);
  }

  accept(visitor) {
    if (!visitor || typeof visitor.visitGraph !== 'function') {
      throw new Error('Visitor must implement visitGraph method');
    }
    return visitor.visitGraph(this);
  }
}
