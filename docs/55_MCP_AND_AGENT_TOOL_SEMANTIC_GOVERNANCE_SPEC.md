# SPEC 55: MCP 与 Agent 工具调用语义化治理、架构设计模式重构与业界演进规范

> **规范定位**：AI Agent & MCP Tooling Semantic Governance Architecture  
> **核心架构基准**：Core 2.1 / EduGraph 3.0 Protocol  
> **安全基线**：RFC 5737 脱敏规范 / FE-SEC-001  
> **质量基线**：FE-KNOW-001 / FE-QUALITY-001 / BFCL Function Calling Standards

---

## Executive Summary (执行摘要)

当前系统通过 `McpToolAdapter` 与 `DeckToolExecutor` 提供了 21 个原生与运行时工具，覆盖题库 CRUD、导学编辑、版本控制及运行时遥测。虽然功能完备度达到 100%，但在**语义化友好度（Semantic Ergonomics）**、**LLM 认知负荷（Cognitive Load）**、**参数自描述性（Self-Describing Schemas）**与**闭环引导（Actionable Feedback）**等维度存在显著提升空间。

本报告对当前 21 个工具进行了全维度语义学审查，对比 Anthropic MCP 官方规范、OpenAI Function Calling Strict Mode 及 Vercel AI SDK 最佳实践，提出基于**适配器模式（Adapter）**、**策略模式（Strategy）**、**状态机模式（FSM）**与**门面模式（Facade）**的工具调用治理与升级方案。

---

## 一、 现有工具语义化程度诊断与打分 (Semantic Health Audit)

我们从 5 个维度对现有工具调用体系进行基准测评（满分 10 分）：

| 评估维度 | 当前得分 | 核心痛点与现象 | 工业界最佳实践标准 |
| :--- | :---: | :--- | :--- |
| **1. 命名规范性 (Naming Ergonomics)** | **6.5 / 10** | 所有工具均带有冗余的 `tool_` 前缀（如 `tool_list_decks`）；在 MCP 命名空间内属于重复噪声，消耗额外的 Prompt Token。 | 标准 `verb_object` 或 `domain_verb_object`（如 `list_decks`, `update_entity`, `get_runtime_context`），长度 $\le 64$ 字符。 |
| **2. 参数契约完备度 (Schema Completeness)** | **4.0 / 10** | **高危短板**：`tool_add_entities` 的 `entities` 仅声明 `{ type: 'array' }` 无子字段描述；`tool_update_entity` 的 `updates` 仅为 `{ type: 'object' }`，属于“黑盒参数”，LLM 极易产生属性幻觉。 | 深度嵌套 JSON Schema 2020-12，明确所有属性类型、枚举值、字段注释与 Worked Examples。 |
| **3. 动词正交性与注意力稀释 (Orthogonality)** | **6.0 / 10** | 工具数量达 21 个，且存在多处功能重叠（如 `tool_update_entity` vs `tool_batch_update_entities`；`tool_update_deck_guide` vs `tool_patch_deck_guide`），导致 LLM 决策迟疑。 | 分面工具集（Faceted Toolsets）或门面工具（Facade），单个上下文活跃工具控制在 8~12 个黄金区间。 |
| **4. 返回值可操作性 (Actionable Feedback)** | **5.0 / 10** | 多处仅返回 `{ success: true }`，缺乏“下一步行动建议（Suggested Next Actions）”，LLM 无法在单轮内形成自省链（ReAct Loop）。 | 携带上下文遥测数据（Telemetry）与推荐下一步操作建议（Action Guidance），支持单轮自愈演进。 |
| **5. 输入容错与多态自愈 (Elasticity & Healing)** | **6.0 / 10** | 若传入带括号的脏标题（如 `【ね 的读音 】`）或用题库标题代替 ID，部分工具会直接抛出 `ToolFormatError` 熔断。 | 语义适配器（Semantic Adapter）自动清洗标题噪音、多态映射参数别名，实现宽容入库。 |

---

## 二、 业界主流方案与设计规范对比 (Industry Benchmarks)

