# MCP Bridge Implementation Plan

Goal: 外部 MCP 客户端通过 ProxyByCF 调用页面全部 19 个工具，无逐次审批。
Spec: docs/34_MCP_BRIDGE_FEASIBILITY_AND_DESIGN.md
Architecture: 共享执行器、MCP 适配器、浏览器连接状态机、独立配置 UI；凭据仅内存保存。
Tech Stack: 原生 ESM、WebSocket、Web Crypto、node:test；不提交、不部署。

## 实施步骤（当前会话直接执行）

- [x] 工具适配：新增 features/mcp-bridge/tool-adapter.js 与 tests/unit/mcp-bridge.test.mjs；19 项业务路径、错误封装、幂等用例通过。
- [x] 共享执行保护：执行器同步暂存存储、校验与回滚；UUID、持久化失败反馈通过。
- [x] 连接：浏览器原生 WSS 与网关现有 AES 信封，世代、停止和排队过期测试通过。不声称撤销已执行调用。
- [x] 产品入口：配置与状态 UI、app 初始化和生成器已接入。生成前确认用户 index 新增内容全部存在于源码产物，随后重新生成 index。
- [x] 网关范围决定：用户要求使用现有地址/房间/Token，仅改当前仓库。复用已有子协议鉴权，ACK/角色与请求隔离保留为服务端已知边界，不部署。
- [x] 验证：23 项单元测试通过，npm test 21 通过/2 警告/0 失败，真实 SDK/Worker 以及真实浏览器均完成 19 工具调用，刷新持久化与窄屏通过。

## 实施取舍与审阅

Ruling: 不安装额外库，使用现有 schema 关键字子集校验与原生 Web Crypto — 当前协议/定义已足够 — 新 schema 关键字需要后续扩展。
Ruling: 同步事务内执行保证单事件循环不交错，保留 legacy localStorage 尽力恢复 — 避免跨范围迁移存储 — 不保证跨崩溃/跨标签页事务。
独立代码审阅发现排队截止、大结果误报失败、显式新连接账本隔离三个问题；已修复，前两项先复现失败再验证通过。
门禁警告：原有 10 个薄弱分类；本次 executor 增长至 307 行。均未阻塞测试。

## 重点回归

存储满不能报成功；相同 RPC ID 不串线；旧连接不写入；编辑失败不残留副本；连接凭据不进 URL/日志/持久化；大返回体不截断假成功。
