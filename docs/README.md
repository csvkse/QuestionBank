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
