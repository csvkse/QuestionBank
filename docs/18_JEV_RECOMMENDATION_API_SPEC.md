# JEV 熟练度全景评估与模块推荐接口规范 (JEV Recommendation API Spec)

> **版本**：v2.8 (JEV_RECOMMENDATION_ENGINE)  
> **分类**：智能评估接口 / 领域全景诊断 / 启发式降级  
> **状态**：已落地  
> **相关模块**：[`features/jev/`](../features/jev/)、[`app/main.js`](../app/main.js)、[`app/app-shell.html`](../app/app-shell.html)

---

## 一、 需求背景与痛点诊断

在系统的仪表盘中，用户可以通过“各分类板块熟练度全景”矩阵查看到当前题库各个分类（如“重读闭音节双写”、“不规则动词 ABC型”等）的词条掌握进度条。

然而，传统的全景进度条存在以下**认知决策痛点**：
1. **信息过载与缺乏主次**：当题库拥有 8~20 个分类板块时，用户面对一长串进度条，无法一眼确定“我今天最应该优先突击哪一个分类？”；
2. **缺乏多维风险归因**：单纯的百分比无法揭示深层记忆危机——某个分类可能覆盖率达到 80%，但其中有 6 个词条已到达**艾宾浩斯遗忘临界值**且混淆错题集中，风险极高；
3. **缺少与游戏化模式的直接闭环**：即便用户发现了薄弱板块，也需要手动点击“自由沙盒试炼”并逐个勾选分类，交互链路冗长。

为此，系统引入 **JEV 接口 (Judgement & Evaluation Vector Interface，即时研判与评估向量接口)**，专门负责接收当前题库各分类板块熟练度全景数据，输出精准的模块突击建议。同时，严格遵守规约：**“若没配置 JEV 则不推荐，或采用降级方案”**。

---

## 二、 可行性调研与架构权衡

针对纯前端单页 (SPA) 及离线/在线混合场景，我们对三种评估推荐技术路线进行了可行性调研与权衡：

| 方案维度 | 方案 A：远程 JEV REST 微服务 | 方案 B：本地启发式多维风险矩阵 (降级) | 方案 C：AI Agent 大模型动态诊断 |
| :--- | :--- | :--- | :--- |
| **工作原理** | 前端通过 HTTP POST 向用户自定义的 JEV 接口发送全景 JSON，接收结构化建议 | 纯本地利用艾宾浩斯到期度、错题率与认知层级加权评分数学模型瞬间计算 | 将全景数据格式化为 Prompt，复用已配置的 DeepSeek/OpenAI 等 LLM 进行综合研判 |
| **网络依赖** | 需要网络与可用端点服务 | **100% 离线脱机可用 (0ms 延迟)** | 需要 AI 平台 API 连通性 |
| **接入成本** | 适合具备独立评测中台或自建服务的场景 | **零配置开箱即用，高性价比** | 消耗 LLM Tokens，响应约 1~2s |
| **未配置表现** | 若用户未配置，则无法响应 | **作为官方黄金降级方案 (Fallback)** | 可作为 JEV 的一种协议适配分支 |
| **决策决议** | **标准支持**：提供端点与 Token 配置 | **标配内置**：作为无配置/故障时的自愈底座 | **无缝兼容**：作为可选协议接入 |

**核心决议**：
系统设计统一的 `JevClient` 门面（Facade），**支持远程 JEV 协议与本地启发式引擎双轨驱动**。当用户未配置 JEV 远程接口或远程服务超时时，系统根据配置中的降级策略（Fallback Policy）自动在“**采用降级方案 (启发式分析)**”与“**不推荐 (静默隐藏)**”之间平滑切换。

---

## 三、 JEV 接口数据契约规约 (Interface Contract)

### 1. JEV 客户端向接口上报的全景请求载荷 (Request Payload)

```http
POST /v1/jev/recommend HTTP/1.1
Content-Type: application/json
Authorization: Bearer <JEV_API_KEY_OPTIONAL>
```