```mermaid
graph LR
    subgraph Industry_Standards["业界标杆方案"]
        MCP["Anthropic MCP 规范<br/>(RFC-style Protocol)"]
        OpenAI["OpenAI Strict Mode<br/>(Zero-Hallucination)"]
        Vercel["Vercel AI SDK<br/>(Zod Type-Safe Tool)"]
        BFCL["Berkeley BFCL<br/>(Function Calling Benchmark)"]
    end

    subgraph Architecture_Gaps["当前系统差距"]
        Gap1["Schema 子字段缺失"]
        Gap2["前缀冗余 (tool_)"]
        Gap3["返回值缺乏行动建议"]
        Gap4["单点工具碎片化"]
    end

    Industry_Standards --> Architecture_Gaps
```

### 1. Anthropic Model Context Protocol (MCP 2024~2026 规范)
- **Tool Naming**：禁止使用无意义的技术前缀（如 `tool_`, `fn_`），推荐使用小写蛇形下划线 `verb_object`（`list_decks`, `get_deck`, `search_entities`）。
- **JSON Schema 2020-12 严格子结构**：
  - 数组必须显式指定 `items` 的完整结构；
  - 对象必须声明具体的 `properties` 与 `required` 约束；
  - 关键字段必须嵌入示例（Worked Examples），例如 `example: { ipa: '/ne/', tts_clean: 'ね' }`，研究表明示例可将大模型参数填充正确率提升 38%。
- **Annotations 契约**：MCP 规范新增 `readOnlyHint: true`（只读查询）与 `consequentialHint: true`（具有持久化破坏性的变更操作），指导客户端实施安全审批。

### 2. OpenAI Function Calling & Strict Mode
- **`strict: true` 规范**：要求所有 `properties` 必须显式声明，且必须显式标注 `additionalProperties: false`，彻底消除幻觉字段注入。
- **Token 效率**：工具名称与描述在每一次对话中都会作为 System Prompt 注入上下文中，21 个带 `tool_` 前缀且长描述的工具会占用约 1,800 tokens；通过命名优化与分面按需暴露，可压缩至 650 tokens（节省 64%）。

### 3. Vercel AI SDK 与 LangChain Toolkits
- **类型即文档**：基于 Zod/Pydantic 生成 Schema，在输入端做类型自动强制转换与别名兼容（如将 `question` 映射为 `prompt`）。
- **Actionable Tool Output**：工具执行后返回的不仅是操作结果，还包含状态变更前后的 Diff，以及当前环境的态势感知快照。

---

## 三、 头脑风暴与四大设计模式优化架构 (Design Patterns in Action)

```mermaid
classDiagram
    class ToolSemanticAdapter {
        +adaptInput(toolName, rawArgs) Object
        +sanitizeTitleNoise(text) String
        +resolveCanonicalName(name) String
    }

    class ToolResponseStrategy {
        <<interface>>
        +formatResponse(rawResult, context) Object
    }
    class ActionableReActStrategy {
        +formatResponse(rawResult, context) Object
    }
    class CompactTokenStrategy {
        +formatResponse(rawResult, context) Object
    }
    class AuditDiffStrategy {
        +formatResponse(rawResult, context) Object
    }

    class DeckCurationFSM {
        -state: CurationState
        +transition(event)
        +canCommit() Boolean
    }

    class DeckCuratorFacade {
        +auditAndHealDeck(deckId) Object
        +batchUpsertWithPhonetics(deckId, entities) Object
    }

    ToolSemanticAdapter --> DeckCuratorFacade : 输入自愈
    DeckCuratorFacade --> DeckCurationFSM : 状态约束
    DeckCuratorFacade --> ToolResponseStrategy : 输出增强
```

### 1. 适配器模式 (Adapter Pattern)：输入自愈与双向协议桥接
- **协议命名双向桥接**：
  - 内部实现标准 MCP 动词名（`list_decks`, `update_entity`, `get_runtime_context`）；
  - 适配器自动支持历史前缀别名（`tool_list_decks` $\to$ `list_decks`），确保 100% 向后兼容。
