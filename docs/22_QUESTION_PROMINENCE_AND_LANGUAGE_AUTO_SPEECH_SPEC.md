# 题目醒目度重构与语言类题库自动发音架构规约 (Question Prominence & Language Auto-Speech Spec)

## 1. 痛点分析与背景溯源 (Problem Analysis & Background)

在学习型对战界面（Arena 竞技场与 Study Hub 精读中心）中，用户在进行英语动词形态记忆训练时反馈了两个核心体验痛点：

### 1.1 痛点一：题目不明显（视觉焦点倒置与任务指令湮没）
通过对原版答题卡片（参考历史评估截图 `media_1791516348412_7ddf4329.png`）的视觉动线量化分析：
- **概念字号过大 vs 题目指令过小**：核心考核单词（如 `become`）使用了 36px/48px 的 `font-extrabold` 极大字阶，牢牢占据了 80% 的第一眼视觉注意力；
- **任务指令缺乏容器与层级**：真正的考核任务（如 `转化为过去分词：`）仅以 `text-xs sm:text-sm text-indigo-300 font-medium`（约 12~14px 细体）单行悬浮于音标注释下方，无独立背景板、无高程阴影、无指令图标、对比度不足；
- **心理认知盲区**：用户视线在扫过单词 `become` 后，直接跳跃至底部的四选一选项按键（`1 beaten`, `2 become`, `3 read`, `4 come`）。此时用户根本未能看清当前到底是要求转换「过去式」、「现在分词 (-ing)」、「过去分词」还是「三单」，导致思维卡顿甚至误判。

### 1.2 痛点二：语言类题库缺乏发音支持（听觉记忆回路缺失）
- 动词形态记忆（特别是 `-ic` 加 `k`、不规则动词如 `read /riːd/` 变过去式 `read /red/`、重读闭音节双写等）具有极强的语音属性；
- 原系统仅提供了 8-bit 的 Web Audio 合成音效（答对/答错/连击嘟嘟声），缺乏单词真实发音支持，无法调动用户的听觉通道，降低了记忆固化效率。

---

## 2. 题目醒目度重构方案 (Question Prominence Redesign)

遵循系统设计规范（`12_DESIGN_SYSTEM_AND_UI_OPTIMIZATION_SPEC.md`）中的**视觉层级演进与中性色主导规范**，对答题核心卡片进行重构：

```mermaid
flowchart TD
    subgraph 原版倒置结构 (Before)
        B1["顶部标签 (小)"] --> B2["考核单词 become (极巨大)"]
        B2 --> B3["音标/含义 /bɪˈkʌm/ · 成为 (小灰色)"]
        B3 --> B4["题目任务：转化为过去分词：(微弱紫字，极易漏看)"]
        B4 --> B5["选项矩阵 (1 beaten / 2 become...)"]
    end

    subgraph 重构后清晰结构 (After)
        A1["顶部考点定位 [🏷️ 不规则: AAB/ABA 型 · Layer 2]"] --> A2["考查本体容器 (单词 + 🔊 即时发音点播按钮 + 音标释义)"]
        A2 --> A3["🎯 核心答题任务指令看板 (专用高反差指令条，双层边框 + 图标 + 高亮白字)"]
        A3 --> A4["选项矩阵 (高识别度选项按键)"]
        A4 --> A5["底部快捷键操作栏 (1/2/3/4 作答 · P 重新发音 · S 发音开关)"]
    end
```

### 2.1 核心答题任务指令看板 (`#arena-prompt-banner`)
将悬浮微弱文字升级为**独立双层指令条**：
1. **独立表面容器 (Surface 2)**：采用 `bg-slate-850/95 border border-indigo-500/40 rounded-xl px-4 py-3 shadow-md shadow-indigo-950/40`，建立清晰的视觉焦点；
2. **考查指令徽章**：左侧设立专用微型指示图标容器（`bg-indigo-500/20 text-indigo-400 border border-indigo-500/30`），搭配矢量目标靶心 SVG；
3. **字阶与对比度提升**：
   - 顶部提供微型引导标签：`考查任务 · QUESTION DIRECTIVE`（10px 粗体、等宽字体、`text-indigo-400`）；
   - 核心指令文本升级为 `text-sm sm:text-base font-extrabold text-white tracking-wide`，与暗色背景保持 12:1 以上的超高无障碍对比度。

---

## 3. 语言题库自动发音可行性调研 (Feasibility Study)

### 3.1 跨方案选型横向对比矩阵

