# 英语动词形态记忆游戏 (VerbMaster / 动词大乱斗) 方案设计总览

> **项目目标**：将英语动词的现在分词/动名词规则、过去式/过去分词规则、不规则动词五大分类（AAA/AAB/ABA/ABB/ABC）、第三人称单数及词性辨析知识，转化为一个高趣味性、低认知负担的轻量化交互游戏。具备学习日志记录、成功/失败追踪、知识覆盖率雷达、基于日期的艾宾浩斯遗忘曲线巩固判定，以及根据学习状态自动推荐练习模式的能力。

---

## 🚀 系统优化与版本演进专栏 (Optimizations Directory)

> **优化专栏目录**：[`docs/optimizations/`](./optimizations/)  
> 专门设立的版本演化记录与实现细节库，包含各版本的优化方案、解决痛点、指标对比与落地规范：
> - 📑 [**版本总控与演进全景索引 (README.md)**](./optimizations/README.md)
> - 🔹 [**v2.0 通用知识引擎优化记录**](./optimizations/v2.0_UNIVERSAL_ENGINE.md)（领域解耦、SM-2、同胞干扰项、5-3-10容量）
> - 🔹 [**v2.1 前端物理架构与门禁记录**](./optimizations/v2.1_CORE2.1_ARCHITECTURE.md)（Core 2.1角色、零依赖构建、L0~L3门禁）
> - 🔹 [**v2.2 设计令牌与表面层级记录**](./optimizations/v2.2_DESIGN_TOKENS_AND_SURFACES.md)（4层令牌、Surface 0~4、70%~90%中性色）
> - 🔹 [**v2.3 导航/图标/焦点优化方案**](./optimizations/v2.3_NAVBAR_ICONS_INTERACTION.md)（单行导航解耦、单色矢量SVG、Hero Ring闭环）

---

## 一、文档体系导航

本系列调研与设计文档位于 `docs/` 目录下，涵盖了从理论调研到原型落地的完整闭环方案：