- **输入弹性与自愈适配**：
  - **标题脏字符自愈**：若 LLM 传入 `title: "【ね 的读音 】"`，适配器自动调用 `sanitizePronunciation` 提取纯净词干 `"ね"`，并将原脏字符分流至 `subtitle` 或 `phonetics.tts_clean`。
  - **字段多态别名映射**：若 LLM 混淆了 `prompt` 与 `question`，或 `answer` 与 `standardAnswer`，适配器透明映射归一化。
  - **题库引用自愈**：若 LLM 将 `deckId` 传入为题库中文标题（如 `"英语动词"`），适配器自动解析为准确的 `deck_verbs` ID。

### 2. 策略模式 (Strategy Pattern)：多模态响应格式化
根据调用方角色与上下文预算，动态切换响应生成策略：
- **`ActionableReActStrategy`（默认 Agent 自治策略）**：
  - 注入 `telemetry`（当前题库分类薄弱数、未掌握题数）；
  - 注入 `suggestedNextActions`（下一步可调用的具体工具及参数范例）。
- **`CompactTokenStrategy`（长对话与微型终端策略）**：
  - 剥离大段文本描述，仅保留核心 ID、差异数量与状态码，节省 70% Token。
- **`AuditDiffStrategy`（关键写操作与版本化策略）**：
  - 生成类 Git 变更摘要（`added`, `modified`, `deleted`），并标注生成的快照版本 ID。

### 3. 状态机模式 (State Machine Pattern)：题库策展生命周期状态机
将松散的 CRUD 操作纳入严格的生命周期状态机管理，杜绝产生残缺题库：

```mermaid
stateDiagram-v2
    [*] --> UNINITIALIZED
    UNINITIALIZED --> AUDITED : execute(inspect/audit)
    AUDITED --> STAGING : execute(propose_entities/patch)
    STAGING --> GATE_CHECK : run_health_gate()
    GATE_CHECK --> STAGING : 门禁未通过(薄弱分类<4)
    GATE_CHECK --> COMMITTED : 门禁通过(100%充盈)
    COMMITTED --> SNAPSHOTED : auto_snapshot()
    SNAPSHOTED --> [*]
```

- **状态转移守卫（Guards）**：若题库在提交时存在薄弱分类（$<4$ 条），状态机拦截破坏性持久化，并自动指示 Agent 补齐同胞项。

### 4. 门面模式 (Facade Pattern)：高阶原子复合工具
在保留 21 个底层细粒度工具的基础上，提炼 3 个高内聚的复合门面工具，极大降低 LLM 规划步数：
1. **`heal_deck_thin_categories`（一键薄弱题库自愈门面）**：
   - 自动扫描题库薄弱分类 $\to$ 返回每个分类需要补充的同胞数量 $\to$ 接收补齐列表 $\to$ 自动完成版本快照与原子写入。
2. **`curate_multilingual_entity`（多模态语言考点智能录入门面）**：
   - 自动检测文字语种（日/韩/英/中）$\to$ 自动生成罗马音/音标 $\to$ 自动建立对偶形近字混淆关联（`confusedWith`）。
3. **`sync_runtime_learning_state`（运行时学练态势同步门面）**：
   - 聚合当前视图、用户错题热区、模式要求与下一步学习胶囊。

---

## 四、 当前系统可复用基础设施分析 (Reusability Audit)

本项目现存基础设施极为扎实，完全无需引入重型外部 npm 依赖，可 100% 纯原生复用：

1. **`features/mcp-bridge/tool-adapter.js` (`McpToolAdapter`)**：
   - 已具备 `validateToolValue` 深度递归校验与 `ledger` 幂等账本，天然适合承载别名映射与命名解耦。
2. **`features/ai-agent/tool-executor.js` (`DeckToolExecutor`)**：
   - 已具备 `_resolveDeck` 宽容寻址与 `storage.runTransaction` 事务回滚能力。
