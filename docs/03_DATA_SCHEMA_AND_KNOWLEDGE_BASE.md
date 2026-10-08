# 03. 知识库题库与数据结构设计 (Data Schema & Knowledge Base)

---

## 一、知识点原子化分类与规则编码表 (Rule Registry)

根据用户提供的全部语法点，进行结构化编码。每一个单词形态转化均关联一个标准 `rule_id`，以便进行错题归因和知识覆盖率统计。

### 1. 动词变 -ing 规则体系 (Present Participle & Gerund)
| 规则编码 (`rule_id`) | 规则名称 | 核心特征描述 | 标杆单词示例 | 语法词性注记 |
| :--- | :--- | :--- | :--- | :--- |
| `RULE_ING_IC_SPECIAL` | **-ic 结尾加 k 必考特例** | 动词以 ic 结尾，变 -ing 前必须先补 k，再加 ing | picnic→picnicking, panic→panicking, frolic→frolicking, mimic→mimicking, traffic→trafficking | 绝大多数人易错漏 k |
| `RULE_ING_GENERAL` | 一般情况 | 直接在词尾 + ing | work→working, play→playing | 形容词性(分词) / 名词性(动名词) |
| `RULE_ING_SILENT_E` | 不发音 e 结尾 | 去掉不发音的 e，再 + ing | write→writing, make→making, drive→driving | 发音 e (如 see→seeing) 不去 e |
| `RULE_ING_CVC` | 重读闭音节辅元辅 | 双写末尾辅音字母，再 + ing | run→running, stop→stopping, swim→swimming | 必须是单个元音字母被单个辅音字母包围 |
| `RULE_ING_IE` | ie 结尾变 y | 将 ie 变为 y，再 + ing | lie→lying, die→dying, tie→tying | 视觉变化明显，极高频易错点 |

### 2. 规则过去式 / 过去分词 (-ed) 体系
| 规则编码 (`rule_id`) | 规则名称 | 核心特征描述 | 标杆单词示例 |
| :--- | :--- | :--- | :--- |
| `RULE_ED_IC_SPECIAL` | **-ic 结尾加 k 必考特例** | 动词以 ic 结尾，变 -ed 前必须先补 k，再加 ed | picnic→picnicked, panic→panicked, frolic→frolicked, mimic→mimicked, traffic→trafficked |
| `RULE_ED_GENERAL` | 一般情况 | 直接在词尾 + ed | work→worked, clean→cleaned |
| `RULE_ED_E` | e 结尾 | 直接在词尾 + d | love→loved, live→lived |
| `RULE_ED_CVC` | 重读闭音节辅元辅 | 双写末尾辅音字母，再 + ed | stop→stopped, drop→dropped, plan→planned |
| `RULE_ED_CONSONANT_Y`| 辅音字母 + y | 变 y 为 i，再 + ed | study→studied, carry→carried, cry→cried |

### 3. 不规则动词五大分类 (Irregular Verbs: Base → Past → Past Participle)
| 规则编码 (`rule_id`) | 模式类别 | 模式特征 | 核心词库清单 |
| :--- | :--- | :--- | :--- |
| `RULE_IRREG_AAA` | **AAA 型** | 原形 = 过去式 = 过去分词（三态同形） | **cost**→cost→cost<br>**put**→put→put<br>**cut**→cut→cut<br>**hit**→hit→hit<br>**let**→let→let<br>**read**→read→read *(注意读音改变 /red/)* |
| `RULE_IRREG_AAB` | **AAB 型** | 原形 = 过去式 ≠ 过去分词 | **beat**→beat→beaten |
| `RULE_IRREG_ABA` | **ABA 型** | 原形 = 过去分词 ≠ 过去式 | **come**→came→come<br>**run**→ran→run<br>**become**→became→become |
| `RULE_IRREG_ABB` | **ABB 型** | 过去式 = 过去分词（最庞大核心阵营） | • find→found→found, leave→left→left<br>• feel→felt, keep→kept, sleep→slept, sweep→swept<br>• build→built, lend→lent, send→sent, spend→spent, lose→lost<br>• teach→taught, catch→caught<br>• bring→brought, buy→bought, think→thought |
| `RULE_IRREG_ABC` | **ABC 型** | 原形 ≠ 过去式 ≠ 过去分词（三态全异） | • go→went→gone, do→did→done, see→saw→seen<br>• eat→ate→eaten, fall→fell→fallen, take→took→taken<br>• give→gave→given, drive→drove→driven, write→wrote→written<br>• speak→spoke→spoken, break→broke→broken, choose→chose→chosen<br>• forget→forgot→forgotten |

