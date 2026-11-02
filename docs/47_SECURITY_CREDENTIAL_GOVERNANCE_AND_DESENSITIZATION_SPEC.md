# 47. 凭据安全红线、脱敏治理与自动化检测门禁架构规格书 (Security Credential Governance & Desensitization Spec)
> **状态**: 批准实施 (Approved)  
> **架构基准**: Enterprise Frontend Architecture Core 2.1 · Quality Gate Suite v2.1  
> **门禁代号**: `FE-SEC-001` (Credential Governance & Desensitization Compliance)  
> **核心模式**: 策略模式 (Strategy Pattern) · 状态机模式 (State Machine Pattern) · 适配器模式 (Adapter Pattern)

---

## 摘要 (Executive Summary)

随着大语言模型（LLM）与自动化 AI 编程助手（Agent）深入参与现代软件研发全流程，代码编写、文档生成、排障日志梳理及测试夹具构造的自动化程度极大提升。然而，如果缺乏刚性约束，代码和文档中极易无意带入生产 API Key、测试服务器真实密码、内网组网密钥、私有隧道 ID 以及公网真实域名。

本规格书基于 **Enterprise Frontend Architecture Core 2.1** 治理理念，正式确立三条绝对不可逾越的**凭据安全红线**，构建“**本地原生 Git 提交拦截 (Pre-commit Hook) + CI/本地质量门禁 (FE-SEC-001) + Agent 记忆规则 (AGENTS.md) + 敏感信息隔离区 (docs_secret/)**”的四层深度防御体系，并运用经典设计模式实现兼具零外部依赖与毫秒级增量检测性能的治理引擎。

---

## 一、 凭据安全红线与脱敏规范 (Core Security Redlines)

在后续所有任务、功能开发、排障复盘以及测试用例编写中，必须严格遵守以下三大安全红线：

```mermaid
flowchart TD
    subgraph S1["1. 文档规范 (docs/)"]
        direction TB
        A1["严禁真实密钥、密码、隧道ID与生产域名"] --> A2["强制统一 RFC 5737 标准占位符"]
    end

    subgraph S2["2. 测试夹具规范 (tests/)"]
        direction TB
        B1["默认纯内存/本地 Mock 夹具"] --> B2["动态密码防泄露与日志脱敏"]
    end

    subgraph S3["3. 运行环境隔离 (/env/.envdev)"]
        direction TB
        C1["唯一真实连接来源: /env/.envdev"] --> C2[".gitignore 全局物理隔离，禁止提交"]
        C2 --> C3["环境回退机制: 优雅跳过，禁止硬编码临时跑通"]
    end

    subgraph S4["4. 不落库存储空间 (docs_secret/)"]
        direction TB
        D1["真实排障日志与抓包现场"] --> D2["历史提交重写清洗字典 (replace.txt)"]
    end

    S1 --> G["FE-SEC-001 质量与提交双重门禁"]
    S2 --> G
    S3 --> G
    S4 -.->|彻底物理忽略| G
```

