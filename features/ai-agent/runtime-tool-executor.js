/**
 * AI Agent Runtime Telemetry & Game Mode Specifications Executor
 * Core 2.1: features/ai-agent/runtime-tool-executor.js
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export function isRuntimeTool(toolName) {
  return toolName === 'tool_get_runtime_context' || toolName === 'tool_get_mode_specifications';
}

const MODE_CONTRACTS = {
  CLUSTER_LEARN_VERIFY: {
    name: '微考点胶囊化·学练一体模式',
    category: '新知学练与深度研读',
    structureRequirements: {
      clusterSize: '每个分类推荐包含 3~5 个同胞考点实体，构成完整的微考点胶囊',
      contrastNUANCE: '同胞考点之间应具备显式对偶差异（如 301 永久 vs 302 临时），便于矩阵对比研读',
      layers: '支持 Layer 1（基础）、Layer 2（进阶）、Layer 3（高阶）按层学练',
      anchorAndPitfall: '考点实体推荐包含 prompt（记忆锚点）与 pitfalls（易混淆陷阱），用于交错微测'
    },
    quizMechanism: '全同胞实体互斥伪随机交错微测（Interleaved Verification），就地靶向对偶纠偏'
  },
  LADDER: {
    name: '天梯排位模式 (Ladder Progression)',
    category: '竞技试炼',
    structureRequirements: {
      layers: '题库必须包含明确的 Layer 1/2/3 认知梯度分层',
      distractorPool: '每个分类必须 >= 4 个实体，确保 4 选 1 同胞干扰项不降级'
    },
    quizMechanism: '从基础到高阶梯度晋级，胜率加星，错题扣星'
  },
  BLITZ: {
    name: '极速狂飙模式 (Speed Sprint)',
    category: '竞技试炼',
    structureRequirements: {
      conciseness: '题干 (title/prompt) 宜简练，答案 (answer) 明确，适合 10 秒倒计时'
    },
    quizMechanism: '限时 10 秒，快速提取，连击 Combo 积分倍增'
  },
  SURVIVAL: {
    name: '生存死斗模式 (Hardcore Survival)',
    category: '竞技试炼',
    structureRequirements: {
      discriminability: '干扰项需具备强混淆性，避免明显常识破绽'
    },
    quizMechanism: '一命通关或固定血量，错误立即扣除生命值'
  },
  STEPPED: {
    name: '分层递进试炼 (Stepped Practice)',
    category: '专项进阶',
    structureRequirements: {
      layers: '每个层级题量均匀分布，推荐 Layer 1 (50%) + Layer 2 (35%) + Layer 3 (15%)'
    },
    quizMechanism: '按认知层级线性解锁，稳扎稳打'
  },
  WEAKNESS: {
    name: '弱点攻坚模式 (Targeted Weakness Focus)',
    category: '错题复习',
    structureRequirements: {
      pitfalls: '考点建议填充 pitfalls 与 explanation，强化错题反思'
    },
    quizMechanism: '优先调度历史错题与 SM-2 稳定度最低的边缘实体'
  },
  FREE_LAB: {
    name: '自由沙盒工作台 (Free Sandbox)',
    category: '自由试炼',
    structureRequirements: {
      groupTaxonomy: '分类需包含清晰的 group 大组标签，支持大组级批量勾选'
    },
    quizMechanism: '支持自由多选分类、调节题量、切换自测/攻坚/极速'
  },
  KNOWLEDGE_GUIDE: {
    name: '体系知识导读 (Systemic Knowledge Guide)',
    category: '导学心智',
    structureRequirements: {
      guideMarkdown: '题库需包含 guide 导学文本，含高阶上位先行组织者（Advance Organizer）与体系图'
    },
    quizMechanism: '研读图式心智模型，并可一键跳转考点针对性试炼'
  }
};

export function executeRuntimeTool(app, toolName, args = {}) {
  if (toolName === 'tool_get_mode_specifications') {
    const requestedMode = (args.mode || 'ALL').toUpperCase();
    if (requestedMode === 'ALL') {
      return { status: 'success', modes: MODE_CONTRACTS };
    }
    const found = MODE_CONTRACTS[requestedMode];
    if (!found) {
      return {
        status: 'error',
        message: `未知模式 "${args.mode}"。可用模式: ${Object.keys(MODE_CONTRACTS).join(', ')}`
      };
    }
    return { status: 'success', mode: requestedMode, specification: found };
  }

  if (toolName === 'tool_get_runtime_context') {
    const currentView = app.currentView || (app.router && app.router.currentView) || 'dashboard';
    const activeDeck = app.getActiveDeck ? app.getActiveDeck() : null;
    const deckState = activeDeck && app.getDeckState ? app.getDeckState(activeDeck.id) : null;

    // 推断当前游戏/研读模式
    let activeMode = 'DEFAULT';
    let capsuleDetails = null;

    if (app.clusterController && app.clusterController.fsm) {
      activeMode = 'CLUSTER_LEARN_VERIFY';
      const cap = app.clusterController.fsm.getCurrentCapsule?.();
      if (cap) {
        capsuleDetails = {
          capsuleId: cap.id,
          title: cap.title,
          categoryName: cap.categoryName,
          groupName: cap.groupName,
          layer: cap.layer,
          conceptCount: (cap.entities || []).length,
          currentQuestionIndex: app.clusterController.fsm.currentQuestionIndex || 0
        };
      }
    } else if (app.currentView === 'quiz' || app.currentView === 'arena') {
      activeMode = app.quizRunner?.mode || (app.arena && app.arena.mode) || 'LADDER';
    } else if (app.currentView === 'sandbox') {
      activeMode = 'FREE_LAB';
    } else if (app.currentView === 'guide') {
      activeMode = 'KNOWLEDGE_GUIDE';
    }

    // 统计弱点遥测与分类健康度
    const thinCategories = [];
    let unmasteredCount = 0;
    let totalAttempts = 0;
    let totalCorrect = 0;

    if (activeDeck) {
      const catCountMap = {};
      (activeDeck.entities || []).forEach(e => {
        catCountMap[e.categoryId] = (catCountMap[e.categoryId] || 0) + 1;
      });

      (activeDeck.categories || []).forEach(cat => {
        const count = catCountMap[cat.id] || 0;
        if (count < 4) {
          thinCategories.push({ id: cat.id, name: cat.name, count, gap: 4 - count });
        }
      });

      if (deckState) {
        totalAttempts = deckState.totalAttempts || 0;
        totalCorrect = deckState.totalCorrect || 0;
        const cards = deckState.cards || {};
        (activeDeck.entities || []).forEach(e => {
          const card = cards[e.id];
          if (!card || (card.interval || 0) < 2) {
            unmasteredCount++;
          }
        });
      }
    }

    const accuracyRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return {
      status: 'success',
      runtime: {
        currentView,
        activeMode,
        activeDeck: activeDeck ? {
          id: activeDeck.id,
          title: activeDeck.title,
          categoriesCount: (activeDeck.categories || []).length,
          entitiesCount: (activeDeck.entities || []).length
        } : null,
        activeCapsule: capsuleDetails,
        telemetry: {
          totalAttempts,
          totalCorrect,
          accuracyRate: `${accuracyRate}%`,
          unmasteredCount,
          thinCategoriesCount: thinCategories.length,
          thinCategoriesNotice: thinCategories.slice(0, 5)
        },
        recommendedNextStep: thinCategories.length > 0
          ? `当前题库有 ${thinCategories.length} 个分类实体少于 4 个，建议为分类补充考点以满足四选题干扰项契约。`
          : activeMode === 'CLUSTER_LEARN_VERIFY'
            ? '学习者正在微考点学练冲关，可为其提供对偶概念对比提示或生成针对性胶囊。'
            : '当前题库健康度良好，可根据模式生成进阶考点。'
      }
    };
  }

  throw new Error(`未知运行时工具: ${toolName}`);
}
