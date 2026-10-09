# 14. AI Agent 工作流与学习体验全维重构规约 (AI Agent Workflow & Study Experience Redesign Spec)

> **对应架构**：Enterprise Frontend Architecture Core 2.1  
> **设计系统参考**：`12_DESIGN_SYSTEM_AND_UI_OPTIMIZATION_SPEC.md` (Design Tokens, Monochrome Vector Icons)  
> **AI 工具规约参考**：`13_AI_AGENT_ARCHITECTURE_AND_TOOL_CALLING_SPEC.md` (AgentLoopEngine, Combo 1)  
> **版本**：v2.5-Experience-Redesign  
> **状态**：ACTIVE  

---

## 一、 建设背景与重构愿景 (Background & Objectives)

在通用知识图谱记忆引擎与 AI 智囊系统迭代至 v2.4 之后，系统已具备了坚实的零依赖单文件打包、微库级 SSE 流式传输、题库 CRUD 工具链以及多步自主智能体循环（ReAct Agent Loop）。然而，在深度人机交互、认知学习体验与视觉美学统一性上，暴露出了 9 个亟待解决的结构性与体验性痛点：

1. **AI 平台与模型单一性**：配置仅支持单厂商平铺，缺乏多平台（DeepSeek / OpenAI / 硅基流动 / 本地 Ollama / 阿里千问）多模型管理能力；
2. **输入交互割裂**：切换平台与模型需要繁琐地打开全局配置模态框，无法在对话输入工具栏中即选即用；
3. **工具调用信息过载**：多步循环中产生的复杂参数与落库状态卡片占据大量垂直篇幅，缺乏自动折叠收敛机制；
4. **对话排版简陋**：大模型输出的 Markdown 语法（标题、代码块、加粗、列表、表格）以纯文本展示，缺乏结构化视觉渲染；
5. **消息缺乏常用动作**：消息气泡缺失复制、重试/重新生成、编辑提示词、删除等快捷操作；
6. **视觉语言未完全统一**：界面多处仍残留彩色 Emoji，破坏了 Design System 2.1 规定的暗色冷灰单色矢量美学，且缺少门禁阻断；
7. **自由沙盒训练缺乏自选**：用户无法自定义指定知识分类、层级深度与抽样题量进行定制化专项刷题；
8. **分层阶梯模式缺乏进阶感**：Layer 1 基础认知 $\to$ Layer 2 规律运用 $\to$ Layer 3 陷阱特例的渐进学习缺乏路线图与晋级反馈；
9. **知识精读页面视觉噪音过大**：精读大厅一次性堆砌所有卡片，色彩杂乱缺乏视觉锚点，无法进行单点深度沉浸式聚焦精读。

本规约旨在对上述 9 大模块提出端到端的系统性重构方案，并在保持架构质量门禁 100% 绿灯的前提下全量落地。

---

## 二、 9 大重构模块设计与可行性方案 (Architecture & Feasibility Analysis)

### 1. 模块一：多平台、多模型配置架构 (Multi-Provider & Multi-Model Config)

#### 1.1 数据结构模型升级
在 `features/ai-agent/session-store.js` 中将原本单一扁平的配置扩展为 Provider Profile 拓扑：

```typescript
interface ModelProvider {
  id: string;              // 如 'deepseek', 'openai', 'ollama', 'custom_1'
  name: string;            // 展示名称: 'DeepSeek 官方', '本地 Ollama'
  baseUrl: string;         // 端点: 'https://api.deepseek.com/v1'
  apiKey: string;          // 密钥 (本地 localStorage 沙箱隔离)
  models: string[];        // 支持的模型列表: ['deepseek-reasoner', 'deepseek-chat']
  defaultModel: string;    // 默认模型
  enabled: boolean;        // 是否启用
}

interface AiConfigV3 {
  activeProviderId: string;
  activeModelId: string;
  providers: ModelProvider[];
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';
  autoApprove: boolean;
  systemPrompt: string;
}
```

#### 1.2 预设内置支持
默认内置 5 大主流提供商预设（DeepSeek、OpenAI、硅基流动、Ollama、阿里千问），用户可自由添加自定义平台（如兼容 OpenAI 格式的企业私有网关或 vLLM 端点），并支持动态追加自定义模型名称。