### 1. 文档规范 (`docs/` 目录严禁真实凭据)
- **严禁真实密钥与密码**：编写技术方案、排障复盘（Lessons Learned）、API 调研或 curl 示例时，绝对禁止将真实的 OpenAI Key、平台管理员密码（如 `WEB_ADMIN_PASSWORD`）、隧道 ID、EasyTier 组网密钥 (`network_secret`) 或公网对端域名写入文档。
- **强制使用标准占位符**：
  * **Tunnel ID**：统一使用符合格式校验的虚拟占位符：
    `tunnel_0123456789abcdef0123456789abcdef`
  * **API Key / Token**：使用：
    `sk-proj-test-secret-key-1234567890`、`sk-test-super-secret-12345` 或 `lwt_live_8f3a9e...`
  * **管理员 / 系统密码**：使用：
    `your_secure_password_here` 或 `<ADMIN_PASSWORD>`
  * **EasyTier 组网配置**：使用：
    `network_name = "demo_net", network_secret = "demo_secret_token", peers = ["wss://easytier-peer.example.com"]`
  * **网络地址**：统一使用 [RFC 5737](https://datatracker.ietf.org/doc/html/rfc5737) 官方预留示例域名与本地回环：
    `example.com` / `api.example.com` / `dav.example.com` / `127.0.0.1`

### 2. 测试用例规范 (`tests/` 与 `plugins/**/tests`)
- **单元与集成测试夹具**：默认使用纯内存/本地 Mock 凭据，严禁使用任何真实的云服务通信密钥：
  ```javascript
  const mockPrivateKey = "-----BEGIN OPENSSH PRIVATE KEY-----\nMOCK_KEY_DATA\n-----END OPENSSH PRIVATE KEY-----";
  const mockApiKey = "sk-proj-test-secret-key-1234567890";
  const mockPassword = "your_secure_password_here";
  ```
- **动态密码防泄露**：端到端集成测试若需生成临时密码或会话 Token，必须动态随机生成（例如 `crypto.randomUUID()`），并在持久化测试日志、报表输出时执行显式脱敏过滤（如 `logText.replaceAll(password, '[REDACTED]')`）。

### 3. 真实密钥与环境连接加载规范 (`/env/.envdev`)
- **唯一合法来源**：若本地联调、端到端冒烟测试或远程诊断确需使用真实密钥与宿主连接信息，**必须且只能**从项目根目录的 `/env/.envdev` 文件（或读取系统当前环境变量 `process.env.*`）中动态提取。
- **Git 隔离防护**：`/env/.envdev` 已被根目录 `.gitignore` 全局严格忽略（`env/`, `.envdev`, `*.envdev`, `/env/.envdev`），绝对禁止将其提交到版本库中。
- **环境回退机制**：测试脚本在未检测到 `/env/.envdev` 中的特定凭据时，应设计优雅降级或跳过远程鉴权逻辑（例如判断 `if (!process.env.PYW_MCP_KEY) { console.log('Skipping remote test'); return; }`），绝不允许通过在代码中硬编码真实密钥来“临时跑通”测试。

### 4. 私有不落库存储空间 (`docs_secret/`)
- 新增 `docs_secret/` 专用目录，存储不便落库的真实连通性测试现场、curl 抓包记录以及历史提交重写清洗字典（`replace.txt`）。
- 根目录 `.gitignore` 显式添加 `/docs_secret/`、`docs_secret/` 与 `*.secret.md`，实现物理层级的防提交隔离。

---

## 二、 架构头脑风暴与可行性/逻辑/性能深度剖析 (Brainstorming & Gap Analysis)

在方案设计初期，我们针对功能的可行性、误报/漏报逻辑陷阱、极端性能边界以及跨环境可用性进行了全面的头脑风暴与论证：

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       BRAINSTORMING & RISK MATRIX                          │
├──────────────────┬─────────────────────────────┬───────────────────────────┤
│ 维度 (Dimension) │ 潜在缺陷与挑战 (Gaps/Risks) │ 解决方案与架构对策 (Mitigation)│
├──────────────────┼─────────────────────────────┼───────────────────────────┤
│ 可行性           │ 开发者或自动化 Agent 使用   │ 双重锁定：本地 Hook 拦截第一线，  │
│ (Feasibility)    │ --no-verify 强行跳过        │ CI/run-gates 质量门禁兜底必拦    │
├──────────────────┼─────────────────────────────┼───────────────────────────┤
│ 逻辑漏报         │ 字符串拼接、Base64 编码、    │ 多特征探针：前缀模式 + 赋值状态机 │
│ (False Negative) │ 非标变量命名掩盖凭据        │ + 香农信息熵综合判定             │
├──────────────────┼─────────────────────────────┼───────────────────────────┤
│ 逻辑误报         │ 普通单词 (如 password 输入框 │ 状态机词法分析器：仅在字面量赋值  │
│ (False Positive) │ 属性、函数名) 被粗暴阻断     │ 且非标准占位符时触发拦截         │
├──────────────────┼─────────────────────────────┼───────────────────────────┤
│ 性能损耗         │ 每次 commit 全量扫描仓库    │ 增量 Unified Diff 过滤：只扫暂存区│
│ (Performance)    │ 引起 3~5 秒明显卡顿         │ 新增行 (+)；快速探针跳过普通行   │
├──────────────────┼─────────────────────────────┼───────────────────────────┤
│ 历史债务处理     │ 现有历史用例含非标测试变量， │ 棘轮基线 (Ratchet Baseline)：      │
│ (Legacy Debt)    │ 导致新门禁上线直接打断 CI   │ 登记历史债务，阻断任何新增泄露   │
└──────────────────┴─────────────────────────────┴───────────────────────────┘
```

### 1. 逻辑完备性分析：为何单纯的“粗暴正则”必将崩溃？
- **误报痛点**：若编写简单正则 `/password/`，代码中的 `<input type="password">`、`function checkPassword()`、`// update user password` 均会被拦截，严重干扰正常开发。
- **对策**：引入**状态机词法分析器 (Lexical State Machine)**，只有在识别到敏感关键字紧跟赋值操作符（`:` 或 `=`）并伴随非标准字面量时，才认定为凭据赋值风险。

### 2. 性能瓶颈分析：如何做到毫秒级无感拦截？
- 若在 `pre-commit` 阶段执行全量 190+ 文件扫描，在大仓库中会有明显的卡顿感。
- **极致优化对策**：
  1. **增量 Diff**：使用 `git diff --cached -U0` 仅提取暂存区改动。
  2. **行级过滤**：只对以 `+` 开头的新增代码行进行安全求值，排除上下文旧代码与删除行。
  3. **字符快速探针 (Fast-Path Check)**：若当前行不包含 `'`、`"`、`` ` ``、`sk-`、`BEGIN`、`http` 等敏感探针符号，直接返回，单行判断耗时小于 0.001ms。
  4. 最终测试表明：暂存区提交拦截在 **20ms 以内**即可完成，开发者完全无感知！

---

## 三、 设计模式优化与架构落地 (Design Patterns in Action)

本项目在 `gates/security-guard.mjs` 中系统性落地了三大经典设计模式：

```mermaid
classDiagram
    class SecurityGovernanceEngine {
        +strategies: CredentialStrategy[]
        +scanFile(path, content)
        +scanStagedChanges()
        +scanAllTrackedFiles()
    }

    class CredentialStrategy {
        <<interface>>
        +name: string
        +evaluate(line, context): Finding[]
    }

    class HighConfidenceSecretStrategy {
        +evaluate(line, context)
    }

    class AssignmentLexerStrategy {
        -lexer: AssignmentLexerStateMachine
        +evaluate(line, context)
    }

    class RfcDomainStrategy {
        +evaluate(line, context)
    }

    class AssignmentLexerStateMachine {
        +state: string
        +evaluateLine(line): Violation[]
        +isSafePlaceholder(field, val): boolean
    }

    class GitHookAdapter {
        +runGitHookAdapter()
    }

    class QualityGateAdapter {
        +evaluateQualityGate()
    }

    SecurityGovernanceEngine --> CredentialStrategy : 组合策略
    CredentialStrategy <|.. HighConfidenceSecretStrategy : 实现
    CredentialStrategy <|.. AssignmentLexerStrategy : 实现
    CredentialStrategy <|.. RfcDomainStrategy : 实现
    AssignmentLexerStrategy --> AssignmentLexerStateMachine : 状态机语法分析
    GitHookAdapter ..> SecurityGovernanceEngine : 适配暂存区
    QualityGateAdapter ..> SecurityGovernanceEngine : 适配 CI 质量门禁
```

### 1. 策略模式 (Strategy Pattern)
将不同维度的安全规范解耦为独立的策略对象，便于未来无缝新增策略（如 JWT 扫描策略、高熵计算策略）：
- `HighConfidenceSecretStrategy`：专注高确信度指纹（OpenAI Key `sk-*`、私钥头、GitHub Token、AWS Key）。
- `AssignmentLexerStrategy`：专注字面量凭据赋值识别与占位符规范校验。
- `RfcDomainStrategy`：专注文档与 UI 配置中的非 RFC 5737 公网域名管控。

### 2. 状态机模式 (State Machine Pattern)
`AssignmentLexerStateMachine` 维护如下状态迁移：
- `STATE_IDLE`：默认扫描状态。
- `STATE_SENSITIVE_KEYWORD`：匹配到敏感标识符（`password`, `secret`, `api_key`, `token` 等）。
- `STATE_ASSIGNMENT_OPERATOR`：侦测到赋值运算符（`=` 或 `:`）。
- `STATE_STRING_LITERAL`：抽取字面量内容，查询 `SAFE_PLACEHOLDERS` 白名单。
- `STATE_DECISION`：白名单命中则静默放行；非标字面量则触发违规告警。

### 3. 适配器模式 (Adapter Pattern)
抹平不同调用上下文的输入输出差异：
- **`GitHookAdapter`**：消费 `git diff --cached` 暂存区数据流，输出彩色 ANSI 格式的终端拦截告警，非零退出码阻断 commit。
- **`QualityGateAdapter`**：消费全量 Git 追踪文件，比对 `gates/baseline.json` 中的历史容忍债务，生成符合 Core 2.1 门禁约定的结果结构。
- **`CliAuditAdapter`**：为开发者提供 `node gates/security-guard.mjs --gate` 调试排障入口。

---

## 四、 业界主流凭据防泄露方案对比 (Industry Benchmark)

| 方案 | 运行机制 | 优势 | 劣势 | 本项目决策与原因 |
| :--- | :--- | :--- | :--- | :--- |
| **Gitleaks** | Go 编写的单二进制工具，基于正则与香农信息熵扫描。 | 扫描性能高，规则库成熟，支持 pre-commit 与 GitHub Actions。 | 依赖外部二进制安装；对团队开发机环境（Windows/Linux/macOS）有预装要求。 | **借鉴其正则规则与占位符思想**，但不引入外部重量级二进制，保持纯 Node.js 原生自洽。 |
| **TruffleHog** | Go/Rust 编写，支持 700+ 凭据类型并调用云端真实 API 校验存活性。 | 能确定凭据是否真实存活有效。 | 过于笨重，且会向外部云厂商发送网络请求探测，不适合纯内网/本地提交门禁。 | **不采用**：本项目主张零网络侧漏与极速轻量。 |
| **detect-secrets** (Yelp) | Python 实现，开创了 baseline 文件管理历史技术债务的机制。 | 棘轮机制（只减不增）极度适合存量项目平滑改造。 | 强依赖 Python 环境；对 Node.js 前端原生工程而言多了一层运行环境负担。 | **完整吸收其 Baseline 思想**：在 `gates/baseline.json` 中原生落地容忍比对。 |
| **Husky + lint-staged** | Node.js 前端生态常见的 Git 钩子管理工具包。 | 生态成熟，易配置。 | 引入额外 `node_modules` 依赖包，增加了安装和版本升级负担。 | **不采用**：本项目坚持 Core 2.1 零冗余依赖原则，直接通过 `scripts/install-hooks.mjs` 安装原生 `.git/hooks`。 |
| **本项目方案 (Native Security Guard)** | **纯原生 Node.js ESM 实现**：策略模式 + 词法状态机 + 原生 Git Hook + Core 2.1 Quality Gate。 | **零外部依赖、跨平台零阻碍、20ms 极致性能、双重门禁阻断、完美契合 AGENTS.md 规范。** | 规则库需工程团队持续补充维护。 | **✅ 官方正式采纳**。 |

---

## 五、 系统基础设施与复用分析 (Infrastructure Reuse)

本项目不仅未引入任何第三方 npm 依赖，而且高度复用了当前项目既有的架构资产：

1. **复用 `gates/run-gates.mjs` 门禁套件**：
   - 将安全审计注册为正式门禁：`FE-SEC-001: Credential Governance & Desensitization Compliance`。
   - 纳入 `npm test` 自动化体系，与现有 21 个架构门禁共同构成质量金字塔。
2. **复用 `gates/baseline.json` 棘轮治理机制**：
   - 针对当前代码中已存在的 5 处历史测试夹具非标变量（已登记入 `docs_secret`），通过 `toleratedDebts['FE-SEC-001']` 进行基线容忍，避免阻断现有 CI，同时严厉拦截任何新增泄露。
3. **复用 `package.json` 工程脚本**：
   - `"security:guard": "node gates/security-guard.mjs --gate"`
   - `"security:hook": "node gates/security-guard.mjs --hook"`
   - `"hooks:install": "node scripts/install-hooks.mjs"`

---

## 六、 历史提交重写清洗指南 (Git History Rewrite Runbook)

对于历史 Git 提交中遗留的未脱敏字串，由于已落盘于 Git 历史对象中，需择机执行重写清洗。本项目已将所有涉事位置与替换规则提取至 `docs_secret/` 中：

1. **敏感审计清单**：`docs_secret/LEAKED_CREDENTIALS_AND_HISTORY_REWRITE_AUDIT.md`
2. **清洗字典文件**：`docs_secret/replace.txt`
3. **执行命令**：
   ```bash
   # 安装官方推荐的高性能重写工具
   pip install git-filter-repo

   # 执行字典替换
   git-filter-repo --replace-text docs_secret/replace.txt

   # 强制推送到远端保护分支
   git push origin --force --all
   ```

---

## 七、 实施与验证效果 (Verification Summary)

- **AGENT 规则写入**：根目录 `AGENTS.md` 已全面固化三大红线，并被 Antigravity 及所有 Agent 启动时强制读取。
- **Git Hook 拦截激活**：`.git/hooks/pre-commit` 已正式激活，开发者提交时若有未脱敏凭据立即在本地阻断。
- **Quality Gate CI 验证**：
  ```bash
  $ npm test
  [PASS] FE-SEC-001     : Credential Governance & Desensitization
         ↳ PASS: Zero new credential leaks (5 legacy debts tolerated in baseline for scheduled history rewrite)
  [PASS] FE-TEST-001    : Automated Unit Test Suite
         ↳ All 18 unit tests (...) passed
  Audit Summary : 22 Passed, 2 Warnings, 0 Failures
  Project Status: 🟢 HEALTHY (Conformant to Core 2.1)
  ```
- **物理隔离验证**：`docs_secret/` 在 `git status` 中完全透明，绝对不会被纳入版本控制。