| 序号 | 文档名称 | 核心内容概要 |
| :--- | :--- | :--- |
| **01** | [01_FEASIBILITY_AND_BRAINSTORMING.md](./01_FEASIBILITY_AND_BRAINSTORMING.md) | **可行性调研与头脑风暴**<br>• 痛点与游戏化理念（时态魔法师背景）<br>• 技术栈横向对比选型（为何选择现代前端单页微架构）<br>• 本地持久化、离线化与安全策略<br>• 智能干扰项生成与自适应难度可行性验证 |
| **02** | [02_GAME_DESIGN_SPEC.md](./02_GAME_DESIGN_SPEC.md) | **游戏系统规约与模式设计**<br>• 核心战斗/答题回路（Combo、血量、暴击机制）<br>• **五大游戏模式**（艾宾浩斯智能复习、弱点突击、闯关战役、极速生存、自由试炼）<br>• **日期记忆衰减算法**（基于艾宾浩斯/SM-2演进的记忆稳定度模型）<br>• 自动模式推荐引擎触发策略 |
| **03** | [03_DATA_SCHEMA_AND_KNOWLEDGE_BASE.md](./03_DATA_SCHEMA_AND_KNOWLEDGE_BASE.md) | **知识库题库与数据结构设计**<br>• 知识点原子化分类体系（ic特殊变k、重读闭音节、ie变y、ABB、词性辨析等）<br>• 完整动词词库 JSON Schema 规范<br>• 答题日志（Log）、学习画像（Profile）与进度统计数据结构<br>• 知识覆盖率与掌握度算法公式 |
| **04** | [04_UI_UX_AND_PREVIEW_PLAN.md](./04_UI_UX_AND_PREVIEW_PLAN.md) | **UI/UX 交互与预览方案**<br>• 视觉风格设定（像素风/赛博魔法控制台）<br>• 核心界面线框原型（主仪表盘、战役答题区、复习看板、技能覆盖雷达图）<br>• 键盘/触控双端交互规范<br>• 音效反馈与 Juiciness 体验设计 |
| **05** | [05_UNIVERSAL_FRAMEWORK_FEASIBILITY.md](./05_UNIVERSAL_FRAMEWORK_FEASIBILITY.md) | **通用知识框架抽象可行性调研**<br>• 仅凭「分类+分层」如何自动派生全套游戏机制<br>• 同胞干扰项采样数学模型与布鲁姆认知阶梯<br>• 跨学科实证（编程/医学/法律/日语）<br>• 纯 Markdown 笔记到游戏的一键摄取流水线 |
| **06** | [06_UNIVERSAL_ENGINE_IMPLEMENTATION.md](./06_UNIVERSAL_ENGINE_IMPLEMENTATION.md) | **通用知识引擎落地与解析器规范**<br>• 通用 KnowledgeDeck 协议 v2.0 与多题库隔离架构<br>• 同胞干扰项采样器 (Sibling Distractor Synthesizer)<br>• Markdown 语法状态机与一键摄取解析器<br>• 原始知识精读与自测学习中心 (Study Hub & 遮挡自测模式)<br>• 可视化 / Markdown 双向联动 Studio 架构 |
| **07** | [07_KNOWLEDGE_SCALE_AND_CAPACITY_SPEC.md](./07_KNOWLEDGE_SCALE_AND_CAPACITY_SPEC.md) | **知识容量与分类分层极限设计规范**<br>• 黄金配置「5-3-10」原则 (分类数/分层深度/桶内条目数)<br>• 四选一同胞干扰项算法 $\ge 4$ 硬约束数学证明<br>• 退火降级与心智认知负荷分析<br>• **题库增删改查 (CRUD) 全生命周期限制与防护提示规范** |
| **08** | [08_GROUP_CATEGORY_LAYER_HIERARCHY_SPEC.md](./08_GROUP_CATEGORY_LAYER_HIERARCHY_SPEC.md) | **知识体系三维分层规范 (业务分组 × 细分类别 × 认知层级)**<br>• 为什么必须彻底解耦 Group、Category 与 Layer<br>• 三维正交坐标系定义与职责边界<br>• Markdown AST 大纲语法分级映射规范 (`## [分组]` / `### [分类]` / `#### [Layer]`)<br>• 学习大厅 (Study Hub) 3-Step 中控矩阵筛选与卡片树下钻穿透<br>• 题库工坊 (Deck Studio) 双视图双向实时同步机制 |
| **09** | [09_FRONTEND_ARCHITECTURE_AND_PHYSICAL_LAYOUT.md](./09_FRONTEND_ARCHITECTURE_AND_PHYSICAL_LAYOUT.md) | **前端架构升级与物理目录规范 (Core 2.1 映射)**<br>• 映射企业级 Frontend Architecture Core 2.1 规范<br>• 六大逻辑角色边界 (`app`, `features`, `shared`, `design-system`, `platform`, `vendor`)<br>• 目标物理目录树规划<br>• 开发态 (ESM) 与分发态 (便携独立单文件) 双模式交付流水线 |
| **10** | [10_QUALITY_GATES_AND_GOVERNANCE_SPEC.md](./10_QUALITY_GATES_AND_GOVERNANCE_SPEC.md) | **质量门禁与架构治理规约 (Quality Gates)**<br>• 统一规则 ID 体系 (`FE-*` 与 `DS-*`)<br>• L0 ~ L3 门禁分级执行时机与性能预算<br>• 结构、依赖、资源、复杂度门禁明细<br>• **知识图谱专属硬门禁 `FE-KNOW-*` (同胞池、容量、AST幂等)**<br>• 渐进式基线 (Baseline) 与棘轮 (Ratchet) 治理协议 |
| **11** | [11_ARCHITECTURE_MIGRATION_AND_PREVIEW_PLAN.md](./11_ARCHITECTURE_MIGRATION_AND_PREVIEW_PLAN.md) | **架构迁移路线图与预览方案 (Migration & Preview)**<br>• 原生 ESM、零依赖打包器、门禁引擎与存储兼容性可行性论证<br>• 三阶段平滑演进路线 (Transitional ➔ Hybrid ➔ Conformant)<br>• 终端 CLI 门禁、界面内嵌架构中控与打包产物三重视角预览方案 |
| **12** | [12_DESIGN_SYSTEM_AND_UI_OPTIMIZATION_SPEC.md](./12_DESIGN_SYSTEM_AND_UI_OPTIMIZATION_SPEC.md) | **前端设计规范落地与设计令牌重构规范 (Design System & UI Spec)**<br>• 界面设计核心规范（70~90%中性色、Rule of One视觉焦点、层级演进铁律）<br>• 4层设计令牌架构（Primitive → Semantic → Component → Theme）<br>• Surface 0～4 表面层级与明度阶梯（告别“结构不够框来凑”）<br>• 8-Point 间距步进与 7 级排版字阶规范 |
| **13** | [13_AI_AGENT_ARCHITECTURE_AND_TOOL_CALLING_SPEC.md](./13_AI_AGENT_ARCHITECTURE_AND_TOOL_CALLING_SPEC.md) | **AI Agent 智能助手架构与题库工具调用规约 (AI Agent & Tool Calling Spec)**<br>• 方案与前端生态库深度横向对比（原生 Fetch SSE vs Vercel AI SDK vs LangChain）<br>• **题库全生命周期 CRUD 工具链** (10 项标准 Function Calling Schema 与 Human-in-the-Loop 批准机制)<br>• **多会话列表与持久化** (新建/切换/自动提炼标题/本地安全存储)<br>• **多平台与模型配置** (DeepSeek、OpenAI、SiliconFlow、Ollama、Qwen)<br>• **思考等级设置 (Reasoning Effort)** (None/Low/Med/High 档位适配与思维链流式折叠卡片) |
| **14** | [14_AI_AGENT_WORKFLOW_AND_STUDY_EXPERIENCE_REDESIGN_SPEC.md](./14_AI_AGENT_WORKFLOW_AND_STUDY_EXPERIENCE_REDESIGN_SPEC.md) | **AI Agent 工作流与学习体验全维重构规约 (Workflow & Experience Redesign)**<br>• **多平台多模型配置与输入框快捷切换器** (平台/模型动态增删与 1-Click 快捷切换)<br>• **工具调用卡片自动折叠收敛** (执行后自动折叠为单行摘要)<br>• **零依赖安全 Markdown 格式化引擎** (标题/粗体/代码块/表格/列表/引用)<br>• **消息级悬停操作工具栏** (复制/重新生成/编辑Prompt/删除)<br>• **全界面单色矢量化与门禁防护** (全面去除彩色Emoji，建立 `FE-ICON-002` 门禁)<br>• **自由沙盒训练自定义配置** (分类/层级/题量多维定制刷题)<br>• **分层阶梯模式天梯路线图** (Tier 1 ➔ 2 ➔ 3 进阶路线与 80% 黄金及格线解锁)<br>• **知识精读单点沉浸聚焦模式** (左侧知识树 + 右侧单题三段式聚焦卡片) |
| **15** | [15_PLATFORM_CONFIG_CLICK_BUG_POSTMORTEM_AND_GATES.md](./15_PLATFORM_CONFIG_CLICK_BUG_POSTMORTEM_AND_GATES.md) | **平台管理点击无效故障复盘与架构门禁规约 (Postmortem & Gates)**<br>• 故障现象与控制台 `TypeError` 调用链精准溯源<br>• 架构根本缺陷分析 (接口契约脱节、参数多态不一致、动态绑定盲区)<br>• 底层数据层与控制器弹性防御加固修复<br>• **新建 `FE-BIND-001` 门禁 (DOM Click & Event Handler Contract Integrity)**，实现 100% 模板绑定可执行性静态/运行时联防闭环 |
| **16** | [16_CUSTOM_PLATFORMS_AND_MODELS_SPEC.md](./16_CUSTOM_PLATFORMS_AND_MODELS_SPEC.md) | **AI 自定义平台、接口协议分发与模型细粒度配置规约 (Custom Platforms & Models)**<br>• **选择接口类型** (OpenAI 兼容协议 / Anthropic Claude / Google Gemini / Ollama 原生)<br>• **自定义平台管理** (自定义名称、端点、密钥、增删改查)<br>• **细粒度模型列表配置** (每模型独立配置【上下文窗口 Context Window】与【最大输出 Max Output Tokens】)<br>• **现有模型列表仅作为参考预设** (提供参考模板按需导入与恢复，不设限制) |
| **17** | [17_SWITCH_DECK_ACTIVE_BUTTON_BUG_POSTMORTEM_AND_GATES.md](./17_SWITCH_DECK_ACTIVE_BUTTON_BUG_POSTMORTEM_AND_GATES.md) | **“设为激活”按钮点击无效故障复盘与内联事件门禁升级规约 (Postmortem & Gates)**<br>• 题库管理弹窗“设为激活”按钮无响应根因排查与调用链断裂定位<br>• `app.renderDeckManagerList` 缺失方法补齐与单色矢量化改造<br>• **`FE-BIND-001` 全域双轨内联事件扫描门禁升级** (多语句分号隔离提取、全源码目录 HTML+JS 覆盖，彻底杜绝同类隐患) |
| **18** | [18_JEV_RECOMMENDATION_API_SPEC.md](./18_JEV_RECOMMENDATION_API_SPEC.md) | **JEV 熟练度全景评估与模块推荐接口规范 (JEV Recommendation API Spec)**<br>• **各分类板块熟练度全景向量提取** (覆盖率、到期遗忘度、同胞错题率、熟练度)<br>• **JEV 远程 REST 协议与契约** (端点、认证 Token、结构化 JSON 上报与研判建议)<br>• **本地多维加权启发式降级算法** (未配置或异常时自动自愈输出高风险模块突击建议)<br>• **降级双轨策略** (采用降级方案 vs 安静不推荐模式随心切换，一键直达沙盒试炼) |
| **19** | [19_CORS_PREFLIGHT_AND_LOCAL_DEV_PROXY_SPEC.md](./19_CORS_PREFLIGHT_AND_LOCAL_DEV_PROXY_SPEC.md) | **CORS 预检阻断机理与本地开发反向代理规约 (CORS Preflight & Dev Proxy Spec)**<br>• **OPTIONS 预检阻断根因剖析** (上游 405 Method Not Allowed 与 corsproxy.io 401 限制)<br>• **零依赖本地开发与代理服务器** (`scripts/dev-server.mjs`, `npm run dev`)<br>• **跨域与 file:// origin: null 彻底脱敏**<br>• **Cloudflare Worker 15 行轻量云代理备选** |
| **20** | [20_ZERO_BACKEND_PURE_CLIENT_STANDALONE_SPEC.md](./20_ZERO_BACKEND_PURE_CLIENT_STANDALONE_SPEC.md) | **零后端纯前端独立运行与自愈降级架构规约 (Zero-Backend Pure Client Spec)**<br>• **去后端化纯前端独立单文件哲学** (双击即用，0 本地后台进程依赖)<br>• **纯前端本地智能全景推荐引擎** (艾宾浩斯到期度+错题率多维加权矩阵，客户端内存瞬时计算)<br>• **远程接口跨域阻断全自动优雅自愈降级** (不阻断用户，无缝切换为本地算法)<br>• **AI Agent 纯前端仿真自闭环** (零配置无需 API Key 即可体验多步闭环工具调用) |
| **21** | [21_LAYOUT_SPACING_GHOST_MARGIN_BUG_POSTMORTEM_AND_GATES.md](./21_LAYOUT_SPACING_GHOST_MARGIN_BUG_POSTMORTEM_AND_GATES.md) | **页面顶栏空白幽灵间距根因分析与架构门禁规范 (Layout Spacing Ghost Margin Postmortem & Gates)**<br>• **非首位视图 48px 双倍间隙故障现象溯源** (Chrome DevTools DOM 几何尺寸量化实测)<br>• **Tailwind CSS `space-y-*` 底层选择器机制** (`:not([hidden])` 属性与类名穿透机理)<br>• **路由容器布局越权与双重防御架构落地** (移除 `<main>` 外部间距 + 原生 `hidden` 属性同步)<br>• **增设 `FE-LAYOUT-001` 架构门禁** (路由插槽布局边界与兄弟间距隔离律，杜绝幽灵间距再发) |
| **22** | [22_QUESTION_PROMINENCE_AND_LANGUAGE_AUTO_SPEECH_SPEC.md](./22_QUESTION_PROMINENCE_AND_LANGUAGE_AUTO_SPEECH_SPEC.md) | **题目醒目度重构与语言类题库自动发音架构规约 (Question Prominence & Language Auto-Speech Spec)**<br>• **核心答题任务指令看板架构** (解决题目不明显痛点，独立双层容器+图标+高反差白字)<br>• **纯前端原生 Web Speech API 朗读** (零网络/零后端/零成本，原生毫秒级本地合成)<br>• **语言题库双轨判定算法** (`isLanguageDeck` 显式+智能启发式推导，非语言题库自动静音)<br>• **顶栏开关持久化与全键盘快捷键闭环** (1/2/3/4 作答、P 重新发音、S 快速开关、Enter 下一题) |
| **23** | [23_AGENT_MESSAGE_BUBBLE_MARKDOWN_TYPOGRAPHY_SPEC.md](./23_AGENT_MESSAGE_BUBBLE_MARKDOWN_TYPOGRAPHY_SPEC.md) | **Agent 会话消息框排版行距根因分析与排版节奏门禁规范 (Agent Message Bubble Markdown Typography Spec)**<br>• **消息气泡 35.5px 巨型断层间隙量化排查** (Chrome DevTools 几何边界现场实测)<br>• **行级正则遗留换行符与全局 `<br>` 叠加根因** (块元素穿插行内 `<br>` 与 `space-y` 乘数放大机理)<br>• **状态驱动轻量块级 Markdown 引擎重构** (语义化 `ul`/`ol`/`p` 容器保护，彻底杜绝孤立换行)<br>• **增设 `FE-TYPO-001` 架构门禁** (消息气泡块级隔离与排版节奏硬门禁，杜绝空洞行距再发) |
| **24** | [24_PANORAMA_HIERARCHICAL_GROUPS_SPEC.md](./24_PANORAMA_HIERARCHICAL_GROUPS_SPEC.md) | **各分类板块熟练度全景层级化重构规范与架构门禁 (Panorama Hierarchical Groups Spec)**<br>• **三维本体架构层级映射** (大类 Group × 小类 Category 双层树状视觉层级)<br>• **宏观熟练度聚合计算** (大类总词条、已学数、大类综合掌握率、到期与错题汇总)<br>• **微观纵深与 JEV 穿透高亮** (小类缩进展示，JEV 推荐大类强制展开与脉冲徽标)<br>• **可折叠与一键统览交互** (点击大类自由折叠/展开，顶栏全部折叠/全部展开切换)<br>• **增设 `FE-PANORAMA-001` 架构门禁** (全景层级化聚合与交互契约硬门禁) |
| **25** | [25_ROUTER_TAB_SCROLL_TO_TOP_SPEC.md](./25_ROUTER_TAB_SCROLL_TO_TOP_SPEC.md) | **标签页路由切换自动滚动置顶规范与架构门禁 (Router Tab Scroll-to-Top Spec)**<br>• **单页视口偏移残留机理分析** (跨视图 800px 幽灵偏移导致错失新视图首屏)<br>• **双轨帧同步置顶算法** (同步即时归零 + `requestAnimationFrame` 下一帧二次绘制校准)<br>• **多容器全域清零** (`window`、`documentElement`、`body`、`<main>` 全容器自适应)<br>• **活跃标签二次回顶心智** (在长页面中点击活跃 Tab 即时顺畅回顶)<br>• **增设 `FE-SCROLL-001` 架构门禁** (路由置顶契约硬门禁) |
| **26** | [26_SANDBOX_UNIVERSAL_MODES_AND_GROUP_TAXONOMY_SPEC.md](./26_SANDBOX_UNIVERSAL_MODES_AND_GROUP_TAXONOMY_SPEC.md) | **自由沙盒试炼全模式支持与大组层级分类架构规约 (Sandbox Universal Modes & Group Taxonomy Spec)**<br>• **自由沙盒全面支持 4 大核心模式** (默认自测、弱点攻坚、分层递进、极速生存)<br>• **参考「知识精读」业务大组分类方案** (大组 Group 卡片化聚合展示与大组级全选/清空)<br>• **认知层级排布保持既有方案** (遵照用户明确指示，维持分类在上、层级在下的心智排布)<br>• **全模式排队算法与会话引擎分派** (`DEFAULT`/`WEAKNESS`/`STEPPED`/`SPEED_SPRINT` 矩阵映射) |
| **27** | [27_QUESTION_SOURCE_DESIGN_PATTERNS_SPEC.md](./27_QUESTION_SOURCE_DESIGN_PATTERNS_SPEC.md) | **各模式题库来源重构与设计模式规约 (Question Bank Source Design Patterns Spec)**<br>• **策略模式 (Strategy) 解耦排队算法** (消除 if-else，各游戏模式出题策略高聚合、可插拔)<br>• **规约模式 (Specification) 统一口径** (错题/到期/生锈判定统一收口，终结 Dashboard 与出题打架)<br>• **责任链管道 (Pipeline) 重构干扰项** (同形态对齐+强混淆注入+自适应退火，解决跨时态破绽)<br>• **工厂模式与快照隔离** (策略工厂别名归一化、专项速刷再来一局上下文还原、沙盒天梯隔离)<br>• **[交互预览原型](./27_question_source_preview.html)** (策略模拟工作台、极端场景注入、新旧对比验证) |
| **28** | [28_PANORAMA_COLLAPSE_SOVEREIGNTY_BUG_POSTMORTEM_AND_GATES.md](./28_PANORAMA_COLLAPSE_SOVEREIGNTY_BUG_POSTMORTEM_AND_GATES.md) | **熟练度全景大类无法折叠故障复盘、修复方案与架构门禁升级规约 (FE-PANORAMA-002)**<br>• **部分大类无法折叠故障复盘** (焦点大类点击折叠瞬间被 DOM 渲染循环强行抹除)<br>• **渲染纯洁性与副作用清零** (`renderDeckCategoryBars` 纯函数式投影，严禁篡改用户交互状态)<br>• **单次智能引导防重入机制** (`_lastAutoExpandedJevTarget` 避免自动化研判永久覆盖折叠控制权)<br>• **增设 `FE-PANORAMA-002` 架构门禁** (折叠主权硬门禁 + 全套行为单元测试套件) |
| **29** | [29_NAVBAR_DISPLAY_OPTIMIZATION_SPEC.md](./29_NAVBAR_DISPLAY_OPTIMIZATION_SPEC.md) | **导航栏多端自适应流式排版、防折行解耦与视觉精细化重构规约 (FE-NAV-002)**<br>• **中心分段路由文字折行故障排查** (平板/小屏视口两翼挤压致使“仪表\n盘”、“知识精\n读”双行崩坏)<br>• **响应式弹性空间回收机制** (左侧品牌与右侧动作标签优先级折叠，释放 140px+ 呼吸空间)<br>• **分段路由防折行与紧凑微排版** (`whitespace-nowrap`、`shrink-0`、全交互胶囊统一度量 32px 标顶对齐)<br>• **视觉层级精修与磨砂微光** (微渐变焦点、高反差徽标、单色矢量化与零依赖流动)<br>• **增设 `FE-NAV-002` 架构门禁** (防折行与全视口单行流式硬门禁 + [交互预览工作台](./29_navbar_display_preview.html)) |

