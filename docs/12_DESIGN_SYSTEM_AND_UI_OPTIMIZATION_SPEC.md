# 12. 前端设计规范落地与设计令牌重构规范 (Design System & UI Spec)

> **对应标准**：参考 `D:\D\Notes\Note\1 工作\笔记\技术发展历史\前端设计规范` 体系  
> **核心规范**：`界面设计核心规范.md`、`色彩设计核心.md`、`4类层级色彩关系和设计技巧.md`、`设计令牌-反面问题及设计门禁.md`、`界面容器和元素及图标尺寸设计方法和标准.md`、`平面设计容器排版发展历史-层级介绍.md`  
> **版本**：v2.2-UI  
> **状态**：ACTIVE  

---

## 一、 现状审查与设计债务诊断 (Audit & Gap Analysis)

在 Core 2.1 物理架构拆分完成后，系统的逻辑层与存储层已达到企业级质量，但界面呈现层（UI Layer）仍存在以下典型设计债务：

| 债务分类 | 现有问题表征 | 规范红线违反项 | 优化重构目标 |
| :--- | :--- | :--- | :--- |
| **色彩过载 (Chroma Noise)** | Dashboard 统计卡片与药丸标签同时高亮显示亮紫、亮绿、琥珀黄、玫瑰红，呈现“彩虹化”杂色 | 违背 **70%~90% 中性色** 底线与克制原则 | 确立 `slate` 暗夜低彩中性骨架，全域色彩收敛为单品牌族（Indigo）+ 单强调族（Amber/Cyan），状态色按需 |
| **CTA 并发竞争 (Rule of One 失效)** | 首页同时存在“开始快速对决”、“知识精读”、“创建新卡包”、“错题强化”等多个高彩实色主按钮，视觉焦点散乱 | 违背 **视觉焦点唯一律 (Rule of One)** | 同一视口仅保留 1 个高彩度实色 Primary CTA（如“开始强化训练”），其余降级为弱底 (Subtle) 或幽灵边框 (Ghost) |
| **框盒滥用 (Box Overuse)** | “结构不够，框来凑”：列表项、卡片、模态框内到处是 `border border-slate-700` 重边框，缺乏透气感 | 违背 **层级演进铁律**（能靠对齐不加框，能靠间距不加卡） | 建立 **Surface 0～4 明度阶梯**，主要依靠表面阶梯与负空间留白建立层级，边框转为纤细弱分隔 (`--border-subtle`) |
| **令牌链路缺失 (Token Disconnect)** | `design-system/tokens/colors.css` 变量未与应用业务层深度绑定，大量手写 Tailwind 离散颜色 | 违背 **4 层 Token 模型** (Primitive → Semantic → Component) | 建立完整语义化 Token 体系，由构建器（Bundler）自动化注入全局，统一维护 |
| **排版与热区 (Typography & Ergonomics)** | 部分辅助说明在暗色下对比度低于 4.5:1，部分图标按钮的触控热区未与视觉尺寸解耦 | 违背 **WCAG 2.2 AA** 与 **最小点击热区 ≥ 24px** 规范 | 建立 7 级标准字阶与行高；小图标解耦填充至少 28px/32px 点击区域 |

---

## 二、 4 层设计令牌体系架构 (4-Tier Design Token Architecture)

根据《色彩设计核心》与《设计令牌-反面问题及设计门禁》，建立纯正的 4 层 Token 映射链条：

```text
[Layer 1: Primitives (基础物理值)]
  └── oklch / hex 调色板 (slate-50...950, indigo-50...950, amber-500, emerald-500, rose-500)
       │
[Layer 2: Semantic Tokens (语义角色令牌)]
  ├── Surface 层级:  --surface-canvas (0) → --surface-card (1) → --surface-inset (2) → --surface-raised (3) → --surface-overlay (4)
  ├── 文本明度层级:  --text-primary (AA+) → --text-secondary → --text-tertiary
  ├── 结构边框层级:  --border-subtle → --border-default → --border-strong → --border-focus
  ├── 动作与焦点:    --action-primary (唯一强CTA) → --action-secondary → --action-ghost
  └── 语义反馈:      --status-success / warning / error / info (带配套 bg & border)
       │
[Layer 3: Component Tokens (组件令牌)]
  └── Button, Pill, Modal, Card, TreeItem 专属绑定的交互状态 (Default, Hover, Active, Focus, Disabled)
       │
[Layer 4: Theme Overrides (主题方案)]
  └── 默认深邃夜航 (CyberSlate Dark)，预留明暗主题动态无缝切换能力
```

### 1. 表面层级阶梯 (Surface Elevation Ladder)

在暗色调界面中，通过细微的明度递进表达空间高程，而非过度依赖阴影与重框：

```text
┌─────────────────────────────────────────────────────────────────┐
│ Surface 0: 画布底色 (--surface-canvas: #020617 / slate-950)        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Surface 1: 内容卡片容器 (--surface-card: #0b1120 / slate-900+) │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │ Surface 2: 控件/输入框/嵌套 (--surface-inset)    │   │   │
│   │   │   ↳ 悬停抬升: Surface 3 (--surface-raised)      │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
      ▲ 浮层层级: Surface 4 (--surface-overlay: #0f172a / modal popover)
```

### 2. 视觉面积黄金比例控制

