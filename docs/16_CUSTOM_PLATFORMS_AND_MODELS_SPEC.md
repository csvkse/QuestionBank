# AI 自定义平台、接口协议分发与模型细粒度配置规约 (Custom Platforms & Model Spec)

> **文档状态**：已落地并执行  
> **文档编号**：`DOC-KNOW-016`  
> **关联质量门禁**：`FE-BIND-001`、`FE-QUALITY-001`、`FE-ICON-002`  
> **责任组件**：`features/ai-agent/provider-presets.js`、`session-store.js`、`client.js`、`agent-ui.js`、`app/main.js`

---

## 一、 需求背景与痛点诊断 (Context & Problem Statement)

### 1.1 现状痛点
在上一阶段的 AI Agent 平台管理中：
1. **模型列表被平台写死**：系统虽然提供了 DeepSeek、OpenAI、SiliconFlow、Ollama、Qwen 等平台，但每个平台对应的模型列表多为硬编码或仅为扁平字符串数组（如 `['deepseek-reasoner', 'deepseek-chat']`），用户无法自由增减或配置第三方代理模型；
2. **缺乏模型级关键参数控制**：不同的大模型具有截然不同的**上下文窗口 (Context Window, 如 32K ~ 1000K)** 与 **单次最大输出 Tokens (Max Output, 如 4K ~ 64K)**。缺乏这些参数会导致客户端无法精确设置 `max_tokens`，且无法进行长文本上下文截断防护；
3. **接口类型无法自由指定**：用户自建中继、本地网关（OneAPI / New API / LM Studio / vLLM / Ollama）或接入 Anthropic Claude、Google Gemini 时，需要明确选择底层的 **接口协议类型 (API Protocol)**；
4. **预设列表定位不准**：原预设列表作为了限制项，而用户期望的是：**“现有模型列表只是作为参考预设，用户可以完全自定义平台、自由编辑模型列表及其上下文与最大输出”**。

---

## 二、 架构方案与技术设计 (Architecture & Technical Design)

### 2.1 整体架构分层

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               AI 平台与模型细粒度控制中枢                                │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
【接口协议分发层 (Protocols)】       【平台与模型存储层 (Store)】       【模型规格适配层 (Runtime)】
 • OpenAI 兼容 (Chat Completions)    • 自定义平台 (CRUD)               • max_tokens / max_completion
 • Anthropic Claude (Messages)       • 自定义模型列表 (CRUD)           • contextWindow 上下文预算控制
 • Google Gemini (GenerateContent)   • 上下文容量 (32k~1000k)          • 思考链 (Reasoning) 标签识别
 • Ollama Native (Chat)              • 最大输出 (4k~64k)               • 快捷切换器规格 Badge 渲染
                                     • 现有预设参考库 (Reference Only)
```

### 2.2 数据模型规范 (Data Schemas)

#### 1. 模型细粒度配置对象 (Model Schema)
```typescript
interface AIModelConfig {
  id: string;               // 传递给 API 的真实模型标识符 (如 "deepseek-reasoner")
  name: string;             // 界面友好显示名 (如 "DeepSeek-R1 (深度推理)")
  contextWindow: number;    // 上下文窗口容量 (Tokens, 默认 128000)
  maxOutputTokens: number;  // 单次最大输出限制 (Tokens, 默认 8192)
  reasoning: boolean;       // 是否属于深度思考/推理模型 (如 o1/o3/R1)
}
```

#### 2. 平台配置对象 (Provider Schema)
```typescript
interface AIProviderConfig {
  id: string;                                          // 平台唯一ID (如 "deepseek", "custom_1728...")
  name: string;                                        // 平台显示名称 (如 "DeepSeek 官方")
  apiType: 'openai' | 'anthropic' | 'gemini' | 'ollama';// 接口协议类型
  baseUrl: string;                                     // 接口 Base URL
  apiKey: string;                                      // API 密钥
  models: AIModelConfig[];                             // 该平台下所属的模型对象数组
  defaultModel?: string;                               // 默认选中的模型 ID
  enabled?: boolean;                                   // 启用状态
}
```

### 2.3 接口协议分发矩阵 (API Protocol Distribution)

| 协议类型 (`apiType`) | 协议名称 | 典型服务商与端点 | 认证方式 | 端点路由后缀 |
| :--- | :--- | :--- | :--- | :--- |
| `openai` (默认) | **OpenAI Compatible** | DeepSeek, OpenAI, 硅基流动, 百炼千问, OneAPI, vLLM, LM Studio, Ollama /v1 | `Bearer <apiKey>` | `/chat/completions` |
| `anthropic` | **Anthropic Claude** | Anthropic 官方、AWS Bedrock Claude 代理 | `x-api-key: <apiKey>` | `/messages` |
| `gemini` | **Google Gemini** | Google AI Studio、Vertex AI 代理 | `x-goog-api-key: <apiKey>` | `/models/{model}:streamGenerateContent` |
| `ollama` | **Ollama Native** | 本地 Ollama 原生端点 (`http://localhost:11434`) | 无密钥 / 自定义 Header | `/api/chat` |

