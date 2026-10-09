# 页面顶栏空白幽灵间距根因分析与架构门禁规范 (Layout Spacing Ghost Margin Postmortem & Gates)

> **版本**：v2.9 (LAYOUT_INTEGRITY_GOVERNANCE)  
> **状态**：已解决 / 已落地门禁  
> **涉及缺陷**：非仪表盘主视图顶部出现 48px 冗余空白（预期间隙为 24px）  
> **核心受影响文件**：[`app/app-shell.html`](../app/app-shell.html)、[`app/router.js`](../app/router.js)、[`gates/run-gates.mjs`](../gates/run-gates.mjs)  
> **新增架构门禁**：`FE-LAYOUT-001` (Router Outlet Layout Boundary & Sibling Invariant)

---

## 一、 缺陷现场与现象诊断

### 1. 现象描述
用户在使用系统切换到“**知识精读**”视图（`#view-study`）时反馈：
> “页面上面存在空白”

在截图反馈中，位于全局导航顶栏（`<header>`，高 64px）与“HTTP 状态码与网络协议 知识图谱 教材视界”卡片之间，出现了一段明显的暗色空白隔离带，实测高度达到了 **48px**。而在进入首页“仪表盘”时，同一位置的间距仅为标准的 **24px**。

### 2. 几何数据实测对比 (Chrome DevTools 真实渲染测量)

通过 Chrome DevTools MCP 对各视图真实 DOM 几何尺寸（BoundingClientRect）与计算样式（ComputedStyle）进行精准测量：