```text
Neutral (中性色)    75% ~ 85%  → 主导背景、卡片、边框、普通文本
Brand (品牌色)      10% ~ 15%  → 主导航激活、品牌标徽、主操作按钮
Accent (强调色)      2% ~ 5%   → 连击高潮火花、高优先级倒计时、极重要焦点
Status (状态色)     按需极克制  → 仅在判题正确/错误、复习预警时精准出鞘
```

---

## 三、 分区排版与视觉层级演进规范 (Layout & Typography Ladder)

遵循《平面设计容器排版发展历史-层级介绍》的 **从轻到重阶梯**：

$$\text{Grid} \longrightarrow \text{Alignment} \longrightarrow \text{Spacing} \longrightarrow \text{Typography} \longrightarrow \text{Shape} \longrightarrow \text{Surface} \longrightarrow \text{Border} \longrightarrow \text{Elevation}$$

### 1. 排版字阶规范 (Typographic Hierarchy)

| 级别 | Token | 字号 / 行高 | 字重 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `--font-size-3xl` | 28px / 1.25 | Bold (700) | 竞技场大题干、连击大计分 |
| **Title 1** | `--font-size-2xl` | 22px / 1.3 | SemiBold (600) | 页面一级主标题、模块大标题 |
| **Title 2** | `--font-size-xl` | 18px / 1.35 | SemiBold (600) | 卡片标题、模态框主标题 |
| **Subhead** | `--font-size-lg` | 16px / 1.4 | Medium (500) | 分组名称、列表区块小标 |
| **Body (正文)** | `--font-size-base` | 14px / 1.5 | Regular (400) | 知识点正文、选项文字、主描述 |
| **Secondary**| `--font-size-sm` | 13px / 1.45 | Regular (400) | 辅助说明、统计指标标签、次级信息 |
| **Caption** | `--font-size-xs` | 11px / 1.4 | Medium (500) | 标签Pill、徽标、微元数据、快捷键 |

### 2. 8-Point 间距步进规范 (Spacing Scale)

- **Micro (内距)**: `4px` (`--space-1`)、`8px` (`--space-2`) —— 按钮内边距、图标与文字间距。
- **Component (组内)**: `12px` (`--space-3`)、`16px` (`--space-4`) —— 卡片内部字段之间、输入控件间距。
- **Section (区块间距)**: `24px` (`--space-6`)、`32px` (`--space-8`) —— 模块卡片之间、列表分段。
- **Macro (页面边距)**: `48px` (`--space-12`) —— 大视图切换主间距。

---

## 四、 页面级重构改造方案与视觉焦点规划 (Per-View Refinement)

### 1. 顶部全局导航 (Global Header)
- **视觉去噪**：消除过多的实色药丸，统一为 Surface 1 半透中性磨砂底，突出品牌徽标与题库切换。
- **触控解耦**：题库切换下拉与按钮增加安全内边距，保持高度 $\ge 32\text{px}$。
- **连击热区**：火焰连击仅在数值 $>0$ 时呈现微动态金色高亮，其余时间为低调中性灰度。

### 2. 控制台 (Dashboard)
- **落实 Rule of One**：全屏仅保留【开始强化训练】为高彩度品牌主按钮（Brand Solid CTA）。
- **次级降级**：【知识精读】与【错题强化】转为 Surface 2 弱底卡片或 Ghost 幽灵边框按钮。
- **去框留白**：统计数字卡片去除重边框，依靠 Surface 0 到 Surface 1 的柔和色差与 16px 留白形成自然分区。

### 3. 竞技场 (Arena View)
- **聚焦题目本身**：弱化周边的辅助仪表盘，将答题区设为最高对比度 Surface，选项卡片悬停反馈自然平滑。
- **反馈通道多重化**：提交答案时不仅依赖绿/红颜色，同时伴随对勾/叉号图标与触觉微震动提示。

### 4. 知识精读与树状矩阵 (Study Hub)
- **结构化排版**：知识矩阵左侧树状结构严格左对齐（Alignment First），层级通过缩进与微缩字阶表达，彻底移除多余垂直线与外框。
- **Markdown 精读区**：阅读器增加最大阅读宽度限制（`max-w-3xl`）、优化正文行高（`leading-relaxed`），提升长时间沉浸阅读的护眼度。

### 5. 模态窗口 (Modals & Drawers)
- **Surface 4 规范**：背景遮罩采用平滑的 `backdrop-blur-sm bg-black/60`，弹窗本体采用 Surface 4 底色与 `--border-subtle`，明确“取消”使用 Ghost，“保存/确认”使用唯一 Primary CTA。

---

## 五、 工程落地与质量门禁设计 (Implementation & Quality Gates)

1. **Tokens 文件更新**：
   - 强化 `design-system/tokens/colors.css`：输出完整的 Primitive 与 Semantic 变量。
   - 强化 `design-system/tokens/typography.css`：输出字阶、字重与行高变量。
   - 新增 `design-system/tokens/elevation.css`：输出表面阶梯与投影变量。
2. **构建器自动化**：
   - 更新 `scripts/bundler.mjs`，将 `design-system/tokens/` 下的所有 CSS 规则自动打包注入到 `index.html` 的 `<style id="design-tokens">` 中，保证单文件独立分发。
3. **架构质量门禁追加**：
   - 在 `gates/run-gates.mjs` 中增加 `FE-DESIGN-001: Design Token Completeness`（检查所有必需的语义 Surface、Text、Action 令牌均已定义）。
4. **内置浏览器 MCP 视觉走查**：
   - 通过 `chrome-devtools-mcp` 验证渲染后的视觉层级、WCAG 对比度与零控制台报错。