---

## 🗄️ 历史版本归档

- **v1.0 (英语动词形态专用版)** 已安全归档至 [`archive/v1_verbmaster/`](../archive/v1_verbmaster/) 目录。
- 当前主工程已升级为 **v2.0 通用知识图谱游戏化记忆引擎 (Universal Knowledge Engine)**。

---

## 二、核心特性矩阵

```
                ┌────────────────────────────────────────────────────────┐
                │             英语动词形态记忆游戏 (VerbMaster)            │
                └───────────────────────────┬────────────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬────────────────────┐
        ▼                   ▼                               ▼                    ▼
   【趣味游戏化】     【原子知识图谱】                【科学记忆引擎】       【智能自适应】
   • Combo连击        • -ic加k规则 (picnic等)         • 基于日期的遗忘曲线   • 今日状态自动检测
   • 答题暴击特效     • 重读闭音节双写                • 记忆稳定度(Stability)• 自动推荐最优模式
   • 动词变形术       • 不规则 AAA/AAB/ABA/ABB/ABC   • 间隔复习(1/2/4/7/15) • 动态生成高诱惑干扰项
   • 8-bit合成音效    • 词性辨析(分词vs动名词)        • 错题归因追踪         • 知识覆盖率全景看板
```

---

## 三、推荐技术栈落地决议

- **核心形态**：纯单页应用 (Single Page Application, SPA)，支持纯本地双击直接打开或轻量 Web 容器。
- **存储方案**：`IndexedDB` + `localStorage` 双轨机制，支持毫秒级日志读写、断电无忧、并支持 **一键导出/导入 JSON 存档**。
- **扩展性**：无缝支持后续打包为桌面端 (Electron / Tauri / PWA) 或嵌入知识库 (Obsidian / Webview)。