---

### 2. 模块二：输入框集成快捷平台与模型选择器 (In-Input Quick Model Switcher)

#### 2.1 交互设计
在对话输入框上方/内部工具栏左侧集成快捷模型切换胶囊（Quick Model Pill）：
- 采用原生 styled `<select>` 或紧凑级联 Popover，按提供商分组展示 (`<optgroup label="DeepSeek 官方">`)；
- 用户仅需 1 次点击即可直接切换当前会话的平台与模型；
- 切换时联动更新 `AiAgentClient` 运行态配置与顶栏状态标签，无需打开配置模态框。

---

### 3. 模块三：工具调用自动折叠机制 (Auto-Collapsible Tool Cards)

#### 3.1 状态驱动折叠策略
工具调用卡片根据生命周期状态动态决定展开/折叠行为：
- **`pending` (等待人工确认)**：**默认展开 (`<details open>`)**，高亮显示操作 Diff 与 [批准执行] / [拒绝] 按钮，确保用户不错过关键决策；
- **`executing` (执行中)**：紧凑胶囊带脉冲动画；
- **`success` (已执行并回传)**：**自动收起为单行摘要条 (`<details>`)**，默认仅显示 `[TOOL] tool_create_deck · ✅ 已执行 · 8个考点` 与箭头 `▼`，点击可随时展开查看完整 JSON 参数与数据库回传快照；
- **`rejected` (已拒绝)**：收起为灰色取消胶囊。

---

### 4. 模块四：轻量零依赖 Markdown 渲染器 (Zero-Dep Safe Markdown Formatter)

#### 4.1 技术选型与安全规约
为坚守 Core 2.1 零外部依赖与单文件打包原则，不引入体积超过 100KB 的 marked 或 markdown-it。在 `features/ai-agent/agent-templates.js` 中构建轻量安全流式 Markdown 格式化引擎 `renderMarkdown(content)`：
1. **XSS 硬防护**：先执行 `escapeHtml` 字符转义，再进行安全标签受控还原；
2. **多级标题**：`#`, `##`, `###` 转换为高对比度暗色渐变标题；
3. **行内强化**：`**加粗**`, `*斜体*`, `` `行内代码` ``；
4. **栅格代码块**：```` ```lang\ncode``` ```` 转换为带标题栏、语言标签和一键复制按钮的暗黑代码容器；
5. **表格支持**：识别 `| 表头 |` 语法，渲染为 Tailwind 现代条纹表格；
6. **引用与列表**：支持 `>` 引用块与 `- `、`1. ` 列表，保持段落呼吸间距。

---

### 5. 模块五：消息级快捷操作栏 (Message Hover Actions)

在每一轮对话气泡上注入悬停显式动作栏（Action Toolbar）：
- **用户消息 (User)**：
  - `[复制]`：快速复制 Prompt 到剪贴板；
  - `[编辑]`：将该条内容回填至输入框进行修改重提；
  - `[删除]`：删除当前轮次对话。
- **助手消息 (Assistant)**：
  - `[复制]`：提取纯文本/Markdown 复制；
  - `[重新生成]`：回滚当前步骤并触发 `loop.stepLoop()` 重新请求；
  - `[删除]`：清除该回复。

---

### 6. 模块六：全界面单色矢量化与门禁防护 (Monochrome Vector Icons & Gate)

#### 6.1 去除彩色 Emoji
全面清除界面残留的 Emoji 图标（如 `🤖`, `💬`, `🚀`, `🐳`, `🧠`, `🗑️`, `⚙️`, `⚡`, `📦` 等），全部替换为 `design-system/icons/icons.js` 输出的纯矢量 SVG，统一遵循 `fill="none" stroke="currentColor"` 规范。

#### 6.2 质量门禁规则 `FE-ICON-002`
在 `gates/run-gates.mjs` 中建立自动化扫描门禁：
- 扫描 `app/app-shell.html` 与 `features/` 中 UI 组件模板；
- 若在导航标签、按钮文本或系统提示词中发现未授权 Emoji 字符，门禁立即判定 FAIL，防止彩色图标反弹。

