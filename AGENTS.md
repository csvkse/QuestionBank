# Knowledge Arena - Agent Engineering Guidelines & Security Redlines
> **Core Architecture Reference**: Enterprise Frontend Architecture Core 2.1  
> **Security Baseline**: Security & Credential Governance (v1.0.0)

本文件是所有 AI 编码助手（包括 Antigravity、Claude、Gemini、Cursor 等）在本项目中进行代码开发、任务编排、排障复盘以及测试编写时必须无条件遵守的最高级别工程规则。

---

## 🔒 凭据安全红线与脱敏规范 (Security & Credential Governance)

在后续所有任务、功能开发、排障文档编写以及测试用例编写中，必须严格遵守以下凭据安全红线：

### 1. 文档规范 (`docs/` 目录严禁真实凭据)
- **严禁真实密钥与密码**：编写技术方案、排障复盘（Lessons Learned）、API 调研或 curl 示例时，绝对禁止将真实的 OpenAI Key、平台管理员密码（如 `WEB_ADMIN_PASSWORD`）、隧道 ID、EasyTier 组网密钥 (`network_secret`) 或公网对端域名写入文档。
- **强制使用标准占位符**：
  * **Tunnel ID**：统一使用符合格式校验的虚拟占位符 `tunnel_0123456789abcdef0123456789abcdef`。
  * **API Key / Token**：使用 `sk-proj-test-secret-key-1234567890`、`sk-test-super-secret-12345` 或 `lwt_live_8f3a9e...`。
  * **管理员 / 系统密码**：使用 `your_secure_password_here` 或 `<ADMIN_PASSWORD>`。
  * **EasyTier 组网配置**：使用 `network_name = "demo_net"`, `network_secret = "demo_secret_token"`, `peers = ["wss://easytier-peer.example.com"]`。
  * **网络地址**：统一使用 [RFC 5737](https://datatracker.ietf.org/doc/html/rfc5737) 官方预留示例域名与地址：
    - `example.com` / `api.example.com` / `dav.example.com`
    - `127.0.0.1` / `localhost`

### 2. 测试用例规范 (`tests/` 与 `plugins/**/tests`)
- **单元与集成测试夹具**：默认使用纯内存/本地 Mock 凭据，例如：
  ```javascript
  const mockPrivateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nMOCK_KEY_DATA\n-----END OPENSSH PRIVATE KEY-----";
  const mockToken = "sk-proj-test-secret-key-1234567890";
  const mockPassword = "your_secure_password_here";
  ```
- **动态密码防泄露**：端到端集成测试若需生成真实密码或临时会话密钥，必须动态随机生成（如在 Node.js 中使用 `crypto.randomUUID()`，或 PowerShell 中使用 `[guid]::NewGuid().ToString('N')`），并在测试日志持久化时显式执行脱敏过滤（如 `logText.replaceAll(password, '[REDACTED]')`）。

### 3. 真实密钥与环境连接加载规范 (`/env/.envdev`)
- **唯一合法来源**：若本地联调、端到端冒烟测试或远程诊断确需使用真实密钥与宿主连接信息，**必须且只能**从项目根目录的 `/env/.envdev` 文件（或读取系统当前环境变量 `process.env.*`）中动态提取。
- **Git 隔离防护**：`/env/.envdev` 已被根目录 `.gitignore` 全局严格忽略（`env/`, `.envdev`, `*.envdev`, `/env/.envdev`），**绝对禁止**将其提交到版本库中。
- **环境回退机制**：测试脚本在未检测到 `/env/.envdev` 中的特定凭据时，应设计优雅降级或跳过远程鉴权逻辑（例如判断 `if (!process.env.PYW_MCP_KEY) { console.log('Skipping remote live test: no credentials'); return; }`），绝不允许通过在代码中硬编码真实密钥来“临时跑通”测试。

---

## 🛡️ 架构与质量门禁联动

本项目配备全自动化质量与安全门禁系统 (`npm test` / `node gates/run-gates.mjs`)：
1. **FE-SEC-001 (安全凭据审计门禁)**：自动扫描所有非忽略文件的正则特征、熵值与占位符规范，检测到硬编码凭据直接中断构建。
2. **Git pre-commit Hook**：在每次执行 `git commit` 时拦截暂存区中的疑似密钥、未脱敏内网地址或违规占位符。
3. **docs_secret 物理隔离**：不落库的诊断细节、私有字典及排障信息必须保存在 `docs_secret/` 目录下，该目录已被 Git 全局忽略。