### 2.4 参考预设库的非侵入性设计 (Reference Presets as Template Only)
系统定义 `REFERENCE_PRESET_PROVIDERS` 常量：
1. **参考定位**：作为**参考模板**提供给用户，初次加载时填充默认值，用户可随意修改其任意属性；
2. **自由新建**：用户随时可以点击【➕ 新建自定义平台】，填写任意名称、选择任意协议；
3. **按需导入**：在任何时候，用户可以点击【📋 导入参考模板】快速恢复官方最佳实践参数；
4. **模型自由度**：平台下的模型不仅限于官方列表，用户可随时添加自定义模型并调节其【上下文】与【最大输出】。

---

## 三、 用户交互与界面设计 (UI/UX Spec)

### 3.1 平台与模型配置弹窗 (Modal Redesign)
弹窗尺寸拓宽至 `max-w-2xl`，提供充裕的纵向操作视区与两级配置划分：
1. **平台基础信息区**：
   - 平台切换下拉列表 + 【➕ 新建平台】、【📋 从预设导入】、【🗑️ 删除平台】三合一操作组；
   - 平台名称输入；
   - **接口类型下拉选择**（`OpenAI Compatible`、`Anthropic Claude`、`Google Gemini`、`Ollama Native`）；
   - API 基础端点 (Base URL) 与 API Key；
2. **模型列表与规格配置区 (核心)**：
   - 表头展示：模型标识、友好名称、上下文窗口、最大输出、操作；
   - 每一行模型支持即时修改上下文窗口（支持快捷芯片：`32K`、`64K`、`128K`、`200K`）与最大输出（`4K`、`8K`、`16K`、`64K`）；
   - 支持【➕ 添加模型】输入行；
   - 支持删除不需要的模型、设为默认模型。

### 3.2 快捷切换器规格看板 (Quick Model Selector Badge)
在 AI 对话页面的输入框上方：
- 切换器不仅展示模型名称，还带有单色轻量规格角标：
  `DeepSeek-R1 (128k 上下文 · 8k 输出)`
- 用户一眼即知当前对话模型的处理能力与参数限制。

---

## 四、 质量门禁与架构约束 (Quality Gates)

1. **`FE-QUALITY-001` (模块代码行数治理)**：
   - 将预设模板抽离至新模块 `features/ai-agent/provider-presets.js`（约 120 行）；
   - `features/ai-agent/session-store.js` 保持在 $\le 300$ 行；
   - `features/ai-agent/client.js` 保持在 $\le 300$ 行。
2. **`FE-BIND-001` (DOM 事件绑定契约完整性)**：
   - 模板中新增的平台/模型配置操作全部在 `app/main.js` 严格实现并测试覆盖；
3. **`FE-ICON-002` (纯单色矢量化)**：
   - 界面全流程使用 SVG 单色图标，零彩色 Emoji。
