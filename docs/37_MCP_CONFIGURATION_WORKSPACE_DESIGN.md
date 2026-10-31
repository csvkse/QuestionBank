# MCP 配置与工作台子导航优化

日期：2026-11-01。范围：调研并实现当前项目 UI，不改网关、不增加传输协议，不自动发布。

## 结论与现状

采用「AI 智囊 → 智能对话 / MCP 桥接」两项子标签。MCP 桥接从全局页脚移入工作台，原有 19 工具和连接状态机保持复用。标签仅切换可见性，不重建节点、连接或会话；支持 `#agent/mcp` 书签直达。

当前缺口：页脚入口不易发现；地址与房间刷新丢失；连接期间字段仍可编辑，显示值可能不再对应真实连接；客户端地址仅连接后展示，复制困难；工具能力信息只写死为 19；连接状态只有页脚一段文本。新增子标签后必须避免将导航误当断开事件、隐藏页仍有可聚焦控件、移动端嵌套滚动失效、深链接误开启网络连接。

## 方案比较与一手资料

| 方案 | 优点 | 成本与选择 |
| --- | --- | --- |
| 全局页脚 details | 最小实现 | 入口远、与当前任务无关，移除 |
| 新增顶级 MCP 页面 | 入口明显、独立路由 | 当前主导航已有 4 项，窄屏更拥挤；不增加顶级入口 |
| AI 工作台子标签 | 对话与对外工具共享认知范围，复用现有路由 | 推荐；保持两个面板常驻 DOM、连接状态独立 |
| 统一配置中心/多服务管理 | 适合大量连接 | 本轮只有一个 Host，暂不建设 |

