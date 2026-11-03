/**
 * AI Agent Runtime Telemetry & Game Mode Specifications Tool Schemas
 * Core 2.1: features/ai-agent/runtime-tool-definitions.js
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export const RUNTIME_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'tool_get_runtime_context',
      description: '获取当前前端运行时的全景态势（当前激活的视图、游戏模式/学练模式、当前题库信息、薄弱考点遥测及各分类健康度）。用于感知学习者当前处于哪种游戏模式（天梯、微考点冲关、沙盒等），以便更有针对性地构建或补充题库。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_get_mode_specifications',
      description: '查询前端所有竞技试炼模式与知识库模式的数据契约与结构要求（例如微考点学练需要 3~5 个同胞实体且具备对偶差异；天梯模式需要 Layer 1/2/3 认知梯度；自由沙盒需要 group 分组）。',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['ALL', 'CLUSTER_LEARN_VERIFY', 'LADDER', 'BLITZ', 'SURVIVAL', 'STEPPED', 'WEAKNESS', 'FREE_LAB', 'KNOWLEDGE_GUIDE'],
            description: '可选，查询指定模式的代码契约。默认返回全部'
          }
        },
        required: []
      }
    }
  }
];