```json
{
  "deckId": "verb_master",
  "deckTitle": "英语动词形态记忆法典",
  "totalEntities": 118,
  "overallCoverage": 42,
  "streak": 5,
  "timestamp": 1728432000000,
  "panorama": [
    {
      "id": "c_irr_abb",
      "name": "不规则动词 (ABB型)",
      "group": "不规则变位",
      "total": 35,
      "learned": 15,
      "mastered": 4,
      "dueCount": 6,
      "mistakeCount": 5,
      "coveragePercent": 43
    },
    {
      "id": "c_double_cons",
      "name": "重读闭音节双写",
      "group": "规则变形",
      "total": 20,
      "learned": 18,
      "mastered": 12,
      "dueCount": 1,
      "mistakeCount": 0,
      "coveragePercent": 90
    }
  ]
}
```

### 2. JEV 接口响应规约 (Response Schema)

```json
{
  "success": true,
  "recommendation": {
    "targetCategoryId": "c_irr_abb",
    "targetCategoryName": "不规则动词 (ABB型)",
    "urgency": "HIGH",
    "priorityScore": 86,
    "headline": "不规则动词 (ABB型) 出现记忆塌陷风险",
    "reason": "该模块覆盖率仅 43%，且存在 6 个知识点到达艾宾浩斯复习临界，错题集中在过去分词混淆。建议立即优先突破！",
    "suggestedAction": "sandbox",
    "actionLabel": "立即开启定向沙盒突破"
  }
}
```

### 3. TypeSafe SystemOne 官方 JEV 协议适配规约

针对官方 **TypeSafe SystemOne** (`/v1/systemone`) 认知判定引擎，接口契约符合 OpenAPI 严格规约：
- **必填字段**：`model`、`state`、`questions`；
- **官方模型**：`jev-latest`、`jev-preview`，亦支持任意用户自定义模型。

#### SystemOne 握手测试载荷 (Ping Handshake)
```json
{
  "model": "jev-latest",
  "state": "Health check connection ping.",
  "questions": {
    "ping": {
      "type": "noul",
      "instructions": "Is the service available and ready to evaluate?"
    }
  }
}
```

#### SystemOne 模块全景判定载荷 (Mastery Evaluation)
```json
{
  "model": "jev-latest",
  "state": {
    "summary": "Current deck mastery panorama and risk metrics.",
    "deckTitle": "英语动词形态记忆法典",
    "totalCategories": 8,
    "overallCoverage": 42
  },
  "questions": {
    "target_category": {
      "type": "choice",
      "instructions": "Which category urgently needs targeted breakthrough training?",
      "criteria": {
        "c_irr_abb": "不规则动词 (ABB型) [不规则变位] | 掌握度: 43% | 到期复习: 6 | 错题数: 5",
        "c_double_cons": "重读闭音节双写 [规则变形] | 掌握度: 90% | 到期复习: 1 | 错题数: 0"
      }
    },
    "urgency": {
      "type": "choice",
      "instructions": "What is the urgency level for this recommendation?",
      "criteria": {
        "HIGH": "Severe memory decay or confusion detected",
        "MEDIUM": "Moderate revision needed",
        "LOW": "Stable, normal progress"
      }
    }
  }
}
```

#### SystemOne 响应契约与解析
```json
{
  "model": "jev-1.13.0",
  "answers": {
    "target_category": {
      "type": "choice",
      "choice": "c_irr_abb",
      "confidence": 0.98
    },
    "urgency": {
      "type": "choice",
      "choice": "HIGH",
      "confidence": 0.95
    }
  }
}
```
`JevClient` 自动从 `answers.target_category.choice` 抽取推荐分类 ID，将 `confidence` 转化为优先级评分，并与本地卡片元数据做深度融合。

---

## 四、 本地启发式降级推荐模型 (Heuristic Fallback Engine)

当 JEV 远程接口未配置，且用户策略设为“采用降级方案”时，系统启动本地多维风险评估矩阵：

### 1. 风险评分数学模型

针对题库中的每一个分类板块 $C_i$，计算其**综合风险优先度指数 (Priority Score, $P(C_i)$)**：