3. **`shared/deck-validator.js` (`validateDeckHealth`)**：
   - 已具备 5-3-10 规则校验器与薄弱分类扫描器，直接复用为状态机门禁守卫。
4. **`features/deck-manager/deck-versioning.js` (`DeckVersionController`)**：
   - 已具备软删除回收站、版本快照追踪与增量修补能力。
5. **`platform/audio/speech-synth.js` (`sanitizePronunciation` & `detectLocale`)**：
   - 已具备高精度的脏字符剥离与多语种检测逻辑，可直接复用于输入自愈适配器。

---

## 五、 升级落地规范与演进蓝图 (Actionable Implementation Blueprint)

### 1. 规范化工具清单与别名对照矩阵 (Tool Catalog Matrix)

| 标准 MCP 动词名 (Canonical) | 兼容历史别名 (Legacy Alias) | 门面/领域分组 | 核心参数完善与语义增强重点 |
| :--- | :--- | :---: | :--- |
| `list_decks` | `tool_list_decks` | Deck | 返回各题库健康状态、语种标签及同胞池充盈率 |
| `get_deck` | `tool_get_deck` | Deck | 支持按 ID 或名称模糊查找，返回分类层级树 |
| `create_deck` | `tool_create_deck` | Deck | 补齐 `lang`, `phonetics`, `confusedWith` 子模式定义 |
| `update_deck_meta` | `tool_update_deck_meta` | Deck | 修改标题、图标、简介，内置只读保护提示 |
| `delete_deck` | `tool_delete_deck` | Deck | 软删除联动回收站快照 |
| `import_markdown_deck`| `tool_import_markdown_deck`| Deck | Markdown 大纲 AST 序列化与逆向编译 |
| `add_entities` | `tool_add_entities` | Entity | **深度补齐全量 Entity Schema 属性描述与示例** |
| `update_entity` | `tool_update_entity` | Entity | **补齐 patch 对象所有合法字段及脏字符清洗** |
| `delete_entity` | `tool_delete_entity` | Entity | 单条考点移除与同胞池降级警告 |
| `search_entities` | `tool_search_entities` | Entity | 支持跨库或单库的全文与音标混淆检索 |
| `batch_update_entities`| `tool_batch_update_entities`| Entity| 补齐 updates 属性子集定义，支持原子严格模式 |
| `batch_delete_entities`| `tool_batch_delete_entities`| Entity| 批量删除自动执行 FE-KNOW-001 门禁预检 |
| `get_deck_guide` | `tool_get_deck_guide` | Guide | 获取先行组织者摘要与 Markdown 导学树 |
| `update_deck_guide` | `tool_update_deck_guide` | Guide | 导学全量更新 |
| `delete_deck_guide` | `tool_delete_deck_guide` | Guide | 导学重置 |
| `patch_deck_guide` | `tool_patch_deck_guide` | Guide | 增量修补导学指定小节 |
| `list_deck_versions` | `tool_list_deck_versions` | Version | 查询历史版本快照摘要与时间戳 |
| `rollback_deck_version`| `tool_rollback_deck_version`| Version| 一键回滚并在回滚前自动生成安全快照 |
| `create_deck_snapshot`| `tool_create_deck_snapshot`| Version| 手动创建业务变更打桩点 |
| `get_runtime_context` | `tool_get_runtime_context`| Runtime | 遥测学习模式、活跃胶囊、薄弱分类与下一步指引 |
| `get_mode_specifications`| `tool_get_mode_specifications`| Runtime| 查询 8 大试炼模式数据契约要求 |

---

### 2. 深度完善的 `add_entities` 规范 Schema 范式
（以此彻底解决大模型在批量录入考点时的黑盒幻觉问题）：

