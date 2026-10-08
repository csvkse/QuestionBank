# 10. 质量门禁与架构治理规约 (Quality Gates & Governance Specification)

---

## 一、治理理念与规则 ID 体系 (Governance Philosophy & Rule Taxonomy)

参考企业级前端治理规范 `SoftwareArchitecture/frontend/governance/gates.md`，本项目建立 **自动化、可审计、零误杀、防伪绿** 的全生命周期门禁系统。

### 1. 核心治理原则 (Tenets)
1. **真实事实判定 (Fact-Based Proof)**：门禁基于 AST 语法树解析与拓扑图分析，严禁使用脆弱的字符串正则猜测。
2. **正反例自证 (Fixture Verification)**：每一个可执行门禁规则必须配备合法正例与违规负例；解析失败或扫描范围为 0 严禁报假绿。
3. **渐进式债务治理 (Ratchet Baseline)**：存量代码的违规计入 `baseline.json`；任何新引入的违规直接阻断，历史债务“只减不增（棘轮效应）”。
4. **领域专属硬约束 (Domain-Specific Invariants)**：除了通用软件工程门禁外，将核心知识库的「5-3-10容量规范」与「四选一同胞池 $\ge 4$ 硬约束」纳入自动化门禁守护。

### 2. 统一 Rule ID 矩阵
系统维护两类规则标识：
- `DS-*`：**Design Rule (视觉与设计系统约定)**，规定设计层面的 Token、状态、组件契约；
- `FE-*`：**Executable Frontend Gate Rule (可执行前端硬门禁)**，由自动化脚本执行并输出通过/失败证据。

```text
DS-TOKEN-001 (语义色设计约定)
   ├─ FE-DS-001 (静态 Token 扫描器)
   └─ L3 Visual Review (视觉抽样审计)
```

---

## 二、门禁执行分层与触发时机 (Gate Lifecycle: L0 ~ L3)

| 门禁层级 | 触发时机 | 检查范畴 | 性能预算 | 失败策略 | 命令行入口 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **L0 (IDE/保存)** | 开发者保存代码 | 基础语法合规、格式化、未声明变量 | $< 50\text{ ms}$ | 编辑器即时高亮 | 依赖 IDE 语言服务 |
| **L1 (本地快速)** | Git Commit / 本地验证 | 所有权归属、依赖合法性、禁止循环、AST解析、知识库容量硬约束 | $< 500\text{ ms}$ | **Hard Fail (本地阻断提交)** | `node gates/run-gates.mjs --level=1` |
| **L2 (CI/集成)** | PR 合并 / 发布打包前 | 全量 AST 校验、SM-2算法单测、干扰项采样单测、单文件打包幂等性测试 | $< 3\text{ s}$ | **Hard Fail (禁止合并)** | `node gates/run-gates.mjs --level=2` |
| **L3 (发布审计)** | 阶段性发布 / 版本归档 | 单文件离线可用性核验、视觉回归、基线债务审计、全题库健康度巡检 | $< 10\text{ s}$ | 阻断或生成审计报告 | `node gates/run-gates.mjs --level=3` |

---

## 三、可执行门禁规则全景规约 (Executable Gate Inventory)

### 1. 结构与所有权门禁 (`FE-STRUCT-*`)
| 规则 ID | 规则名称 | 核心断言事实 | 级别 | 违规示例与后果 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-STRUCT-001` | **物理所有权必须明确** | `app/features/shared/design-system/platform/vendor/gates/scripts` 之外严禁存在游离 JS/HTML 文件。 | L1 | 根目录随意增加 `temp.js` ➔ **直接阻断** |
| `FE-STRUCT-002` | **Feature 唯一公开出口** | 跨 Feature 调用只能通过 `features/<name>/index.js`，严禁深层穿透导入。 | L1 | `import from '../arena/quiz-runner.js'` ➔ **直接阻断** |
| `FE-STRUCT-003` | **单一职责文件定位** | 单个文件不得同时承载 DOM 渲染、算法推导与持久化写入。 | L2 | 在 UI 组件内部直接写 IndexedDB 事务 ➔ **警告/阻断** |

### 2. 依赖与导入图门禁 (`FE-IMP-*`)
| 规则 ID | 规则名称 | 核心断言事实 | 级别 | 违规示例与后果 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-IMP-001` | **静态导入解析完全性** | 所有 ESM `import` 路径必须在文件系统中物理存在，严禁挂空引用。 | L1 | 引用不存在的模块 ➔ **直接阻断** |
| `FE-IMP-002` | **严禁依赖反向倒灌** | • `platform` 严禁依赖 `features` / `app`<br>• `shared` 严禁依赖 `features`<br>• `design-system` 严禁依赖任何业务。 | L1 | 基础音效模块 `web-audio-synth` 尝试导入做题状态 ➔ **直接阻断** |
| `FE-IMP-003` | **拓扑无环依赖图** | 文件级与 Feature 级依赖图必须为有向无环图 (DAG)，严禁直接或间接环状递归。 | L1 | Module A ➔ Module B ➔ Module A ➔ **直接阻断** |