### 4. 第三人称单数 (s/es) 体系
| 规则编码 (`rule_id`) | 规则名称 | 核心特征描述 | 标杆单词示例 |
| :--- | :--- | :--- | :--- |
| `RULE_S_GENERAL` | 一般情况 | 直接 + s | work→works, look→looks |
| `RULE_S_ES` | s/x/sh/ch/o 结尾 | 词尾 + es | pass→passes, watch→watches, fix→fixes, wash→washes, go→goes, do→does |
| `RULE_S_CONSONANT_Y` | 辅音字母 + y | 变 y 为 i，再 + es | study→studies, fly→flies, try→tries |
| `RULE_S_IRREG` | **真不规则 (仅2个)** | 特例不遵循上述规则 | **be → is**<br>**have → has** |

### 5. 语法词性概念辨析体系 (Syntax Role)
| 规则编码 (`rule_id`) | 词性分类 | 语法角色与定义 | 典型例句对比 |
| :--- | :--- | :--- | :--- |
| `RULE_ROLE_PARTICIPLE` | **分词 (Participle)** | **形容词词性**<br>充当定语、表语或状语，表正在进行或被动/完成 | • *The **boiling** water is hot.* (修饰water, 形容词性)<br>• *The **broken** glass was everywhere.* (修饰glass) |
| `RULE_ROLE_GERUND` | **动名词 (Gerund)** | **名词词性**<br>充当主语、宾语或介词宾语 | • ***Swimming** is good for health.* (作主语, 名词性)<br>• *He gave up **smoking**.* (作动词宾语, 名词性) |

---

## 二、标准词库数据结构规范 (Verb Knowledge Schema)

词库以结构化 JSON 格式持久化，既包含变形结果，也包含教学提示与高诱惑干扰项：

```typescript
// 动词基础词条定义
interface VerbEntry {
  id: string;                    // 唯一标识 (如 "panic")
  base: string;                  // 动词原形 (如 "panic")
  phonetic: string;              // 音标 (如 "/ˈpænɪk/")
  translation: string;           // 中文释义 (如 "恐慌；惊慌")
  
  // 各时态与变形目标
  forms: {
    ing: string;                 // 现在分词/动名词 (如 "panicking")
    past: string;                // 过去式 (如 "panicked")
    past_participle: string;     // 过去分词 (如 "panicked")
    third_singular: string;      // 第三人称单数 (如 "panics")
  };
  
  // 关联规则映射
  rules: {
    ing_rule_id: string;         // 如 "RULE_ING_IC_SPECIAL"
    past_rule_id: string;        // 如 "RULE_ED_IC_SPECIAL"
    irregular_type?: 'AAA' | 'AAB' | 'ABA' | 'ABB' | 'ABC' | 'NONE';
    s_rule_id: string;           // 如 "RULE_S_GENERAL"
  };
  
  // 教学解析与避坑指南
  tips: {
    rule_explanation: string;    // "ic结尾动词变-ing/-ed时，必须先加k再加后缀！"
    pronunciation_note?: string; // 读音特别提示 (如 read 过去式发音为 /red/)
    common_pitfalls: string[];   // ["panicing (漏加k)", "panikking (乱拼写)"]
  };
  
  // 预生成的高仿干扰项 (用于快速渲染四选一)
  distractors: {
    ing: string[];               // ["panicing", "panikking", "paniccing"]
    past: string[];              // ["paniced", "panicked", "panicced"]
  };
  
  // 词性辨析典型语境例句 (用于题型四)
  syntax_examples?: Array<{
    sentence: string;            // "She felt a panicking sensation."
    highlight_word: string;      // "panicking"
    role: 'PARTICIPLE' | 'GERUND';
    role_explanation: string;    // "修饰 sensation，充当定语，为形容词词性（分词）"
  }>;
}
```

### 词库 JSON 样例数据节选