---

### 7. 模块七：自由沙盒训练自定义配置 (Custom Sandbox Training Studio)

#### 7.1 交互与数据流
在竞技大厅 (Arena) 启动前提供「自由沙盒 (Sandbox)」专属配置面板：
1. **知识分类多选 (Categories Selector)**：树状勾选想重点突破的分类，并实时统计选中词条量；
2. **认知层级多选 (Layers Selector)**：自由组合 Layer 1（基础）、Layer 2（规律）、Layer 3（陷阱）；
3. **自选训练量 (Quota)**：快速指定 5 / 10 / 20 / 全部；
4. **乱序模式**：随机混洗或按认知层级递进；
5. 点击即刻构建定制队列 `app.startCustomSandboxQueue(...)` 启动沉浸答题。

---

### 8. 模块八：分层阶梯模式进阶路线图 (Tier Stepped Progression Roadmap)

#### 8.1 视觉化进阶关卡设计
在阶梯模式中引入清爽的关卡进度天梯（Tier Roadmap）：
- **Tier 1: 基础认知**（已解锁，通关目标：正确率 $\ge 80\%$）；
- **Tier 2: 规律运用**（通关 Tier 1 后解锁）；
- **Tier 3: 陷阱与特例**（通关 Tier 2 后解锁）。

#### 8.2 里程碑通关判定与晋级仪式
当当前层级题目刷完且达到 $80\%$ 黄金及格线时，弹出「🎉 阶梯晋级达成」里程碑弹窗，解锁下一层级题目并计入成长档案；未达标则提示针对薄弱点进行巩固重测。

---

### 9. 模块九：知识精读页面视觉重构与单点聚焦模式 (Study Hub Focus Studio)

#### 9.1 双栏沉浸式精读工作台
抛弃原本一次性平铺数百张彩色卡片的混乱瀑布流，重构为 **「左侧知识图谱索引树 + 右侧单点聚焦精读卡片 (Card Focus Studio)」**：
- **左侧图谱导航**：极简树状列表，快速定位知识模块，突出当前选中的考点高亮；
- **右侧单点聚焦卡片 (Focus Card)**：
  - **核心考点与概念**：大字清晰展示考点题干与标准答案，排除周边杂色干扰；
  - **同胞干扰项横向比对矩阵**：将标准答案与 $\ge 3$ 个同胞干扰项并列排布，清晰展示异同点；
  - **高频命题陷阱与助记诀窍**：以沉浸暗黄色调仅突出核心易错辨析点。
- **键盘导航**：支持 `←` / `→` 键即时切换上一条 / 下一条考点。

---

## 三、 实施路径与文件变动清单 (Implementation Roadmap)

| 阶段 | 目标文件 | 变更核心说明 |
| :--- | :--- | :--- |
| **阶段 1: AI 多平台与模型** | `features/ai-agent/session-store.js`<br>`features/ai-agent/agent-ui.js` | 扩展多 Provider/Model 数据模型，实现输入框快捷切换器 |
| **阶段 2: 交互与 Markdown** | `features/ai-agent/agent-templates.js`<br>`app/app-shell.html` | 工具卡片自动折叠、轻量 Markdown 格式化、消息操作工具栏 |
| **阶段 3: 视觉去彩色与门禁** | `design-system/icons/icons.js`<br>`gates/run-gates.mjs` | 补全 SVG 图标，清除 Emoji，建立 `FE-ICON-002` 门禁 |
| **阶段 4: 沙盒自选与阶梯天梯**| `features/arena/quiz-runner.js`<br>`features/arena/stepped-progress.js` | 新增沙盒配置面板，重构 Tier 1 $\to$ 2 $\to$ 3 进阶路线图 |
| **阶段 5: 知识精读单点聚焦** | `features/study-hub/matrix-console.js`<br>`features/study-hub/tree-renderer.js` | 重构为双栏知识树 + 单点三段式沉浸精读卡片 |
| **阶段 6: 编译与质量验收** | `scripts/bundler.mjs`<br>`index.html` | 全量模块打包，14 项门禁校验 100% 通过 |
