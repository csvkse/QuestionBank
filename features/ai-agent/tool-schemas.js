/**
 * AI Agent Knowledge Deck Tool Schemas & Reusable Property Definitions
 * Core 2.1: features/ai-agent/tool-schemas.js
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { sanitizePronunciation } from '../../platform/audio/speech-synth.js';
import { validateDeckHealth } from '../../shared/deck-validator.js';

export const ENTITY_ITEM_SCHEMA = {
  type: 'object',
  description: '考点实体定义 (遵循同胞池充盈与四选一干扰项规范)',
  properties: {
    id: { type: 'string', description: '考点唯一标识符 (如 ja_ne 或 v_picnic)' },
    categoryId: { type: 'string', description: '所属分类ID (必须已在 categories 中声明)' },
    layer: { type: 'integer', enum: [1, 2, 3], description: '认知层级: 1基础直变/2规律运用/3反直觉陷阱' },
    title: { type: 'string', description: '纯净考点展示标题，切勿包含【】括号注解 (如 ね)' },
    subtitle: { type: 'string', description: '辅助说明或音标注音 (如 /ne/ · 罗马音 ne · 猫 neko)' },
    lang: { type: 'string', description: 'BCP 47 语言代码 (如 ja-JP, en-US, zh-CN, ko-KR)' },
    phonetics: {
      type: 'object',
      description: '多模态语音与注音元数据',
      properties: {
        ipa: { type: 'string', description: '国际音标' },
        romaji: { type: 'string', description: '罗马音/拼音' },
        tts_clean: { type: 'string', description: '纯净TTS发音词干' }
      }
    },
    prompt: { type: 'string', description: '题干设问指令 (如 转化为过去式：)' },
    answer: { type: 'string', description: '标准参考答案' },
    explanation: { type: 'string', description: '考点原理深度精析' },
    pitfalls: { type: 'string', description: '高频易错陷阱警示' },
    confusedWith: { type: 'string', description: '对偶混淆考点ID (如 ja_re)' }
  },
  required: ['id', 'categoryId', 'layer', 'title', 'prompt', 'answer']
};

export const ENTITY_PATCH_PROPS = {
  title: { type: 'string', description: '纯净展示标题 (不含括号注解)' },
  subtitle: { type: 'string', description: '辅助说明与音标' },
  prompt: { type: 'string', description: '设问指令' },
  answer: { type: 'string', description: '标准参考答案' },
  explanation: { type: 'string', description: '原理精析' },
  pitfalls: { type: 'string', description: '易错陷阱' },
  categoryId: { type: 'string', description: '所属分类ID' },
  layer: { type: 'integer', enum: [1, 2, 3], description: '认知层级1/2/3' },
  lang: { type: 'string', description: 'BCP 47语言代码' },
  phonetics: { type: 'object', description: '发音元数据 { ipa, romaji, tts_clean }' },
  confusedWith: { type: 'string', description: '对偶混淆考点ID' }
};

export const CANONICAL_TOOL_MAP = {
  list_decks: 'tool_list_decks',
  get_deck: 'tool_get_deck',
  create_deck: 'tool_create_deck',
  update_deck_meta: 'tool_update_deck_meta',
  delete_deck: 'tool_delete_deck',
  add_entities: 'tool_add_entities',
  update_entity: 'tool_update_entity',
  delete_entity: 'tool_delete_entity',
  search_entities: 'tool_search_entities',
  import_markdown_deck: 'tool_import_markdown_deck',
  get_deck_guide: 'tool_get_deck_guide',
  update_deck_guide: 'tool_update_deck_guide',
  delete_deck_guide: 'tool_delete_deck_guide',
  patch_deck_guide: 'tool_patch_deck_guide',
  batch_update_entities: 'tool_batch_update_entities',
  batch_delete_entities: 'tool_batch_delete_entities',
  list_deck_versions: 'tool_list_deck_versions',
  rollback_deck_version: 'tool_rollback_deck_version',
  create_deck_snapshot: 'tool_create_deck_snapshot',
  get_runtime_context: 'tool_get_runtime_context',
  get_mode_specifications: 'tool_get_mode_specifications'
};

export function normalizeToolName(name) {
  if (!name || typeof name !== 'string') return '';
  return CANONICAL_TOOL_MAP[name] || (name.startsWith('tool_') ? name : 'tool_' + name);
}

/**
 * 语义自愈适配器：对考点输入执行多态别名兼容与标题噪声清洗
 */
export function adaptEntityInput(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const e = { ...raw };
  if (e.question && !e.prompt) e.prompt = String(e.question);
  if (e.category && !e.categoryId) e.categoryId = String(e.category);
  if (e.title && typeof e.title === 'string') {
    const clean = sanitizePronunciation(e.title);
    if (clean && clean !== e.title) {
      if (!e.subtitle) e.subtitle = e.title;
      e.title = clean;
      e.phonetics = e.phonetics || {};
      if (!e.phonetics.tts_clean) e.phonetics.tts_clean = clean;
    }
  }
  return e;
}

/**
 * 工具入参自愈门面：在入参校验前执行别名兼容与噪声剥离
 */
export function adaptToolArgs(toolName, args) {
  if (!args || typeof args !== 'object') return args;
  const norm = normalizeToolName(toolName);
  const adapted = { ...args };
  if (norm === 'tool_add_entities' && Array.isArray(adapted.entities)) {
    adapted.entities = adapted.entities.map(adaptEntityInput);
  }
  if (norm === 'tool_update_entity' && adapted.updates) {
    adapted.updates = adaptEntityInput(adapted.updates);
  }
  if (norm === 'tool_batch_update_entities' && Array.isArray(adapted.updates)) {
    adapted.updates = adapted.updates.map(adaptEntityInput);
  }
  if (norm === 'tool_create_deck') {
    if (adapted.title && typeof adapted.title === 'string') {
      const clean = sanitizePronunciation(adapted.title);
      if (clean && clean !== adapted.title) adapted.title = clean;
    }
    if (Array.isArray(adapted.entities)) {
      adapted.entities = adapted.entities.map(adaptEntityInput);
    }
  }
  return adapted;
}

/**
 * ReAct 响应策略增强：为执行结果注入健康度态势快照与下一步行动建议
 */
export function enrichActionableResult(result, deck) {
  if (!deck || typeof result !== 'object') return result;
  const health = validateDeckHealth(deck);
  result.healthStatus = health.valid ? (health.warnings.length > 0 ? '需补充' : '健壮') : '异常';
  result.thinCategoriesNotice = health.thinCategories;
  result.suggestedNextActions = health.thinCategories.length > 0 ? [
    { tool: 'add_entities', args: { deckId: deck.id }, reason: `仍有 ${health.thinCategories.length} 个分类考点不足4条，建议继续补充` }
  ] : [
    { tool: 'get_deck_guide', args: { deckId: deck.id }, reason: '题库同胞池充盈健康，建议检查或配置导学大纲' },
    { tool: 'get_runtime_context', args: {}, reason: '确认当前学练试炼模式与学习队列' }
  ];
  return result;
}
