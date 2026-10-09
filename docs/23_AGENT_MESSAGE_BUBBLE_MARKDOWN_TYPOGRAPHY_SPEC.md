# Agent 会话消息框排版行距根因分析与排版节奏门禁规范 (Agent Message Bubble Markdown Typography Spec)

> **版本**：v3.0 (TYPOGRAPHY_AND_BUBBLE_RHYTHM)  
> **分类**：前端排版工程 / Markdown 块级语义化解析 / 视觉间距节奏  
> **状态**：已解决 / 已落地门禁  
> **核心受影响文件**：[`features/ai-agent/agent-templates.js`](../features/ai-agent/agent-templates.js)、[`features/ai-agent/agent-ui.js`](../features/ai-agent/agent-ui.js)、[`gates/run-gates.mjs`](../gates/run-gates.mjs)  
> **新增架构门禁**：`FE-TYPO-001` (Agent Message Typography & Markdown Block Spacing Invariant)

---

## 一、 缺陷现场与量化诊断

### 1. 现象描述
用户在使用 AI 智囊（AI Agent）会话窗口时反馈：
> “优化Agent会话详情列表 消息框 当前内容 排版行距设置存在问题”

在助手欢迎词与常规 AI 回复消息气泡中，列表项之间的上下垂直间距极其夸张，整段文字显得支离破碎、散落各处，缺乏段落聚拢感与阅读节奏感。

### 2. 真实 DOM 几何测量数据 (Chrome DevTools 现场实测)

通过 Chrome DevTools MCP 对消息气泡内部子节点进行边界尺寸与计算样式测量：

| 测量对象 | 修复前表现 | 修复后实测 | 视觉影响 |
| :--- | :--- | :--- | :--- |
| **列表项之间实际净间隙** | **35.5px** | **6px** (`space-y-1.5`) | 消除接近 6 倍的空洞级断层空白 |
| **首条列表项与上文间距** | **30px** | **8px** (`space-y-2`) | 解决上紧下空的割裂感 |
| **气泡整体高度 (`offsetHeight`)** | **221px** | **178px** | 节省 **43px** 冗余无意义纵向空间，屏效提升 20% |
| **气泡内 DOM 节点结构** | `<div>...</div><br><div>...</div>` 散乱嵌套 | `<p>...</p>` + `<ul><li>...</li></ul>` 语义聚合 | 杜绝 Block 元素与行内 `<br>` 的非法穿插 |

---

## 二、 深度根因分析 (Deep Root Cause)

### 1. 正则按行替换遗留换行符与全局 `<br>` 叠加

此前 `renderMarkdown` 在处理无序列表时采用行级正则：
```javascript
text = text.replace(/^\- (.*$)/gim, '<div class="flex items-start ...">$1</div>');
...
text = text.replace(/\n/g, '<br>');
```
**致命连锁反应**：
- `replace(/^\- (.*$)/gim, ...)` 仅替换了行内文本，而行尾的换行符 `\n` 依然原封不动保留在字符串中；
- 随后执行的 `replace(/\n/g, '<br>')` 将换行符转义成了 `<br>`；
- 最终生成的 HTML 为：
  ```html
  <div class="flex items-start ...">item 1</div>
  <br>
  <div class="flex items-start ...">item 2</div>
  <br>
  ```
- 在浏览器排版模型中，`<div>` 本身为块级元素（自带独立换行上下文），在块级元素之后紧接着一个 `<br>` 会强制插入一个空行的高度（19.5px）。

### 2. 外层容器 `space-y-1.5` 导致间距二次乘数放大

在 `features/ai-agent/agent-ui.js` 中，消息气泡内部的容器声明为：
```html
<div class="space-y-1.5 leading-relaxed">${markdownBody}</div>
```
Tailwind CSS 的 `space-y-1.5` 规则是：
```css
.space-y-1.5 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 0.375rem; /* 6px */
}
```
因为上述 HTML 中包含裸露的 `<br>` 与 `<div>` 兄弟节点：
1. `<div> item 1` 本身自带 `my-0.5`（2px）；
2. 紧接着的 `<br>` 被作为兄弟元素，被注入了 `margin-top: 6px`；
3. `<br>` 本身具有字体行高（19.5px）；
4. 紧接着的下一个 `<div> item 2` 又被作为兄弟元素，被注入了 `margin-top: 6px` 与 `my-0.5`（2px）；
5. **合计间距**：`2px + 6px + 19.5px + 6px + 2px = 35.5px`！
对于 12px 字号、19.5px 行高的正文排版，高达 35.5px 的项目间距严重违背了平面排版“亲密性原则”（Proximity Principle）。

### 3. 缺乏块级语义隔离（Block-Level Grouping）

- 文本段落没有独立的 `<p>` 容器保护，导致段落间空行（`\n\n`）不得不依赖 `<div class="h-2"></div>` 补丁，与外层 `space-y` 产生破坏性叠加；
- 多个列表项没有汇总至 `<ul>` 或 `<ol>` 中，无法统一定义列表内项与项之间（Item-to-Item）和列表与外部段落（List-to-Paragraph）的双层间距节律。

