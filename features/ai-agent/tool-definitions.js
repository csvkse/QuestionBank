/**
 * AI Agent Knowledge Deck Tool Schemas (10 CRUD Tools)
 * Core 2.1: features/ai-agent/tool-definitions.js
 */

export const DECK_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'tool_list_decks',
      description: '获取当前系统内所有可用题库的清单、分类数、词条总数与健康度。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_get_deck',
      description: '通过题库 ID 查询其完整的分类、分层及全部考点词条。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string', description: '题库唯一标识符' } },
        required: ['deckId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_create_deck',
      description: '创建全新题库。每个分类推荐包含 >=4 个词条以满足四选一同胞干扰项硬门禁。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '题库名称' },
          icon: { type: 'string', description: '题库 Emoji 图标' },
          description: { type: 'string', description: '简要描述' },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, name: { type: 'string' }, group: { type: 'string' } },
              required: ['id', 'name']
            }
          },
          layers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { level: { type: 'integer' }, name: { type: 'string' } },
              required: ['level', 'name']
            }
          },
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                categoryId: { type: 'string' },
                layer: { type: 'integer' },
                title: { type: 'string' },
                prompt: { type: 'string' },
                answer: { type: 'string' },
                explanation: { type: 'string' },
                pitfalls: { type: 'string' }
              },
              required: ['id', 'categoryId', 'layer', 'title', 'prompt', 'answer']
            }
          }
        },
        required: ['title', 'categories', 'entities']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_update_deck_meta',
      description: '修改指定题库的标题、图标或简介。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string' },
          title: { type: 'string' },
          icon: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['deckId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_delete_deck',
      description: '删除用户自定义题库及其答题记录。受保护的系统预设题库将被拒绝。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string' } },
        required: ['deckId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_add_entities',
      description: '向指定题库中批量追加新考点词条。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string' },
          entities: { type: 'array' }
        },
        required: ['deckId', 'entities']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_update_entity',
      description: '修改指定题库中特定词条的内容（题干、标准答案、易错陷阱说明或解析）。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string' },
          entityId: { type: 'string' },
          updates: { type: 'object' }
        },
        required: ['deckId', 'entityId', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_delete_entity',
      description: '从题库中删除单个指定词条。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string' }, entityId: { type: 'string' } },
        required: ['deckId', 'entityId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_search_entities',
      description: '在所有题库或特定题库中模糊检索词条与易错陷阱。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, deckId: { type: 'string' } },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_import_markdown_deck',
      description: '将符合大纲 AST 语法的 Markdown 文本解析并编译入库为新题库。',
      parameters: {
        type: 'object',
        properties: { markdownText: { type: 'string' } },
        required: ['markdownText']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_get_deck_guide',
      description: '获取指定题库的系统化知识导学图与核心全景概览。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string', description: '题库唯一标识符' } },
        required: ['deckId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_update_deck_guide',
      description: '为题库配置或更新系统化知识导学页（包含全景摘要与 Markdown 知识框架）。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string', description: '题库唯一标识符' },
          guide: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: '知识体系一句话或段落全景摘要' },
              markdown: { type: 'string', description: '系统化 Markdown 导学知识内容，支持考点链接与分类图解' }
            },
            required: ['summary', 'markdown']
          }
        },
        required: ['deckId', 'guide']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_delete_deck_guide',
      description: '清空并重置指定题库的体系化导学页。',
      parameters: { type: 'object', properties: { deckId: { type: 'string' } }, required: ['deckId'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_patch_deck_guide',
      description: '对题库导学大纲进行增量修补（追加板块、替换指定章节或更新一句话认知摘要）。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string' },
          operation: { type: 'string', enum: ['append_section', 'replace_section', 'update_summary'] },
          heading: { type: 'string', description: '章节标题' },
          content: { type: 'string', description: 'Markdown 章节内容' },
          summary: { type: 'string', description: '一句话认知图式摘要' }
        },
        required: ['deckId', 'operation']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_batch_update_entities',
      description: '原子批量更新题库中的考点词条属性（题干、答案、解析、陷阱、层级）。',
      parameters: {
        type: 'object',
        properties: {
          deckId: { type: 'string' },
          updates: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
          mode: { type: 'string', enum: ['atomic_strict', 'best_effort'] }
        },
        required: ['deckId', 'updates']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_batch_delete_entities',
      description: '原子批量删除题库中的考点词条，自动进行同胞干扰项门禁校验。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string' }, entityIds: { type: 'array', items: { type: 'string' } } },
        required: ['deckId', 'entityIds']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_list_deck_versions',
      description: '查询指定题库的历史版本快照列表（包含生成时间、作者与变更摘要）。',
      parameters: { type: 'object', properties: { deckId: { type: 'string' } }, required: ['deckId'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_rollback_deck_version',
      description: '一键将题库回滚至历史版本快照，并在回滚前自动备份当前状态。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string' }, versionId: { type: 'string' } },
        required: ['deckId', 'versionId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'tool_create_deck_snapshot',
      description: '在执行关键业务变更前对题库进行手动打桩备份。',
      parameters: {
        type: 'object',
        properties: { deckId: { type: 'string' }, note: { type: 'string', description: '快照说明' } },
        required: ['deckId', 'note']
      }
    }
  }
];