```json
[
  {
    "id": "picnic",
    "base": "picnic",
    "phonetic": "/ˈpɪknɪk/",
    "translation": "野餐",
    "forms": {
      "ing": "picnicking",
      "past": "picnicked",
      "past_participle": "picnicked",
      "third_singular": "picnics"
    },
    "rules": {
      "ing_rule_id": "RULE_ING_IC_SPECIAL",
      "past_rule_id": "RULE_ED_IC_SPECIAL",
      "irregular_type": "NONE",
      "s_rule_id": "RULE_S_GENERAL"
    },
    "tips": {
      "rule_explanation": "【ic结尾黄金特例】动词以 ic 结尾，在变 -ing / -ed 时，必须先补 k，再加后缀！常用词：picnic, panic, frolic, mimic, traffic。",
      "common_pitfalls": ["picnicing", "picniking"]
    },
    "distractors": {
      "ing": ["picnicing", "picniking", "picniccing"],
      "past": ["picniced", "picniked", "picnicced"]
    }
  },
  {
    "id": "read",
    "base": "read",
    "phonetic": "/riːd/",
    "translation": "阅读",
    "forms": {
      "ing": "reading",
      "past": "read",
      "past_participle": "read",
      "third_singular": "reads"
    },
    "rules": {
      "ing_rule_id": "RULE_ING_GENERAL",
      "past_rule_id": "RULE_IRREG_AAA",
      "irregular_type": "AAA",
      "s_rule_id": "RULE_S_GENERAL"
    },
    "tips": {
      "rule_explanation": "【AAA型三态同形】原形、过去式、过去分词拼写完全相同。但极其重要：过去式和过去分词发音发生变化，读作 /red/！",
      "pronunciation_note": "过去式及过去分词读音为 /red/，与颜色 red 同音",
      "common_pitfalls": ["readed", "red"]
    },
    "distractors": {
      "past": ["readed", "red", "rode"],
      "past_participle": ["readed", "roden", "red"]
    }
  },
  {
    "id": "teach",
    "base": "teach",
    "phonetic": "/tiːtʃ/",
    "translation": "教导；讲授",
    "forms": {
      "ing": "teaching",
      "past": "taught",
      "past_participle": "taught",
      "third_singular": "teaches"
    },
    "rules": {
      "ing_rule_id": "RULE_ING_GENERAL",
      "past_rule_id": "RULE_IRREG_ABB",
      "irregular_type": "ABB",
      "s_rule_id": "RULE_S_ES"
    },
    "tips": {
      "rule_explanation": "【ABB型高频】过去式与过去分词同形为 taught。注意与 think (thought) 区分拼写。",
      "common_pitfalls": ["teached", "thought", "tought"]
    },
    "distractors": {
      "past": ["teached", "thought", "tought"],
      "past_participle": ["teached", "thought", "teachen"]
    }
  }
]
```

---

## 三、用户学习日志与进度画像数据规范

用户的所有答题事件和记忆状态均保存在本地存储中，保持严格的不可篡改时序记录：

### 1. 答题流水日志实体 (`QuizLogEntry`)

```typescript
interface QuizLogEntry {
  log_id: string;               // 唯一日志 UUID
  timestamp: number;            // 答题时刻 Unix 时间戳 (ms)
  date_str: string;             // 日期字符串 "2026-10-08" (用于按日聚合)
  session_id: string;           // 单次游戏会话 ID
  game_mode: 'CAMPAIGN' | 'DAILY_REVIEW' | 'WEAKNESS' | 'SPEED_SPRINT' | 'FREE_LAB';
  
  word_id: string;              // 考核单词 ID (如 "panic")
  rule_id: string;              // 考核知识点 ID (如 "RULE_ED_IC_SPECIAL")
  question_type: 'CHOICE' | 'SPELL' | 'SORTER' | 'ROLE_CHECK';
  target_aspect: 'ing' | 'past' | 'past_participle' | 'third_singular' | 'irregular_type' | 'syntax_role';
  
  user_input: string;           // 用户的实际输入/选项 (如 "paniced")
  correct_answer: string;       // 正确答案 (如 "panicked")
  is_correct: boolean;          // 是否正确
  response_time_ms: number;     // 答题耗时毫秒数 (用于评估熟练程度)
  combo_at_moment: number;      // 答此题时的连击数
}
```

### 2. 单词记忆档案实体 (`WordMemoryRecord`)