---

## 三、 解决方案与架构重构

### 1. 轻量状态机块级解析器重构 (`renderMarkdown`)

在 [`features/ai-agent/agent-templates.js`](../features/ai-agent/agent-templates.js) 中重构为状态驱动的块级格式化器：
1. **代码块隔离占位**：预先提取 ```` ``` ```` 代码块为占位符 `__CODE_BLOCK_i__`，确保代码内容脱敏不受干扰；
2. **块级状态机流式归集**：
   - 空行 `!trimmed`：触发当前未闭合块（段落、列表、引用、表格）的完全封箱（Flush）；
   - 列表项 `^[\-\*]\s+` / `^\d+\.\s+`：自动归入连续的 `currentList`，封箱时包裹为标准的 `<ul class="space-y-1.5 pl-0.5 my-1.5">` 或 `<ol>` 结构；
   - 引用 `^>\s+`：连续行自动归入单块 `<blockquote class="...">`；
   - 普通文本行：归入 `currentPara`，使用行内 `<br>` 连接，封箱时包裹为 `<p class="leading-relaxed">`；
3. **彻底铲除幽灵换行**：
   - 列表项内部与项之间 **绝对零 `<br>` 注入**；
   - 列表项间距严格由 `ul` 容器的 `space-y-1.5`（6px）精准控制。

### 2. 气泡外层容器排版标准化 (`agent-ui.js`)

在 [`features/ai-agent/agent-ui.js`](../features/ai-agent/agent-ui.js) 中将气泡正文容器规范化：
```html
<div class="space-y-2 text-xs leading-relaxed text-slate-200">${markdownBody}</div>
```
- 各块级语义容器（`<p>`, `<ul>`, `<ol>`, `<pre>`, `<blockquote>`, `<table>`）之间享受恒定的 `space-y-2`（8px）标准段落流外间距；
- 列表项内部享受 `space-y-1.5`（6px）内间距；
- 用户消息气泡补充 `whitespace-pre-wrap break-words`，确保长 Prompt 与多行输入不折叠。

### 3. 操作人体工学：消息操作栏下移归位 (Bottom Action Toolbar)

此前操作栏采用浮动定位 `absolute -top-7` 悬浮于气泡右上角，存在两大操作痛点：
1. **视觉与注意力断层**：用户读完一条消息时，目光与光标停留在气泡**底部**，若需复制或重提，需折返至右上角；
2. **遮挡与裁剪风险**：顶栏 `-top-7` 容易与上一条消息或容器边缘发生重叠，甚至被滚动容器截断；
3. **触控交互盲区**：依赖 `group-hover:opacity-100`，在触屏或平板上无法便捷唤出。

**重构设计**：
- **位置归位**：统一移动至消息气泡**正下方**（`mt-1.5 flex items-center gap-1.5`）；
- **对齐规范**：
  - 助手消息（靠左）：操作栏靠左排列，提供【复制】、【重新生成】、【删除】；
  - 用户消息（靠右）：操作栏靠右排列，提供【复制】、【编辑】、【删除】；
- **视觉层级**：默认保持轻度微显（`opacity-70`，低对比度不抢视觉重心且触屏随时可见），鼠标悬停或触控时平滑加亮（`hover:opacity-100`）；
- **图标与文字结合**：采用纯单色矢量 SVG 图标搭配微型文字标签，操作目标明确直观。

---

## 四、 自动化架构门禁：`FE-TYPO-001`

为长久防止后续迭代中再次引入“块级标签与孤立换行符混杂”导致排版失真，在 [`gates/run-gates.mjs`](../gates/run-gates.mjs) 中增设 **`FE-TYPO-001`** 门禁：

```javascript
// FE-TYPO-001: Agent Message Typography & Markdown Block Spacing Invariant
1. 校验 renderMarkdown 输出规范：
   - 严禁包含 </div><br> 或 </li><br> (禁止块元素与孤立换行符混用);
   - 严禁包含 </li><div (禁止无意义占位 div 污染列表间距);
   - 列表必须具备语义化 <ul class="space-y-1.5 或 <ol class="space-y-1.5 包装;
   - 普通段落必须具备 <p class="leading-relaxed 包装。
2. 校验 agent-ui.js 与 agent-templates.js：
   - 气泡文本必须明确声明 leading-relaxed (1.625) 行高;
   - 用户消息气泡必须具备 whitespace-pre-wrap 防换行塌陷保护。
```

---

## 五、 验证结果

1. **DOM 测量**：列表项间隔由 35.5px 修正为标准的 6px，行高保持优雅的 19.5px（1.625 倍字号），整体视觉高度收敛 43px。
2. **架构门禁**：`npm test` 17 项企业级架构门禁与 9 项单元测试全部 100% PASS。