### 3. 设计系统与视觉门禁 (`FE-DS-*`)
| 规则 ID | 规则名称 | 核心断言事实 | 级别 | 违规示例与后果 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-DS-001` | **语义颜色 Token 强约束** | 模板与样式中严禁私自硬编码十六进制颜色（如 `#4f46e5`），必须使用语义 Token（如 `var(--color-primary)` 或 Tailwind 语义原子类）。 | L1 | 随意书写 `#123456` ➔ **Baseline 登记或阻断** |
| `FE-DS-002` | **通用原子组件收敛** | 弹窗 (Modal)、状态徽章 (Pill/Badge)、基础按钮必须复用 `design-system` 导出。 | L2 | 自行手写非标准风格弹窗 ➔ **警告** |

### 4. 离线资源与安全门禁 (`FE-RES-*` / `FE-SEC-*`)
| 规则 ID | 规则名称 | 核心断言事实 | 级别 | 违规示例与后果 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-RES-001` | **100% 离线自包含可用** | 生产分发单文件严禁依赖任何外部未经缓存的公共网络资源；断网状态必须完全可用。 | L3 | 产物中引用外部不可控第三方脚本 ➔ **阻断发布** |
| `FE-SEC-001` | **Markdown HTML 注入防护** | 题库解析器渲染用户 Markdown 时必须转义 HTML 特殊字符，防范 XSS 攻击。 | L2 | 词条标题含 `<script>` 被原样插入 DOM ➔ **直接阻断** |

### 5. 代码质量与复杂度门禁 (`FE-QUALITY-*`)
| 规则 ID | 规则名称 | 阈值参数 | 级别 | 处理机制 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-QUALITY-001` | **文件长度行数上限** | • 建议阈值：$\le 300\text{ 行}$<br>• 硬性上限：$\le 500\text{ 行}$ | L2 | $> 300$ 行发出 Review 告警，$> 500$ 行必须拆分或进 Baseline。 |
| `FE-QUALITY-002` | **单函数圈复杂度** | • 圈复杂度 (Cyclomatic) $\le 15$<br>• 认知复杂度 (Cognitive) $\le 10$ | L2 | 超标函数强制进行功能抽取或模式重构。 |

### 6. 知识图谱专属领域门禁 (`FE-KNOW-*`) ★★★
针对本项目核心业务特性，量身定制的题库健康自动化硬门禁：

| 规则 ID | 规则名称 | 约束依据与数学原理 | 级别 | 判定与后果 |
| :--- | :--- | :--- | :--- | :--- |
| `FE-KNOW-001` | **同胞池最小容量硬约束** | **四选一单选必须至少 4 条同分类词条**。不足 4 条将无法生成纯同胞干扰项，导致题目退火降级为杂项混淆。 | L1 | 内置题库或新建题库存在条目 $< 4$ 的孤岛分类 ➔ **硬性阻断 / 标红警告** |
| `FE-KNOW-002` | **单题库规模容量红线** | • 单题库分类数 $\le 25$<br>• 单题库总条目数 $\le 500$<br>符合人脑认知负荷与浏览器 DOM 流畅极限。 | L1 | 超过限制将强提示拆分为独立新题库，禁止无序膨胀。 |
| `FE-KNOW-003` | **Markdown AST 双向幂等** | 题库数据经过序列化为 Markdown，再经过解析回 AST，必须满足：$\text{AST} \equiv \text{parse}(\text{serialize}(\text{AST}))$。 | L2 | 双向转换存在丢失字段或文本乱码 ➔ **直接阻断** |
| `FE-KNOW-004` | **薄弱分类预警检测** | 扫描题库中所有条目数处于 $1 \sim 3$ 条的分类板块。 | L1 | 自动在题库管理器与编辑器中亮黄灯，提示补充词条。 |
| `FE-KNOW-005` | **三维正交完整性校验** | 每一个分类必须显式标注 `group` (所属业务大组)；每一个词条必须显式标注 `layer \in [1, 2, 3]`。 | L1 | 缺失 `group` 或 `layer` 非法 ➔ **阻断保存并自动补全** |

---

## 四、基线治理与棘轮效应机制 (Baseline & Ratchet Governance)

在从历史单体代码向 Core 2.0 目标迁移的过程中，为防止门禁一刀切导致正常开发瘫痪，系统引入 **精确基线治理协议**：

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-10-08T20:00:00Z",
  "ratchetPolicy": "strictly-decreasing",
  "toleratedDebts": {
    "FE-QUALITY-001": [
      { "file": "legacy/index.html", "lines": 3230, "reason": "迁移过渡期单体宿主，等待模块分拆" }
    ],
    "FE-DS-001": [
      { "file": "legacy/index.html", "count": 28, "reason": "历史内联颜色，待 Token 化替换" }
    ]
  }
}
```

### 棘轮收紧规则 (The Ratchet Mechanism)：
1. **只减不增**：当重构完成某一块功能（如抽离了 `features/deck-studio`），基线文件中对应的行数与违规计数必须强制下调，严禁重新回弹；
2. **新代码零容忍**：新建在 `features/`、`shared/`、`platform/` 中的所有文件，一律以 100% 零违规标准执行门禁，不得申请加入 Baseline；
3. **过期清理**：一旦某项历史代码被重构，基线中对应的记录自动失效，由门禁工具提示自动移除。