```typescript
interface WordMemoryRecord {
  word_id: string;              // 动词 ID
  rule_ids: string[];           // 涉及的全部规则
  level: number;                // 记忆阶段 0 ~ 6
  
  first_seen_at: number;        // 首次练习时间戳
  last_reviewed_at: number;     // 最近一次复习时间戳
  next_review_at: number;       // 下次建议复习时间戳 (基于艾宾浩斯动态推算)
  stability_days: number;       // 当前记忆留存稳定周期天数 (1, 2, 4, 7, 15, 30)
  
  total_attempts: number;       // 累计练习次数
  success_count: number;        // 累计正确次数
  failed_count: number;         // 累计失误次数
  current_streak: number;       // 当前连续正确次数
  
  last_error_context?: {        // 最近一次错误留底
    timestamp: number;
    wrong_input: string;
    aspect: string;
  };
}
```

### 3. 用户全局学习画像 (`UserLearningProfile`)

```typescript
interface UserLearningProfile {
  version: string;              // Schema 版本 (如 "1.0.0")
  user_nickname: string;        // 玩家昵称 (默认 "时态探索者")
  created_at: number;           // 账号初始化时间
  last_login_date: string;      // 最近登录日期 "2026-10-08"
  
  // 综合积分统计
  stats: {
    total_answers: number;      // 累计总答题量
    total_correct: number;      // 累计总正确题量
    total_time_seconds: number; // 累计练习总时长
    max_combo: number;          // 历史最高连击记录
    current_level: number;      // 符文师头衔等级 (1~50级)
    exp: number;                // 经验值
  };
  
  // 战役模式通关关卡记录
  campaign_progress: {
    unlocked_stage: number;     // 当前已解锁最高关卡
    stage_stars: Record<number, number>; // 各关卡星级评价 (1~3星)
  };
  
  // 日历打卡聚合数据 (用于渲染 GitHub 风格贡献热力图)
  daily_activity: Record<string, {
    date: string;               // "2026-10-08"
    answers_count: number;      // 今日答题总数
    correct_count: number;      // 今日正确数
    minutes_spent: number;      // 今日投入分钟数
  }>;
}
```

---

## 四、知识覆盖率与分析引擎计算逻辑

前端数据分析模块提供以下开箱即用的实时统计计算器：

```javascript
// 核心统计分析计算模块示例
class LearningAnalyticsEngine {
  constructor(verbDatabase, memoryRecords, quizLogs) {
    this.verbs = verbDatabase;
    this.records = memoryRecords;
    this.logs = quizLogs;
  }

  // 1. 获取全局知识覆盖率指标
  getCoverageMetrics() {
    const totalWords = this.verbs.length;
    const practicedWords = Object.keys(this.records).length;
    const masteredWords = Object.values(this.records).filter(r => r.level >= 4).length;
    
    return {
      totalWords,
      practicedWords,
      masteredWords,
      wordCoverageRate: Math.round((practicedWords / totalWords) * 100),
      masteryRate: Math.round((masteredWords / totalWords) * 100)
    };
  }

  // 2. 根据当前系统日期判断待复习词汇与记忆生锈词汇
  getReviewScheduleOverview(currentTimestamp = Date.now()) {
    const dueList = [];
    const rustyList = [];
    const freshList = [];

    const now = new Date(currentTimestamp);
    // 抹平到当天最后一毫秒
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    for (const record of Object.values(this.records)) {
      if (record.next_review_at <= endOfToday) {
        const daysOverdue = (endOfToday - record.next_review_at) / (1000 * 3600 * 24);
        if (daysOverdue > record.stability_days * 2) {
          rustyList.push(record);
        } else {
          dueList.push(record);
        }
      } else {
        freshList.push(record);
      }
    }

    return {
      todayDueCount: dueList.length,
      rustyCount: rustyList.length,
      healthyCount: freshList.length,
      dueList,
      rustyList
    };
  }

  // 3. 各规则维度掌握度雷达图数据
  getRuleRadarStats() {
    const ruleStatMap = {};
    for (const log of this.logs) {
      if (!ruleStatMap[log.rule_id]) {
        ruleStatMap[log.rule_id] = { total: 0, correct: 0 };
      }
      ruleStatMap[log.rule_id].total += 1;
      if (log.is_correct) ruleStatMap[log.rule_id].correct += 1;
    }
    return ruleStatMap;
  }
}
```
