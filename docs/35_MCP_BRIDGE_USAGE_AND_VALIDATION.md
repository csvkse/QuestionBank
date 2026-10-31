# MCP 桥接使用与验证

## 使用

运行 `npm run dev` 后打开本机页面，或使用 HTTPS 托管的 `index.html`。页面底部展开「MCP 桥接」，输入现有 ProxyByCF 的网关根地址、独立房间名称和 Token，点击「连接并启用全部工具」。网关需已开启 Bridge/MCP，Token 具有 mcp 或兼容 ws_bridge scope；同房间的新 Host 会替换旧 Host。

外部 MCP 客户端配置：

```json
{
  "url": "https://YOUR_GATEWAY/mcp/sse?room=YOUR_ROOM",
  "headers": { "Authorization": "Bearer YOUR_TOKEN" }
}
```

选择旧 SSE 传输，不能将该地址当成 Streamable HTTP。配置文件结构随客户端变化；上面仅列出端点与请求头。连接后可发现并直接执行当前全部 19 个 Agent 工具，包括删除、批处理、快照和回滚；本地 AI 的自动批准开关不参与。Token 仅保存在运行内存，输入框连接时清空，断开/关闭后不自动恢复。网关可访问中转数据；AES 信封不是客户端到页面的零信任端到端加密。

REGISTERED 表示注册清单已发送；现有网关没有 ACK。第一次工具调用抵达页面后显示已验证。连接失败会有限次随机退避重试；同房间 Host 被替换后停止争抢。断开或离开页面会停止新调用，已有同步执行无法撤销。

原生 WebSocket 不允许设置鉴权 HTTP 头；实现使用网关已有 `['aes-256-gcm', token]` 子协议，不把 Token 写入 URL。远程只接受 WSS；本机允许 localhost/127.0.0.1/::1 的 WS，且页面必须处于安全上下文。file:// 的离线题库可使用，桥接连接需改从 HTTPS/localhost 打开。

## 结构与行为

- `features/mcp-bridge/tool-adapter.js`：共享 Agent 定义映射 MCP，校验当前 schema 使用的 type/required/properties/items/enum，错误封装，显式 operationId 幂等账本（最多 256 项，内存级）。不是通用 JSON Schema 引擎；新增 schema 关键字需同步扩展或改用 Ajv。
- `platform/network/browser-bridge-transport.js`：兼容网关 AES 信封、主动 WS、注册、心跳、有限重连、世代过滤、8 条等待上限、收到消息后 25 秒排队截止；不自动重放调用。
- `features/mcp-bridge/controller.js`：页面配置、状态、最近调用、Web Locks 防止同源重复 Host（浏览器支持时）。显式新连接清空幂等账本；自动重连保留。
- `DeckToolExecutor`：本地 Agent 与远程共用执行器。写入同步完成、暂存存储，失败恢复页面/版本/回收站内存；创建使用 UUID，实体变更补健康度/重复 ID/分类引用校验，字段修改有白名单。
- `StorageAdapter.runTransaction`：暂存写入并同步提交，失败尝试恢复原存储；多 localStorage key 不具备崩溃原子性，恢复也失败时明确报错。桥接成功不代表跨崩溃恰好一次。

读取响应超过 256KiB 报 RESULT_TOO_LARGE，保持完整返回语义；写入已成功且响应过大时返回小型成功回执。现有题库健康上限为 500 条，不承诺无限大题库。best_effort 批量更新按既有规则跳过不存在项，最终候选题库不健康则整次恢复。

operationId 为 `tools/call` 的 `params._meta.operationId` 可选扩展。重复同 ID 同参回缓存，同 ID 异参报错；普通客户端没有该标识时仍可正常调用，超时后请查询题库确认，不应盲目重试写入。房间与共享 Token 不能区分多个不可信用户，当前网关跨客户端相同 RPC ID 也尚未隔离，本项目不承诺解决该服务端问题。

本地 UI 编辑草稿可在远程更新后变旧；避免同时保存另一个标签页或未刷新的编辑草稿。Web Locks 只限制桥接 Host，不锁住所有 UI 写入。页面冻结、跨标签页并发编辑、突然关机等需要更强后端/事务模型，不由重连解决。

## 实际验证（2026-10-31）

已执行：

1. `node --test tests/unit/*.test.mjs`：既有测试和新桥接测试通过。新增测试覆盖 19 工具真实业务路径、无效写入恢复、幂等冲突、存储失败、大写入成功回执、加密信封、防篡改、停止后旧消息不执行、排队过期不执行。
2. `npm run test:mcp:integration`（配置 PROXYBYCF_ROOT）：官方 SDK → SSE → 本地真实 ProxyByCF Worker/DO → 原生加密 WebSocket → 共享真实执行器，19 项全部实际调用并检查错误返回及保存数据，无部署。
3. 真实浏览器加载生成页面，填写表单连接同一本地 Worker；外部官方 SDK 经网关调用全部 19 工具。题库变化在 app.state 中可见，刷新后仍为 5 条实体且保留 6 个版本；Token 未出现在 localStorage。390px 窄屏和桌面无横向溢出。
4. 本机单轮网络调用样本（非压测）：Node Host 平均约 13ms；真实浏览器 Host 平均约 24ms、最大约 57ms。仅代表本机合成小题库，不能推断公网延迟、吞吐或 SLA。
5. 最终 `npm test`：21 个门禁通过、0 失败，2 个警告（既有 10 个薄弱分类、本次执行器 307 行）；完整单元测试计 23 项全部通过。`npm run bundle` 成功生成包含桥接入口的 index.html。构建产物目录 dist 已纳入允许的物理目录，测试缓存加入 Git 忽略。

复现本地互操作：

```powershell
$env:PROXYBYCF_ROOT = '你的 ProxyByCF 仓库绝对路径'
npm run test:mcp
npm run test:mcp:integration
```

引用仓库需已有 `examples/mcp-bridge-client` 测试依赖与 Worker fixture；本项目未安装新依赖。`node tests/integration/mcp-proxybycf.mjs --serve` 输出临时页面/网关地址和随机配置路径，不输出 Token；配置路径仅由临时 localhost 服务提供，使用后停止服务。将页面连接后，可设置 `MCP_TEST_GATEWAY` 并运行同一脚本 `--browser-client` 重跑 19 项。脚本会在隔离测试页面创建合成题库，不要指向真实工作页面。

生成独立测试产物：`BUNDLE_OUTPUT=dist/mcp-bridge.html` 环境变量下执行 `npm run bundle`；默认生成 `index.html`。本轮生成前确认原 index 已有新增内容全部存在于源码生成产物，避免丢失已有工作。

2026-11-01 已补充真实公网网关联调，19 项全部通过，详见 [36_MCP_BRIDGE_PUBLIC_VALIDATION.md](./36_MCP_BRIDGE_PUBLIC_VALIDATION.md)。未执行真实用户数据测试、长时间休眠/大并发压测或网关安全加固；未修改 ProxyByCF 源码或部署。Node 26 的已有 localStorage experimental warning 不影响测试断言。
