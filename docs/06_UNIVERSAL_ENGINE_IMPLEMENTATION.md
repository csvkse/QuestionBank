# 06. 通用知识引擎落地与解析器规范 (Universal Engine Implementation)

---

## 一、通用架构演进目标 (Architecture Evolution)

由 v1.0 业务定制版（英语动词专用）全面升级为 **v2.0 通用知识图谱游戏化记忆引擎 (Universal Knowledge Engine)**。

```
                     ┌────────────────────────────────────────────────────────┐
                     │            Universal Knowledge Deck (通用知识包)       │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            ▼                                    ▼                                    ▼
    【元数据与分类定义】                 【分层阶梯定义】                     【实体题元库】
    • Deck ID / 领域名称                 • Layer 1 (基础入门)                 • Entity ID / 名称 / 读音
    • Category ID / 分类名               • Layer 2 (进阶规律)                 • 目标正确答案 (Answer)
    • 图标 / 描述说明                    • Layer 3 (特例与盲区)               • 混淆同胞 / 避坑解析 / 例句
```

---

## 二、通用数据模型协议 (Universal Knowledge Schema v2.0)

每个知识包（Deck）均遵循如下标准化规范，支持本地多题库无缝切换与独立状态持久化：

```typescript
// 1. 通用知识包 (Deck)
interface KnowledgeDeck {
  id: string;                     // 题库唯一ID (如 "verb_master", "http_status_codes")
  title: string;                  // 题库显示名称 (如 "HTTP 状态码与网络协议")
  description: string;            // 题库简介
  icon: string;                   // 题库图标 (如 "🌐", "⚡", "🐍")
  version: string;                // 版本号
  
  // 分类注册表 (Taxonomy: 用于横向对比与同胞干扰项采样)
  categories: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  
  // 分层阶梯 (Hierarchy: 用于认知递进与战役关卡编排)
  layers: Array<{
    level: number;                // 1, 2, 3...
    name: string;                 // 如 "Layer 1: 基础认知", "Layer 3: 隐秘陷阱"
    description?: string;
  }>;
  
  // 知识实体集合 (Entities: 知识最小颗粒度)
  entities: Array<KnowledgeEntity>;
}

// 2. 知识实体 (Entity)
interface KnowledgeEntity {
  id: string;                     // 实体唯一ID (如 "http_401")
  categoryId: string;             // 所属分类ID (如 "CAT_4XX")
  layer: number;                  // 所属层级 (1, 2, 3)
  
  title: string;                  // 核心概念 (如 "401 Unauthorized" 或 "panic")
  subtitle?: string;              // 音标/短释义 (如 "/ˈpænɪk/" 或 "客户端错误")
  prompt?: string;                // 考核提示词 (如 "其核心含义是？" 或 "变过去分词")
  answer: string;                 // 正确答案 (如 "未提供有效身份凭证" 或 "panicked")
  
  // 智能推导与高级题型支撑字段
  confusedWith?: string;          // 强混淆关联实体 (如 "http_403", 优先作为高仿干扰项)
  pitfalls?: string;              // 避坑与常见误区说明
  explanation: string;            // 规则深度揭秘与记忆口诀
  examples?: string[];            // 典型例句或应用场景
  presetDistractors?: string[];   // [可选] 人工预设的特殊干扰项
}
```

---

## 三、通用智能干扰项采样算法 (Sibling Distractor Synthesizer)

当针对某一知识点 $E$ 生成选择题时，无需人工预先编写荒谬的选项，引擎通过**三级同胞采样流**动态组装最具辨析价值的干扰项：

```text
算法输入：目标实体 E，当前题库 Deck，需求选项数 N=4 (1个正确项 + 3个干扰项)

Step 1 [强混淆注入]:
  若 E.confusedWith 存在，优先在 Deck 中寻获该实体，将其 answer 作为第 1 干扰项。

Step 2 [同胞分类采样 (Sibling Sampling)]:
  在 Deck.entities 中筛选属于同一 categoryId 且 ID != E.id 的实体集合。
  从中随机抽取不重复的实体答案填入干扰项池，直至满员。
  （由于属于同一分类，概念高度接近，选项天然具备极强的混淆与考查价值！）

Step 3 [同层级退火兜底 (Layer Fallback)]:
  若同一分类下实体不足 3 个，算法自动在相同 layer (同难度层) 的其他分类中采样补足。

Step 4 [随机洗牌 (Fisher-Yates Shuffle)]:
  将 正确答案 与 干扰项 随机打乱，绑定键盘快捷键 [1], [2], [3], [4]。
```

---

## 四、Markdown 笔记一键解析器设计 (Markdown Ingestion Pipeline)

用户只需要直接粘贴纯文本笔记，解析器通过 AST 正则状态机自动提取结构，一键导入为新的可游玩题库：

### 语法标记规范
```markdown
# [图标] 题库名称
> 题库简要说明

## [分类] 分类名称 A
### [Layer 1] 基础认知层
- **实体名称**: 核心答案
  - *提示*: 考查提示语 (可选)
  - *解析*: 核心规则与记忆口诀
  - *误区*: 常见避坑说明 (可选)
  - *混淆*: 混淆实体名称 (可选)

### [Layer 2] 进阶运用层
- **实体名称 B**: 核心答案 B
  ...
```