| 视图标识 | 视图名称 | 顶栏下边界 (`headerBottom`) | 内容首卡片顶部 (`firstChildTop`) | 实测间距 (`gap`) | 视图容器外边距 (`marginTop`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `#view-dashboard` | 仪表盘 | 64px | 88px | **24px** (预期) | **0px** |
| `#view-study` | 知识精读 | 64px | 112px | **48px** (异常加倍) | **24px** (多余外边距) |
| `#view-codex` | 知识法典 | 64px | 112px | **48px** (异常加倍) | **24px** (多余外边距) |
| `#view-arena` | 竞技沙盒 | 64px | 112px | **48px** (异常加倍) | **24px** (多余外边距) |
| `#view-summary` | 结算报告 | 64px | 112px | **48px** (异常加倍) | **24px** (多余外边距) |

**诊断结论**：除了位于 DOM 树首位的 `#view-dashboard` 表现正常外，**所有非首位视图在渲染时均被无故注入了 24px (`1.5rem`) 的 `margin-top`**，叠加 `<main>` 容器本身的 `padding-top: 24px` (`sm:p-6`)，导致总视觉间隙放大一倍达到 48px。

---

## 二、 深度根因分析 (Deep Root Cause)

### 1. Tailwind CSS `space-y-*` 选择器底层机制

Tailwind CSS 的间距工具类 `space-y-{n}` 在 CSS 引擎中编译生成的规则如下：

```css
.space-y-6 > :not([hidden]) ~ :not([hidden]) {
  --tw-space-y-reverse: 0;
  margin-top: calc(1.5rem * calc(1 - var(--tw-space-y-reverse)));
  margin-bottom: calc(1.5rem * var(--tw-space-y-reverse));
}
```

请注意其中的属性选择器：
- Tailwind 使用的是 **`:not([hidden])`**（HTML 原生布尔属性 `hidden`），**而不是 `.hidden`（CSS 工具类类名）**！
- 原因是原生 HTML 规范中，浏览器通过 `[hidden] { display: none; }` 隐藏元素，Tailwind 在选择器中利用此属性避免对隐藏的兄弟节点施加间距。

### 2. 冲突根因：类名隐藏与兄弟选择器穿透

在单页应用（SPA）视图切换中：
1. `<main>` 作为主路由插槽容器，定义了：
   ```html
   <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
   ```
2. `<main>` 的直接子元素是 6 个**互斥的主视图页面容器**：
   - `#view-dashboard`
   - `#view-arena`
   - `#view-summary`
   - `#view-codex`
   - `#view-study`
   - `#view-agent`
3. 路由调度器（`app/router.js`）在隐藏非当前视图时，使用的是类名操作：
   ```javascript
   el.classList.add('hidden'); // 仅设置了 class="hidden" (display: none)
   ```
   而**并未设置 HTML 原生属性** `el.hidden = true`！
4. **CSS 判定连锁反应**：
   - 处于 DOM 前部的 `#view-dashboard` 虽然在视觉上被隐藏（`display: none`），但因为没有 `hidden` 属性，`#view-dashboard.matches(':not([hidden])')` 依然为 **`true`**！
   - 当用户导航至 `#view-study` 时，`#view-study` 作为其后置兄弟节点，完全命中了 `.space-y-6 > :not([hidden]) ~ :not([hidden])`！
   - CSS 引擎因此强制为 `#view-study` 注入了 `margin-top: 1.5rem` (24px)！

### 3. 架构分层违规：路由容器越权控制页面间距

从前端布局架构视角（Layout Architecture）：
- `<main>` 是 **路由出口容器 (Router Outlet)**，它的职责是提供屏幕内容的最大宽度、水平居中以及外边距安全区（`p-4 sm:p-6`）；
- `<main>` 内部的各个子元素并非同一页面内垂直排列的卡片列表，而是**相互独立的完整页面（Full-page Views）**；
- 每个视图容器（如 `#view-dashboard`、`#view-study`、`#view-codex`）**早已在自身根节点封装了 `space-y-6`** 来管理其内部组件之间的纵向节律；
- 在 `<main>` 路由容器上声明 `space-y-6` 属于典型的**布局边界越权（Layout Bleed）**，破坏了模块化的独立封装。

---

## 三、 解决方案与双重防御架构 (Dual-Defense Architecture)

### 防御层 1：根治布局边界越权（移除 `<main>` 的 `space-y-*`）

将 `app/app-shell.html` 中的主容器从：
```html
<main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
```
精简纠正为：
```html
<main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
```
- `<main>` 只负责页面的安全内边距（移动端 16px，桌面端 24px）与水平居中约束；
- 各独立视图保持各自内部的卡片流纵向间距（`space-y-6` / `space-y-5`），互不干扰。

### 防御层 2：原生语义属性双重对齐（属性与类名同步）

在 `app/router.js` 与 `app/app-shell.html` 中实施双保险，确保隐藏的视图同时具备 `class="hidden"` 与原生 `hidden` 属性：
```javascript
// app/router.js
views.forEach(v => {
  const el = document.getElementById(`view-${v}`);
  if (el) {
    el.classList.add('hidden');
    el.hidden = true; // 同步原生属性，彻底阻断任何 :not([hidden]) 选择器误伤
  }
});

const targetEl = document.getElementById(`view-${viewName}`);
if (targetEl) {
  targetEl.classList.remove('hidden');
  targetEl.hidden = false;
}
```
并在 `app/app-shell.html` 的初始模板中，为默认隐藏的视图容器添加 `hidden` 属性声明。

---

## 四、 自动化架构门禁：`FE-LAYOUT-001`

为从工程化体制上杜绝类似“路由容器误加兄弟间距”或“隐藏视图导致幽灵间距”的问题，在 `gates/run-gates.mjs` 中正式增设门禁 **`FE-LAYOUT-001`**：

```javascript
// gates/run-gates.mjs 门禁规则定义
// FE-LAYOUT-001: 路由插槽布局边界与兄弟间距隔离律
1. 检查 <main> 标签的 class，严禁包含 space-y-* 或 space-x-* 兄弟选择器工具类；
2. 检查所有 view-* 视图根容器，确保其在 app-shell.html 初始隐藏时声明了原生 hidden 属性；
3. 检查 app/router.js，确保在执行 navigate 切换视图时，严格同步了 el.hidden = true / false。
```

---

## 五、 验证结果

1. **几何尺寸重测**：
   - `view-dashboard`: `gap = 24px`, `marginTop = 0px`
   - `view-study`: `gap = 24px`, `marginTop = 0px`（成功消除多余的 24px 幽灵空白）
   - `view-codex`: `gap = 24px`, `marginTop = 0px`
   - `view-agent`: `gap = 24px`, `marginTop = 0px`
2. **门禁审计**：`npm test` 16 项架构门禁 100% 全部通过。