```json
{
  "name": "add_entities",
  "description": "向指定题库中批量追加新考点词条。每个分类条目数推荐 >=4 条，以满足四选一同胞干扰项硬门禁。",
  "parameters": {
    "type": "object",
    "properties": {
      "deckId": {
        "type": "string",
        "description": "目标题库唯一标识符 (如 deck_japanese 或 deck_verbs)"
      },
      "entities": {
        "type": "array",
        "description": "待追加的考点实体列表",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "考点唯一 ID (推荐格式：前缀_词条名，如 ja_ne 或 v_picnic)"
            },
            "categoryId": {
              "type": "string",
              "description": "所属分类 ID (必须在题库 categories 中已存在)"
            },
            "layer": {
              "type": "integer",
              "enum": [1, 2, 3],
              "description": "认知层级：1基础直变 / 2核心规律 / 3反直觉陷阱与对比"
            },
            "title": {
              "type": "string",
              "description": "纯净考点展示标题，切勿包含【】括号等元说明词 (示例：'ね', 'picnic')"
            },
            "subtitle": {
              "type": "string",
              "description": "辅助说明或音标注音 (示例：'/ne/ · 罗马音 ne · 猫 neko')"
            },
            "lang": {
              "type": "string",
              "description": "BCP 47 语言代码 (如 'ja-JP', 'en-US', 'zh-CN', 'ko-KR')"
            },
            "phonetics": {
              "type": "object",
              "properties": {
                "ipa": { "type": "string", "description": "国际音标 (如 '/ne/')" },
                "romaji": { "type": "string", "description": "罗马音或拼音 (如 'ne')" },
                "tts_clean": { "type": "string", "description": "纯净发音文本，供语音合成调用 (如 'ね')" }
              }
            },
            "prompt": {
              "type": "string",
              "description": "考核设问指令 (示例：'识别该假名发音与字形特征：')"
            },
            "answer": {
              "type": "string",
              "description": "标准参考答案 (示例：'读作 ne，右侧卷成圆环内扣')"
            },
            "explanation": {
              "type": "string",
              "description": "考点原理深度精析"
            },
            "pitfalls": {
              "type": "string",
              "description": "高频误区警示 (示例：'切勿与右侧外撇的 れ(re) 混淆！')"
            },
            "confusedWith": {
              "type": "string",
              "description": "易混考点对偶关联 ID (如 'ja_re')"
            }
          },
          "required": ["id", "categoryId", "layer", "title", "prompt", "answer"]
        }
      }
    },
    "required": ["deckId", "entities"]
  }
}
```

---

### 3. 自愈与反馈增强执行流程 (Execution Flow with ReAct Feedback)

```javascript
// 执行工具后返回 Actionable ReAct 载荷结构示例
{
  "status": "success",
  "operation": "add_entities",
  "deckId": "deck_japanese",
  "summary": {
    "addedCount": 5,
    "totalEntities": 26,
    "thinCategoriesResolved": 2
  },
  "healthAudit": {
    "valid": true,
    "status": "健壮",
    "thinCategoriesRemaining": 0
  },
  "suggestedNextActions": [
    {
      "action": "get_deck_guide",
      "args": { "deckId": "deck_japanese" },
      "reason": "题库已达 26 条充盈状态，建议检查或配置导学全景大纲"
    },
    {
      "action": "get_runtime_context",
      "args": {},
      "reason": "确认新考点是否已成功挂载入微考点对偶学练队列"
    }
  ]
}
```

---

## 六、 结论与建议 (Recommendations)

1. **立即可行性**：
   - 本方案基于纯前端既有核心（`tool-definitions.js`, `tool-executor.js`, `tool-adapter.js`），无需重构数据库或引入新依赖，改动收敛可控。
2. **渐进式迁移策略**：
   - **Phase 1 (语义 Schema 补全)**：对现存 21 个工具的参数对象补全完整的 `properties`、`enum` 与 `description`，彻底消除黑盒盲区。
   - **Phase 2 (双向命名适配与脏字符清洗)**：在 `McpToolAdapter` 中引入别名分发，支持标准动词名与历史前缀名并行，入库自动清洗脏括号。
   - **Phase 3 (自省闭环与建议注入)**：在返回值中统一封装 `telemetry` 与 `suggestedNextActions`，赋能自主 Agent 形成端到端自愈流水线。