### 解析器状态机工作流
1. 捕获 `#` 提取为 `deck.title` 与 `deck.description`；
2. 捕获 `## [分类]` 提取为新的 `category` 并在当前上下文激活；
3. 捕获 `### [Layer N]` 提取当前层级 `layer: N`；
4. 捕获 `- **名称**: 答案` 实例化新的 `KnowledgeEntity`，并向下扫描子列表提取 `*解析*`、`*误区*` 等属性；
5. 完成后执行合法性 Lint 校验（确保每个分类下至少有 2 个词条以便生成同胞选项），写入本地持久化存储。

---

## 五、多题库艾宾浩斯记忆与进度隔离机制

- 引擎将记忆状态按照 `Deck ID` 进行完全隔离：
  - `deck_state_${deckId}`：独立记录该题库下所有实体的 `level`、`attempts`、`nextReviewAt`、`stabilityDays`；
  - 用户在各个题库间的学习进度互不干扰；
  - 仪表盘与顶部导航支持**一秒切换当前激活题库**，艾宾浩斯复习调度与智能推荐随题库动态实时切换。

---

## 六、原始知识精读与自测学习中心 (Study Hub & Active Recall)

为了解决“刷题前需要先系统化通读知识体系”的严肃学习诉求，v2.0 增设了专门的【原始知识精读与学习中心】（`view-study`）：

### 1. 核心交互特性
- **结构化分类展卷**：按分类（Category）分板块排布，板块内部按认知难度（Layer 1 基础 $\to$ Layer 2 规律 $\to$ Layer 3 特例）有序呈现，具备教材般的系统阅读感。
- **自测遮挡模式 (Active Recall Masking)**：
  - 开启后，所有卡片的核心答案自动添加毛玻璃遮挡（`filter blur-[5px]`）；
  - 学习者在心中回想答案，鼠标悬停或触屏点击瞬间显现，形成高效的“主动提取 (Active Retrieval)”认知回路。
- **全息检索与单科突破**：
  - 支持即时关键词搜索（标题、释义、规则、避坑全文检索）；
  - 每个分类板块支持点击「⚡ 专项练本科目」，每个独立卡片支持点击「🎯 专项突破」直达实战。
- **原始 Markdown 大纲一键导出**：
  - 提供「📋 查看原始大纲」功能，系统自动将当前题库逆向导出为规范的 Markdown 文本大纲，支持一键复制到剪贴板，方便用户在 Obsidian / Notion / 本地笔记中二次沉淀。

---

## 七、可视化 / Markdown 双视图实时双向联动编辑架构 (Bi-Directional Dual-View Studio)

为了降低用户自定义题库时的心智负担，新工坊彻底突破了“纯表单容易迷失结构，纯文本缺乏直观控件”的两难困境，采用了**双向响应式状态机同步架构**：

```
     ┌──────────────────────────────────────────────────────────────┐
     │       内部统一知识草稿模型 (Central DraftDeck State)         │
     │       { title, icon, description, categories, entities }     │
     └──────────────────────────────┬───────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼ 双向响应式绑定                                   ▼ 双向响应式绑定
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│  左屏: 可视化表单编辑器 (Visual UI)  │   │ 右屏: Markdown 纯文本代码 (Code)     │
│ • 卡片直接编辑名称、答案、避坑       │   │ • 纯粹标准 Markdown 语法大纲         │
│ • 一键「+ 新增分类」「+ 概念」       │   │ • 支持从本地笔记直接整篇粘贴         │
│ • 下拉选择 Layer 1/2/3 认知阶梯      │   │ • 行数统计与实时光标高亮             │
│ • 🗑️ 删除与拖拽重新归类             │   │ • 毫秒级 AST 解析同步左侧表单        │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
```

### 1. 双向联动数学与同步流
1. **Markdown $\to$ Visual (输入即解析)**：
   - 监听右侧文本框 `oninput` 事件（通过 180ms 防抖 Debounce 避免高频渲染性能抖动）；
   - 正则状态机解析 Markdown 生成统一 `draftDeck` 模型；
   - 增量重绘左侧可视化卡片树，并更新底部实时语法 Lint 校验徽章。
2. **Visual $\to$ Markdown (表单即代码)**：
   - 用户在左侧表单中修改任意概念名称、答案文本、避坑提示、或点击添加/删除按钮；
   - 序列化器立即将 `draftDeck` 序列化为规范标准的 Markdown 代码；
   - 比较后写入右侧文本框，**无额外触发环路，天然杜绝递归死循环 (Loop-free)**。

### 2. 自由三重视图模式 (View Modes)
- **🔀 分屏联动 (Split)**：默认桌面端双屏并排，左边点按钮修改，右边代码实时变动，所见即所得；
- **🎨 纯可视化 (Visual Only)**：全宽表单模式，适合不熟悉 Markdown 语法的小白用户；
- **📝 纯 Markdown (Markdown Only)**：全宽代码模式，适合从 Obsidian、Notion 批量粘贴大型笔记的用户。