| 评估维度 | 方案 A：原生 Web Speech API (SpeechSynthesis) ⭐ 本方案采用 | 方案 B：第三方云端 REST TTS (有道/微软/Google Cloud) | 方案 C：静态预录音 MP3 音频池 |
| :--- | :--- | :--- | :--- |
| **后端/网络依赖** | **0 依赖**（100% 浏览器客户端原生） | 强依赖外部网络与 CORS 代理 | 强依赖大量离线静态资源打包 |
| **独立运行能力** | **完美符合**（`file:///` 双击纯静态运行） | 不符合（无外网或 CORS 阻断时失效） | 单文件 `index.html` 体积膨胀数百 MB |
| **首包体积影响** | **0 KB 额外体积**（纯 JS 控制调用） | 0 KB（但需引入 API 鉴权机制） | 严重超标（违背 lightweight-web 规范） |
| **发音延迟** | **极低 (<10ms 本地系统 TTS 引擎合成)** | 高 (200~800ms 网络往返) | 极低 |
| **多语言支持** | 系统自带（英语、日语、法语、德语、中文等） | 丰富 | 仅限预录词条 |
| **商业/配额成本** | **完全免费且无限量** | 存在免费额度上限与 Key 失效风险 | 制作成本高 |

> **调研结论**：
> 方案 A（原生 `window.speechSynthesis`）具备**零外部网络依赖、零后端中间件、零额外构建体积、毫秒级本地合成**等压倒性优势，完全契合本项目 `20_ZERO_BACKEND_PURE_CLIENT_STANDALONE_SPEC.md`（零后端单文件便携运行）的核心原则。

### 3.2 语言类型题库识别算法 (`isLanguageDeck`)
为避免非语言类题库（如《HTTP 状态码》、《Python 数据类型》）产生不必要的发音干扰，系统构建了**双轨启发式语言类型判定器**：
1. **显式配置契约**：检查 `deck.type === 'language'` 或 `deck.isLanguage === true` 或 `deck.lang`（如 `'en-US'`）；
2. **智能特征启发式推导**：
   - **标题与描述关键词特征**：匹配 `/(英语|动词|词汇|单词|英文|english|verb|vocabulary|grammar|日语|法语|德语|西语|韩语|语言)/i`；
   - **词条音标/形态抽样采样**：抽样前 5 条概念，检查 `subtitle` 是否包含国际音标格式（`/[^/]+/`）或 `title` 为纯西文字符。
3. 判定为语言题库时，动态获取最佳 BCP 47 语言代码（如 `'en-US'`, `'ja-JP'`, `'fr-FR'` 等）。

### 3.3 交互链路与防冲突设计
1. **题目加载自动播报**：进入语言类题目时，若用户未关闭发音开关，自动触发当前核心词条（`entity.title`）朗读；
2. **点播重听按钮 (`#btn-replay-speech`)**：在大字单词旁渲染单色矢量喇叭图标按钮，点击或按下快捷键 `P` 即可随时重听；
3. **全局自动发音开关 (`#arena-auto-speech-toggle`)**：
   - 顶栏常驻展示发音开关胶囊（`自动发音: 开 / 关`）；
   - 状态持久化至 `localStorage('knowledge_arena_auto_speech')`；
   - 快捷键 `S` 一键静音/取消静音；
4. **音频流水线安全熔断**：
   - 切换下一题或退出时，立即调用 `speechSynthesis.cancel()` 强行清空播放队列，杜绝快速连击答题时的多音轨叠加串音；
   - 词条包含括号注记时（如 `write (wrote)`），自动正则过滤只朗读核心词。

---

## 4. 预览方案与落地规划 (Preview Plan & Delivery)

1. **预览原型**：在 `docs/22_question_and_speech_preview.html` 建立独立的高保真对比与发音试听沙盒：
   - 左右并排真实呈现原版痛点卡片 vs 新版醒目看板卡片；
   - 内置交互式 TTS 试听器，支持动态输入与系统声音测试；
   - 包含语言题库推导实时判定验证器；
2. **生产环境落地**：
   - 创建 `platform/audio/speech-synth.js`（纯前端语音合成与题库判定模块）；
   - 更新 `app/app-shell.html`（注入醒目指令卡、发音按钮与顶栏开关，100% 遵循 `FE-ICON-002` 零 Emoji 门禁）；
   - 更新 `features/arena/quiz-runner.js` 与 `app/main.js`；
   - 编写 `tests/unit/speech-synth.test.mjs` 并挂载至 `gates/run-gates.mjs` 门禁；
   - 打包验证单文件并确保 100% 测试通过。