$$P(C_i) = w_1 \cdot \frac{\text{Due}(C_i)}{\text{Total}(C_i)} + w_2 \cdot \frac{\text{Mistake}(C_i)}{\text{Total}(C_i)} + w_3 \cdot \left(1 - \frac{\text{Learned}(C_i)}{\text{Total}(C_i)}\right) + w_4 \cdot \left(1 - \frac{\text{Mastered}(C_i)}{\max(\text{Learned}(C_i), 1)}\right)$$

- **$w_1 = 0.35$ (到期遗忘权重)**：防止已学记忆因错过艾宾浩斯巩固窗口而彻底遗忘；
- **$w_2 = 0.30$ (混淆错题权重)**：惩罚高频失误概念，消除知识盲区；
- **$w_3 = 0.25$ (未覆盖拓展权重)**：鼓励向未开垦分类进阶；
- **$w_4 = 0.10$ (熟练巩固权重)**：推动 Level 1~3 条目向 Level 4 (永久掌握) 跃迁。

### 2. 紧急程度分级标准 (Urgency Level)
- **HIGH (危急，红/橙)**：$P(C_i) \ge 0.50$ 或 $\text{Due} \ge 5$ 或 $\text{Mistake} \ge 4$；
- **MEDIUM (建议，蓝/紫)**：$0.25 \le P(C_i) < 0.50$；
- **LOW (平稳，绿)**：$P(C_i) < 0.25$（图谱稳固，推荐进阶挑战）。

---

## 五、 配置项与降级策略持久化规约

系统在 `localStorage` 中持久化 `knowledge_master_jev_config`：

```typescript
interface JevConfig {
  enabled: boolean;          // 是否开启远程 JEV 接口调用 (默认 false)
  endpoint: string;         // 远程 JEV REST 端点 URL
  model: string;            // JEV 模型名称 (默认 'jev-latest'，支持自定义)
  apiKey: string;           // 认证凭证 (Bearer Token)
  timeoutMs: number;        // 超时时间 (默认 6000ms)
  fallbackPolicy: 'heuristic' | 'silent'; // 未配置时的策略: 'heuristic'(降级推荐) | 'silent'(不推荐)
  autoEvaluate: boolean;    // 是否在渲染仪表盘时自动执行评估 (默认 true)
  corsProxyPrefix: string;  // 可选云端代理前缀 (纯前端跨域场景)
}
```

### 未配置与异常时的表现矩阵

| 远程 JEV 状态 | 降级策略配置 (`fallbackPolicy`) | 最终展示表现 | 状态标牌 (Pill) |
| :--- | :--- | :--- | :--- |
| **未配置 (默认)** | `heuristic` (采用降级方案) | 渲染本地启发式推荐卡片，标注【启发式降级推荐】 | `JEV: 本地降级` |
| **未配置** | `silent` (不推荐) | **彻底隐藏推荐卡片**，仅显示低调配置引导行 | `JEV: 未启用` |
| **已配置且正常** | 任何 | 渲染远程 JEV 权威诊断意见，标注【JEV 云端协同】 | `JEV: 云端在线` |
| **已配置但网络异常** | `heuristic` (采用降级方案) | 自动切换为本地启发式推荐卡片，保障用户无感 | `JEV: 降级自愈` |
| **已配置但网络异常** | `silent` (不推荐) | 提示连接故障并隐藏推荐卡片 | `JEV: 连接异常` |

---

## 六、 UI 交互与视觉规范

1. **各分类板块全景卡片增强**：
   - 卡片头部右侧增加 `[ JEV 状态标牌 ]` 与 `[ JEV 配置 ]` 按钮；
   - 卡片内部上方动态渲染 `jev-recommendation-container` 推荐展示条；
   - 推荐条包含：推荐模块大字、紧急度色标、诊断分析、以及【一键开启定向沙盒试炼】按钮；
   - 下方被推荐的分类条高亮并添加 `★ JEV 首选推荐` 徽标。
2. **JEV 专属配置弹窗 (`modal-jev-config`)**：
   - 纯中性色 Surface 3 层级；
   - 包含开关、端点输入、API Token 密码框、降级策略单选组、以及【测试连接并立即诊断】操作按钮。