VS Code 将 MCP 配置、启动停止与输出组织为服务管理入口，值得借鉴“配置和实时状态分开”的原则；其工具消费方向与本项目工具提供方向不同，不照搬进程启动、OAuth 或多服务器配置。[官方管理说明](https://code.visualstudio.com/docs/agents/run/manage-mcp-servers)

WAI-ARIA APG 的 Tabs Pattern 规定 tablist/tab/tabpanel 关系、选中态、roving tabindex、左右方向键及 Home/End。两个面板本地常驻、切换无网络等待，适合方向键自动激活。[官方规范](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

| 可用库 | 适配性 | 本次取舍 |
| --- | --- | --- |
| Radix Tabs | 有成熟 React 无障碍标签组件 | 当前原生 ESM，没有 React；借鉴交互，不引入框架。[官方](https://www.radix-ui.com/primitives/docs/components/tabs) |
| Shoelace/Web Components | 原生页面较易集成 | 原项目已 sunset，文档建议 Web Awesome；两个标签不值得新增依赖。[官方状态](https://shoelace.style/components/tab-group) |
| XState | 可表达并行状态与恢复流程 | 复用现有连接状态机；视图选择只有两态，独立小控制器足够。[官方](https://stately.ai/docs/xstate) |
| 原生 HTML / Clipboard / localStorage | 零新增运行依赖 | 采用；存储/复制可能不可用，需显式反馈与手工复制路径。[存储边界](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) |

## 复用与设计模式

- AppRouter 管理顶层页面；新增 AgentWorkspaceNavigation 仅管理工作台子标签，不把 MCP 加入所有顶层 views。
- 复用 McpToolAdapter、BrowserBridgeTransport、Web Locks、MCP_BRIDGE_LABELS 的状态来源。连接/断开只由现有表单动作或 pagehide 触发。
- 配置存储适配器 McpPreferences 只允许 `{server,room}`，版本化独立 key；用户选择记住时保存，可清除。Token 不进入 localStorage、URL、复制内容或书签，不自动连接。
- 展示模型集中从连接状态派生按钮/输入锁定与状态文案，避免模板和事件处理器各自维护 busy 布尔值。连接状态机与导航状态相互独立。
- 客户端配置生成采用纯函数：复用 bridgeConnectionUrl 校验，再生成旧 SSE URL 与含占位符的接入说明；不使用某一客户端特定 JSON 格式冒充通用配置。

## 界面与逻辑

继承现有字体与设计令牌：canvas #020617、card #0b1120、inset #111c33、正文 slate、强调 #6366f1；不额外添加字体、插画或装饰动画。横向子标签位于工作台顶部，右侧轻量状态标记。内容左对齐，MCP 面板自滚动，桌面设置/接入双列、窄屏单列。

```text
AI 智囊
  [智能对话] [MCP 桥接]              未连接 / 已连接
  MCP 桥接
  向可信客户端提供当前页面题库工具
  连接设置                         客户端接入
  地址 / 房间 / 临时 Token          SSE 地址 / 复制地址
  记住地址与房间                   鉴权说明（占位符）
  连接 / 断开 / 清除已记住配置      当前状态 / 最近调用
  可用工具（由目录生成）
```

连接时锁定地址、房间、Token，修改前先断开，避免显示与实际不一致。未连接时即可预览并复制经过验证的 SSE 地址；复制失败允许手动选择。地址/房间变化更新说明，不发网络请求。保留已连接配置快照，Token 输入连接时清空。

工具列表取现有目录一次渲染，避免复制 schema；对用户展示中文用途，保留协议名供核对。长列表折叠，默认展示数量，页内提示包含删除与回滚能力，全部工具仍可直接调用。

`#agent/chat` 和 `#agent/mcp` 只保存页面位置。支持刷新、hashchange 与方向键，未知 hash 不自动连接。面板切换隐藏/inert 配合，屏幕阅读器与键盘只进入当前面板。离开顶层 AI 页仍保持连接，pagehide 才按现有规则断开。

## 实施与验收计划

1. 添加导航与配置模型的聚焦失败测试，再实现两态导航、配置白名单存储、状态派生和 URL 生成。
2. 移动 MCP 表单并增加子标签；扩展 controller 的偏好读取、字段锁定、地址复制和工具目录；接入 main 与 bundler。
3. 检查连接中取消/异步回调，避免断开后迟到的锁回调重新开始连接。
4. 最小测试通过后运行相关既有测试、生成 index、质量门禁；真实浏览器验证键盘、深链接、窄屏、刷新偏好及 Token 不保存。
5. 用本地真实 ProxyByCF + 官方 SDK 重跑 19 工具，切换到聊天和离开工作台后连接保持，断开才停止。无需重做公网验证或使用真实凭据。

性能预算：切换只改固定少量 DOM 属性，不重绘聊天历史、不连接网络；19 项目录只渲染一次；偏好只在显式连接/清除时写入，输入事件只更新接入预览。本轮不增加 React、Tabs 库、XState 或远程字体。

尚不建设：多房间配置列表、自动连接、Token 持久化、网关管理、跨客户端访问控制、新版 MCP 传输。

## 实施与验证结果

已实现上述双标签工作台，移除全局页脚 MCP 表单；新增 `features/ai-agent/workspace-navigation.js` 和 `features/mcp-bridge/settings-model.js`，扩展现有桥接 controller，接入 main 与打包模块清单并生成 index.html。未安装新依赖、未修改网关，未提交、推送或触发线上发布。

实际验证：

- 全部单元测试 **28 项通过**；新增导航/配置用例包含 hash 恢复、方向键选择、DOM 不重建、凭据白名单存储、不可用存储降级、连接中字段状态、URL 生成、迟到连接锁取消与 AI 导学回到聊天。
- `npm test`：**21 门禁通过、0 失败、2 个既有警告**（薄弱分类与执行器 307 行）；`npm run bundle` 成功，产物约 587.7KiB。
- 真实浏览器访问 `index.html#agent/mcp`，顶层直接进入 AI、选中 MCP；点击智能对话与键盘 End 切回 MCP，面板 hidden/inert 和 ARIA/tabindex 正确，不重建节点。
- 真实本地 ProxyByCF Worker/DO + 外部官方 SDK + 浏览器 Host，全部 **19 个工具**实际调用通过；切到聊天、离开顶层 AI 工作台，transport 仍为 READY。
- 连接后配置输入锁定，Token 清空；刷新恢复 server/room，Token 为空、transport 为 DISABLED；清除按钮删除偏好且取消勾选。
- 浏览器 Clipboard 实际复制 SSE 地址成功，检查复制内容不含测试 Token；桌面 1280×900 与窄屏 390×844 均无横向溢出，窄屏 MCP 内容可以独立滚动。检查了实际桌面截图。
- 从 MCP 发起 AI 导学会选中聊天、更新书签并将提示词填入可见输入框。审阅发现的此项回归已先复现失败测试，再修复。

实现期间门禁曾发现 Node 下无 window 的构造问题，已改为可注入全局依赖，复验通过。连接锁等待时断开会增加 attempt 世代，迟到回调不会再连接；测试先复现旧行为失败，再验证修复通过。

剩余边界：子导航采用 replaceState 保存当前位置，未新增完整前进后退历史路由；浏览器安全/隐私策略可能阻止记住配置或复制，界面给出提示与手工复制方式；连接不支持 file://，不声称本轮已重新做公网压测。此前公网 19 工具记录仍见第 36 号文档，本轮使用隔离本地网关，不使用真实 Token。
