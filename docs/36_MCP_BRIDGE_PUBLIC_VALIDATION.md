# MCP 桥接公网联调记录

验证日期：**2026-11-01，香港时间约 00:04–00:07**。

## 结论

**通过：外部官方 MCP 客户端使用现有 `https://proxy.example.com`，发现并直接调用当前浏览器页面全部 19 个 Agent 工具。** 无逐次批准，无本地 AI 对话参与；不是 localhost 模拟网关。

实际链路：

```text
本机外部 MCP SDK 1.32.2
    → 公网 HTTPS SSE / POST → proxy.example.com（现有 ProxyByCF）
    → 公网 WSS / AES 信封 → 本机真实浏览器 index.html
    → McpToolAdapter → 共享 DeckToolExecutor → 页面状态 / localStorage
```

Host 页面与外部 SDK 客户端运行在同一台机器，以独立公网连接访问 Cloudflare；未验证另一台物理机器、不同地域或运营商。页面通过独立临时 localhost 端口运行，初始自定义题库为 0，全部写入对象为本次合成题库。

## 环境与配置

- 网关：[proxy.example.com](https://proxy.example.com)，未改代码、配置或部署。
- 接入方式：旧 SSE `/mcp/sse?room=...`，Authorization Bearer；Host 使用 WSS `aes-256-gcm` 子协议与现有 Token。
- 房间：`knowledge-arena-public-8a344b2a-f98d-44db-9e01-c170757c1b62`，专用于本次联调。
- 凭据：用户提供临时 Token；未创建、修改或主动吊销该凭据，文档不记录密钥。
- 客户端：参考项目已有官方 SDK 与 Undici；沿用此前已确认的 HTTP/1.1 独立连接池（8 连接、pipelining=1、allowH2=false），避免本环境默认 dispatcher 的 SSE/POST 连接问题。无新增依赖。
- 自动化脚本：`tests/integration/mcp-proxybycf.mjs --public --browser-client`；浏览器先通过页面表单连接，脚本不在 Node 中替代页面 Host。

## 全量工具结果

`tools/list` 返回 19 项；下列每项均实际调用并获得非 `isError` 的合法 MCP 结果，脚本以集合断言覆盖 19/19。除表中指定检查外，没有把每个字段都做完备断言。

| 工具 | 本轮调用内容 | 结果 |
| --- | --- | --- |
| tool_create_deck | 创建含 6 个实体的合成题库 | 通过，取得新 deckId |
| tool_list_decks | 查询页面题库清单 | 通过 |
| tool_get_deck | 读取创建后及后续变更的题库 | 通过，最终实体数断言为 5 |
| tool_get_deck_guide | 读取初始无导学的题库 | 通过 |
| tool_search_entities | 按合成知识标题检索 | 通过 |
| tool_update_deck_meta | 修改合成题库标题 | 通过，页面显示已修改 |
| tool_add_entities | 追加临时考点 extra | 通过 |
| tool_update_entity | 修改 extra 的答案 | 通过 |
| tool_delete_entity | 删除 extra | 通过 |
| tool_update_deck_guide | 写入摘要和章节 | 通过 |
| tool_patch_deck_guide | append_section 追加章节 | 通过 |
| tool_delete_deck_guide | 清空导学 | 通过 |
| tool_batch_update_entities | 修改 e0 的答案 | 通过，最终页面答案为“批量答案” |
| tool_batch_delete_entities | 删除 e5 | 通过，最终保留 5 个实体 |
| tool_create_deck_snapshot | 创建命名快照 | 通过，取得 versionId |
| tool_list_deck_versions | 读取版本列表 | 通过 |
| tool_rollback_deck_version | 恢复刚创建的快照 | 通过；仅覆盖该快照恢复路径，未测试所有历史结构 |
| tool_import_markdown_deck | 将题库序列化为 Markdown 后导入 | 通过，取得另一个 deckId |
| tool_delete_deck | 软删除本次导入题库 | 通过，回收站增加 1 项 |

测试主题库 ID：`deck_27747572-1c35-4a9b-9d08-291f3c008bf8`。公网网关仅中转，这些题库状态保存在隔离测试页面的本地存储中，不是远程持久业务数据。

## 错误、持久化与清理

| 检查 | 实际结果 |
| --- | --- |
| 不存在的 entityId | tool_update_entity 返回 isError: true，脚本断言通过，页面显示失败 |
| 无 Token 访问独立测试房间 SSE | HTTP 401 |
| Token 处理 | 连接后输入框清空；浏览器检查完整 Token 未出现在 localStorage |
| 页面真实状态 | 题库 5 个实体、首项答案“批量答案”、6 个版本、回收站 1 项 |
| 页面刷新 | 上述实体、答案、版本与回收站均恢复；桥接为 DISABLED，不自动恢复凭据 |
| 刷新后外部读取探针 | HTTP 200，JSON-RPC error.code = -32001（Host 不在线），没有伪装成功 |
| 清理 | SDK 客户端关闭、页面刷新使 Host 断开、临时 localhost 配置服务停止；不保留常驻测试 Host |

## 耗时样本

工具调用耗时从外部 SDK 调用前开始，到解析返回后结束，包含真实公网往返与页面执行。

| 指标 | 本轮样本 |
| --- | --- |
| 调用样本数 | 21 次成功调用（19 种工具，get_deck 额外读取 2 次） |
| 最小 | 360.708ms |
| 最大 | 1583.328ms |
| 平均 | 1417.242ms |

握手、工具目录发现和最后一条预期失败调用不计入上述样本。小题库、串行单轮联调，没有压测、百分位统计、跨地域验证或吞吐承诺。

## 复现方法与脚本变更

在进程环境中设置 `PROXYBYCF_ROOT`、HTTPS `PYW_MCP_SERVER`、`PYW_MCP_KEY` 与独立 `PYW_MCP_ROOM`，不把真实密钥写入仓库。先运行：

```text
node tests/integration/mcp-proxybycf.mjs --public --serve
```

脚本仅启动 localhost 页面服务，输出页面地址、房间和随机配置路径，不输出 Token。通过同源随机路径取配置填写表单，返回内容不缓存；完成后必须停止该临时服务。页面连接成功后，在同样环境的另一个进程运行：

```text
node tests/integration/mcp-proxybycf.mjs --public --browser-client
```

默认不传 --public 仍使用本地真实 Worker；本轮扩展后已回归执行通过。新增公网开关不会部署 Worker 或写网关配置；公网错误日志仅输出错误类别，避免 SDK 错误中潜在的凭据 URL 泄漏。

## 限制

未测试 Cursor 等客户端 GUI、Streamable HTTP、长时间休眠、大题库、并发客户端、写入超时恢复或服务端多租户权限。现有网关的房间/角色/相同 RPC ID 隔离限制仍存在；本次成功不消除这些边界。未测试用户 Token 吊销，也没有删除用户提供的凭据。真实页面与 SDK 通过公网的功能调用结论，仅适用于本次协议和环境组合。
