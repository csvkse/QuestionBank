/**
 * Built-in Preset Knowledge Decks
 * Core: shared/builtin-decks.js
 */

export const BUILTIN_DECKS = [
  // 1. 英语动词形态题库 (完整保留原版全部考点与规则，充盈同胞池至 >=4 条)
  {
    id: 'deck_verbs',
    title: '英语动词形态与变异法则',
    icon: '⚡',
    lang: 'en-US',
    type: 'language',
    description: '涵盖 -ic 加 k 黄金特例、-ing/-ed 规则变化、不规则 AAA~ABC 五大阵营、三单特例与词性辨析。',
    guide: {
      summary: '英语动词变位的底层逻辑是由语音同化与历史借词演变决定的。抓住 -ic 变位锁 k 音铁律、闭音节辅元辅双写规律，以及 AAA~ABC 五大不规则阵营，建立网状发音与形态心智模型。',
      markdown: `### 一、 为什么以 -ic 结尾的动词变位必须加 k？\n\n动词以 \`-ic\` 结尾时，原词发硬音 **/k/**（如 *panic* /ˈpænɪk/）。当追加 \`-ing\` 或 \`-ed\` 时，字母 c 紧邻了 **i** 或 **e**。根据自然拼读法则，c 在 e/i 前会软化发 **/s/** 音（如 city, cell）。为了阻止语音软化变音，英语引入了**“插入保护性字母 k”**的规则，用 k 强行锁定 **/k/** 的发音！\n\n- **黄金特例群**：*picnic → picnicked, panic → panicking, mimic → mimicked, traffic → trafficked, frolic → frolicking*。\n\n---\n\n### 二、 不规则动词五大阵营心智模型\n\n- **AAA 型 (三态同形)**：坚如磐石，过去式与分词形态完全一致（*cost, put, cut, hit, let, read (注意发音变/red/)*）；\n- **AAB / ABA 型 (韵律回环)**：原形与过去分词呼应（*come→came→come, run→ran→run, beat→beat→beaten*）；\n- **ABB 型 (核心大军)**：过去式与过去分词合并（*find→found, build→built, bring→brought, teach→taught*）；\n- **ABC 型 (强变化大分裂)**：三态全异，过去分词通常以 -(e)n 结尾（*go→went→gone, do→did→done, see→saw→seen, write→wrote→written*）。`
    },
    categories: [
      { id: 'CAT_IC_SPECIAL', name: '⭐ -ic 结尾加 k 必考特例', group: '一、规则变形与读音规律' },
      { id: 'CAT_ING_RULES', name: '🌀 现在分词四规律 (双写/去e/ie变y)', group: '一、规则变形与读音规律' },
      { id: 'CAT_ED_RULES', name: '🛡️ 规则过去式四变化 (+ed/+d/双写/辅音+y)', group: '一、规则变形与读音规律' },
      { id: 'CAT_IRREG_AAA', name: '⚡ 不规则: AAA 型 (三态同形)', group: '二、不规则动词核心记忆法' },
      { id: 'CAT_IRREG_AAB_ABA', name: '⚡ 不规则: AAB / ABA 型', group: '二、不规则动词核心记忆法' },
      { id: 'CAT_IRREG_ABB', name: '⚡ 不规则: ABB 型 (核心中流砥柱)', group: '二、不规则动词核心记忆法' },
      { id: 'CAT_IRREG_ABC', name: '⚡ 不规则: ABC 型 (三态皆异)', group: '二、不规则动词核心记忆法' },
      { id: 'CAT_THIRD_SINGULAR', name: '🔥 第三人称单数与真不规则', group: '三、第三人称单数与真不规则' }
    ],
    layers: [
      { level: 1, name: 'Layer 1: 基础认知 (常规直变)' },
      { level: 2, name: 'Layer 2: 规律运用 (双写/去e/核心变位)' },
      { level: 3, name: 'Layer 3: 陷阱与特例 (反直觉/盲区)' }
    ],
    entities: [
      // -ic 特例 (5条)
      { id: 'v_picnic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'picnic', subtitle: '/ˈpɪknɪk/ · 野餐', lang: 'en-US', phonetics: { ipa: '/ˈpɪknɪk/', tts_clean: 'picnic' }, prompt: '转化为过去式 (-ed)：', answer: 'picnicked', confusedWith: 'v_panic', pitfalls: '漏加 k 拼成 picniced 是最高频错误！', explanation: '动词以 ic 结尾，变 -ing / -ed 时先加 k，再加后缀！' },
      { id: 'v_panic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'panic', subtitle: '/ˈpænɪk/ · 惊慌', lang: 'en-US', phonetics: { ipa: '/ˈpænɪk/', tts_clean: 'panic' }, prompt: '转化为现在分词 (-ing)：', answer: 'panicking', confusedWith: 'v_picnic', pitfalls: 'panicing 漏加 k 报错！', explanation: 'panic 变 -ing 必须先补 k 变 panicking。' },
      { id: 'v_mimic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'mimic', subtitle: '/ˈmɪmɪk/ · 模仿', lang: 'en-US', phonetics: { ipa: '/ˈmɪmɪk/', tts_clean: 'mimic' }, prompt: '转化为过去分词 (-ed)：', answer: 'mimicked', explanation: 'mimic 变 -ed 先加 k → mimicked。' },
      { id: 'v_frolic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'frolic', subtitle: '/ˈfrɒlɪk/ · 嬉戏', lang: 'en-US', phonetics: { ipa: '/ˈfrɒlɪk/', tts_clean: 'frolic' }, prompt: '转化为现在分词 (-ing)：', answer: 'frolicking', explanation: 'frolic 变 -ing 先加 k → frolicking。' },
      { id: 'v_traffic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'traffic', subtitle: '/ˈtræfɪk/ · 非法交易', lang: 'en-US', phonetics: { ipa: '/ˈtræfɪk/', tts_clean: 'traffic' }, prompt: '转化为过去式 (-ed)：', answer: 'trafficked', explanation: 'traffic 作动词变 -ed 先加 k → trafficked。' },
      
      // -ing 规则 (5条)
      { id: 'v_work', categoryId: 'CAT_ING_RULES', layer: 1, title: 'work', subtitle: '/wɜːk/ · 工作', lang: 'en-US', phonetics: { ipa: '/wɜːk/', tts_clean: 'work' }, prompt: '转化为现在分词 (-ing)：', answer: 'working', explanation: '一般情况直接加 ing。' },
      { id: 'v_write', categoryId: 'CAT_ING_RULES', layer: 2, title: 'write', subtitle: '/raɪt/ · 写作', lang: 'en-US', phonetics: { ipa: '/raɪt/', tts_clean: 'write' }, prompt: '转化为现在分词 (-ing)：', answer: 'writing', pitfalls: '以不发音 e 结尾，必须去掉 e 再加 ing！', explanation: 'write 去 e + ing 变 writing。' },
      { id: 'v_run', categoryId: 'CAT_ING_RULES', layer: 2, title: 'run', subtitle: '/rʌn/ · 奔跑', lang: 'en-US', phonetics: { ipa: '/rʌn/', tts_clean: 'run' }, prompt: '转化为现在分词 (-ing)：', answer: 'running', explanation: '重读闭音节辅元辅，双写 n 再加 ing。' },
      { id: 'v_lie', categoryId: 'CAT_ING_RULES', layer: 3, title: 'lie', subtitle: '/laɪ/ · 躺/说谎', lang: 'en-US', phonetics: { ipa: '/laɪ/', tts_clean: 'lie' }, prompt: '转化为现在分词 (-ing)：', answer: 'lying', confusedWith: 'v_die', pitfalls: '直接加 ing 或 lieing 都是经典错误！', explanation: '以 ie 结尾，变 y + ing → lying。' },
      { id: 'v_die', categoryId: 'CAT_ING_RULES', layer: 3, title: 'die', subtitle: '/daɪ/ · 死亡', lang: 'en-US', phonetics: { ipa: '/daɪ/', tts_clean: 'die' }, prompt: '转化为现在分词 (-ing)：', answer: 'dying', confusedWith: 'v_lie', explanation: '以 ie 结尾，变 y + ing → dying。' },

      // -ed 规则 (充盈至5条)
      { id: 'v_love', categoryId: 'CAT_ED_RULES', layer: 1, title: 'love', subtitle: '/lʌv/ · 爱', lang: 'en-US', phonetics: { ipa: '/lʌv/', tts_clean: 'love' }, prompt: '转化为过去式 (-ed)：', answer: 'loved', explanation: '以 e 结尾直接加 d。' },
      { id: 'v_play', categoryId: 'CAT_ED_RULES', layer: 1, title: 'play', subtitle: '/pleɪ/ · 玩耍/播放', lang: 'en-US', phonetics: { ipa: '/pleɪ/', tts_clean: 'play' }, prompt: '转化为过去式 (-ed)：', answer: 'played', pitfalls: '元音+y 结尾直接加 ed，切勿误变 plaied！', explanation: '元音+y 结尾直接加 ed。' },
      { id: 'v_stop', categoryId: 'CAT_ED_RULES', layer: 2, title: 'stop', subtitle: '/stɒp/ · 停止', lang: 'en-US', phonetics: { ipa: '/stɒp/', tts_clean: 'stop' }, prompt: '转化为过去式 (-ed)：', answer: 'stopped', explanation: '重读闭音节辅元辅，双写 p 再加 ed。' },
      { id: 'v_study', categoryId: 'CAT_ED_RULES', layer: 2, title: 'study', subtitle: '/ˈstʌdi/ · 学习', lang: 'en-US', phonetics: { ipa: '/ˈstʌdi/', tts_clean: 'study' }, prompt: '转化为过去式 (-ed)：', answer: 'studied', confusedWith: 'v_play', explanation: '辅音+y 结尾，变 y 为 i 再加 ed。' },
      { id: 'v_drop', categoryId: 'CAT_ED_RULES', layer: 2, title: 'drop', subtitle: '/drɒp/ · 落下', lang: 'en-US', phonetics: { ipa: '/drɒp/', tts_clean: 'drop' }, prompt: '转化为过去分词 (-ed)：', answer: 'dropped', explanation: '辅元辅重读闭音节，双写 p 再加 ed。' },

      // 不规则 AAA (充盈至5条)
      { id: 'v_cost', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'cost', subtitle: '/kɒst/ · 花费', lang: 'en-US', phonetics: { ipa: '/kɒst/', tts_clean: 'cost' }, prompt: '转化为过去式：', answer: 'cost', explanation: 'AAA 型：cost → cost → cost 三态同形。' },
      { id: 'v_put', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'put', subtitle: '/pʊt/ · 放置', lang: 'en-US', phonetics: { ipa: '/pʊt/', tts_clean: 'put' }, prompt: '转化为过去分词：', answer: 'put', explanation: 'AAA 型：put → put → put。' },
      { id: 'v_cut', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'cut', subtitle: '/kʌt/ · 切割', lang: 'en-US', phonetics: { ipa: '/kʌt/', tts_clean: 'cut' }, prompt: '转化为过去式：', answer: 'cut', explanation: 'AAA 型：cut → cut → cut。' },
      { id: 'v_hit', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'hit', subtitle: '/hɪt/ · 击打', lang: 'en-US', phonetics: { ipa: '/hɪt/', tts_clean: 'hit' }, prompt: '转化为过去分词：', answer: 'hit', explanation: 'AAA 型：hit → hit → hit。' },
      { id: 'v_read', categoryId: 'CAT_IRREG_AAA', layer: 3, title: 'read', subtitle: '/riːd/ · 阅读', lang: 'en-US', phonetics: { ipa: '/riːd/', tts_clean: 'read' }, prompt: '转化为过去式：', answer: 'read', pitfalls: '拼写完全不变，但过去式发音变为 /red/！', explanation: 'AAA 型拼写同形，但注意读音发生改变。' },

      // 不规则 AAB / ABA (充盈至5条)
      { id: 'v_beat', categoryId: 'CAT_IRREG_AAB_ABA', layer: 3, title: 'beat', subtitle: '/biːt/ · 击败', lang: 'en-US', phonetics: { ipa: '/biːt/', tts_clean: 'beat' }, prompt: '转化为过去分词：', answer: 'beaten', explanation: 'AAB 型：beat → beat → beaten，仅过去分词加 en。' },
      { id: 'v_come', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'come', subtitle: '/kʌm/ · 来', lang: 'en-US', phonetics: { ipa: '/kʌm/', tts_clean: 'come' }, prompt: '转化为过去分词：', answer: 'come', confusedWith: 'v_become', explanation: 'ABA 型：come → came → come，原形与过去分词同形。' },
      { id: 'v_become', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'become', subtitle: '/bɪˈkʌm/ · 成为', lang: 'en-US', phonetics: { ipa: '/bɪˈkʌm/', tts_clean: 'become' }, prompt: '转化为过去分词：', answer: 'become', confusedWith: 'v_come', explanation: 'ABA 型：become → became → become。' },
      { id: 'v_run_aba', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'run', subtitle: '/rʌn/ · 奔跑', lang: 'en-US', phonetics: { ipa: '/rʌn/', tts_clean: 'run' }, prompt: '转化为过去分词：', answer: 'run', explanation: 'ABA 型：run → ran → run，原形与分词回环同形。' },
      { id: 'v_overcome', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'overcome', subtitle: '/ˌəʊvəˈkʌm/ · 克服', lang: 'en-US', phonetics: { ipa: '/ˌəʊvəˈkʌm/', tts_clean: 'overcome' }, prompt: '转化为过去式：', answer: 'overcame', explanation: 'ABA 型：overcome → overcame → overcome。' },

      // 不规则 ABB (4条)
      { id: 'v_find', categoryId: 'CAT_IRREG_ABB', layer: 2, title: 'find', subtitle: '/faɪnd/ · 发现', lang: 'en-US', phonetics: { ipa: '/faɪnd/', tts_clean: 'find' }, prompt: '转化为过去式：', answer: 'found', explanation: 'ABB 型：find → found → found。' },
      { id: 'v_build', categoryId: 'CAT_IRREG_ABB', layer: 2, title: 'build', subtitle: '/bɪld/ · 建造', lang: 'en-US', phonetics: { ipa: '/bɪld/', tts_clean: 'build' }, prompt: '转化为过去分词：', answer: 'built', explanation: 'ABB 型：build → built → built。' },
      { id: 'v_teach', categoryId: 'CAT_IRREG_ABB', layer: 3, title: 'teach', subtitle: '/tiːtʃ/ · 教授', lang: 'en-US', phonetics: { ipa: '/tiːtʃ/', tts_clean: 'teach' }, prompt: '转化为过去式：', answer: 'taught', confusedWith: 'v_think', pitfalls: '注意与 think(thought) 区分！', explanation: 'ABB 型：teach → taught → taught。' },
      { id: 'v_think', categoryId: 'CAT_IRREG_ABB', layer: 3, title: 'think', subtitle: '/θɪŋk/ · 思考', lang: 'en-US', phonetics: { ipa: '/θɪŋk/', tts_clean: 'think' }, prompt: '转化为过去式：', answer: 'thought', confusedWith: 'v_teach', explanation: 'ABB 型：think → thought → thought。' },

      // 不规则 ABC (4条)
      { id: 'v_go', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'go', subtitle: '/ɡəʊ/ · 去', lang: 'en-US', phonetics: { ipa: '/ɡəʊ/', tts_clean: 'go' }, prompt: '转化为过去分词：', answer: 'gone', explanation: 'ABC 型：go → went → gone。' },
      { id: 'v_see', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'see', subtitle: '/siː/ · 看见', lang: 'en-US', phonetics: { ipa: '/siː/', tts_clean: 'see' }, prompt: '转化为过去式：', answer: 'saw', explanation: 'ABC 型：see → saw → seen。' },
      { id: 'v_eat', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'eat', subtitle: '/iːt/ · 吃', lang: 'en-US', phonetics: { ipa: '/iːt/', tts_clean: 'eat' }, prompt: '转化为过去分词：', answer: 'eaten', explanation: 'ABC 型：eat → ate → eaten。' },
      { id: 'v_break', categoryId: 'CAT_IRREG_ABC', layer: 3, title: 'break', subtitle: '/breɪk/ · 打碎', lang: 'en-US', phonetics: { ipa: '/breɪk/', tts_clean: 'break' }, prompt: '转化为过去分词：', answer: 'broken', explanation: 'ABC 型：break → broke → broken。' },

      // 三单与真不规则 (充盈至5条)
      { id: 'v_be', categoryId: 'CAT_THIRD_SINGULAR', layer: 3, title: 'be', subtitle: '/biː/ · 是', lang: 'en-US', phonetics: { ipa: '/biː/', tts_clean: 'be' }, prompt: '转化为第三人称单数 (现在时)：', answer: 'is', explanation: '真不规则三单：be 直接变 is。' },
      { id: 'v_have', categoryId: 'CAT_THIRD_SINGULAR', layer: 3, title: 'have', subtitle: '/hæv/ · 拥有', lang: 'en-US', phonetics: { ipa: '/hæv/', tts_clean: 'have' }, prompt: '转化为第三人称单数：', answer: 'has', explanation: '真不规则三单：have 直接变 has。' },
      { id: 'v_pass', categoryId: 'CAT_THIRD_SINGULAR', layer: 1, title: 'pass', subtitle: '/pɑːs/ · 通过', lang: 'en-US', phonetics: { ipa: '/pɑːs/', tts_clean: 'pass' }, prompt: '转化为第三人称单数：', answer: 'passes', explanation: '以 s 结尾加 es → passes。' },
      { id: 'v_do', categoryId: 'CAT_THIRD_SINGULAR', layer: 1, title: 'do', subtitle: '/duː/ · 做', lang: 'en-US', phonetics: { ipa: '/duː/', tts_clean: 'do' }, prompt: '转化为第三人称单数：', answer: 'does', explanation: '辅音+o 结尾加 es → does (/dʌz/)。' },
      { id: 'v_go_es', categoryId: 'CAT_THIRD_SINGULAR', layer: 1, title: 'go', subtitle: '/ɡəʊ/ · 去', lang: 'en-US', phonetics: { ipa: '/ɡəʊ/', tts_clean: 'go' }, prompt: '转化为第三人称单数：', answer: 'goes', explanation: '辅音+o 结尾加 es → goes (/ɡəʊz/)。' }
    ]
  },

  // 2. HTTP 网络状态码与协议题库 (充盈同胞池至 >=4 条)
  {
    id: 'deck_http',
    title: 'HTTP 状态码与网络协议',
    icon: '🌐',
    lang: 'zh-CN',
    description: '梳理 2xx 成功、3xx 重定向、4xx 客户端错误与 5xx 服务端错误，专攻 401 vs 403 等高频混淆考点。',
    guide: {
      summary: 'HTTP 状态码是客户端与服务端在分布式无状态协议下的契约语言。从 1xx 到 5xx 构成了完整的请求生命周期诊断体系，重点攻坚 401（未认证）与 403（未授权）、502（坏网关）与 504（网关超时）等易混淆关系。',
      markdown: `### 一、 报文请求-响应生命周期的全景架构\n\n- **1xx (信息响应)**：协议握手与请求协商中（如 101 Switching Protocols）；\n- **2xx (成功响应)**：请求已被成功接收并正常处理（如 200 OK、204 No Content）；\n- **3xx (重定向族)**：资源寻址迁移，客户端需配合发起二次请求（301 永久 / 302 临时 / 304 协商缓存）；\n- **4xx (客户端责任)**：请求格式错误、身份未认证或权限受限（400 格式错 / 401 未登录 / 403 权限不足 / 404 不存在）；\n- **5xx (服务端责任)**：服务器内部崩溃或上游反向代理通信故障（500 内部崩溃 / 502 网关坏 / 504 上游响应超时）。\n\n---\n\n### 二、 核心混淆状态码全景对照\n\n- **401 Unauthorized vs 403 Forbidden**：\n  - **401 (未认证)**：服务器不知道你是谁（未带 Token 或凭据已过期），浏览器通常跳转登录页；\n  - **403 (未授权)**：服务器知道你是谁，但你的账号没有对应权限，重新输入密码依然无权访问。\n- **502 Bad Gateway vs 504 Gateway Timeout**：\n  - **502 (错误网关)**：反向代理（如 Nginx）向上游转发时，上游服务挂掉或端口未监听；\n  - **504 (网关超时)**：上游服务处理太慢（如慢查询 SQL 卡死），超过了代理等待超时阈值。`
    },
    categories: [
      { id: 'CAT_2XX', name: '2xx 成功与已接受', group: '一、正常响应与重定向族' },
      { id: 'CAT_3XX', name: '3xx 重定向与缓存', group: '一、正常响应与重定向族' },
      { id: 'CAT_4XX', name: '4xx 客户端错误 (重点攻坚)', group: '二、客户端与服务端异常族' },
      { id: 'CAT_5XX', name: '5xx 服务端与网关异常', group: '二、客户端与服务端异常族' }
    ],
    layers: [
      { level: 1, name: 'Layer 1: 基础概念' },
      { level: 2, name: 'Layer 2: 常见业务场景' },
      { level: 3, name: 'Layer 3: 隐秘陷阱与对比' }
    ],
    entities: [
      // 2xx (充盈至4条)
      { id: 'http_200', categoryId: 'CAT_2XX', layer: 1, title: '200 OK', subtitle: '成功响应', lang: 'zh-CN', phonetics: { tts_clean: '200 OK' }, prompt: '其核心含义与处理机制是？', answer: '请求已成功，响应头与实体主体正常返回', explanation: '标准成功响应。' },
      { id: 'http_201', categoryId: 'CAT_2XX', layer: 1, title: '201 Created', subtitle: '已创建', lang: 'zh-CN', phonetics: { tts_clean: '201 Created' }, prompt: '其核心语义与应用场景是？', answer: '请求成功并且服务器创建了新资源，响应头通常带有 Location', explanation: '常用于 POST 新建资源成功后的状态反馈。' },
      { id: 'http_204', categoryId: 'CAT_2XX', layer: 2, title: '204 No Content', subtitle: '无内容成功', lang: 'zh-CN', phonetics: { tts_clean: '204 No Content' }, prompt: '其核心特点是？', answer: '请求成功处理，但响应报文不包含实体主体内容', explanation: '常用于预检 OPTIONS 请求或 DELETE 成功后无需返回数据。' },
      { id: 'http_206', categoryId: 'CAT_2XX', layer: 2, title: '206 Partial Content', subtitle: '部分内容', lang: 'zh-CN', phonetics: { tts_clean: '206 Partial Content' }, prompt: '其核心支持的协议特性是？', answer: '范围请求 (Range)，常用于音视频分段播放、断点续传及大文件并发下载', explanation: '服务器成功处理了包含 Range 头的客户端范围请求。' },

      // 3xx (充盈至4条)
      { id: 'http_301', categoryId: 'CAT_3XX', layer: 2, title: '301 Moved Permanently', subtitle: '永久重定向', lang: 'zh-CN', phonetics: { tts_clean: '301 Moved Permanently' }, prompt: '其特征与缓存机制是？', answer: '资源永久迁移至新 URI，搜索引擎会更新索引且浏览器会强缓存', confusedWith: 'http_302', explanation: '永久重定向，后续直接访问 Location 给出的新地址。' },
      { id: 'http_302', categoryId: 'CAT_3XX', layer: 2, title: '302 Found', subtitle: '临时重定向', lang: 'zh-CN', phonetics: { tts_clean: '302 Found' }, prompt: '其特征是？', answer: '资源临时移动，客户端本次应重定向但未来仍应访问原 URI', confusedWith: 'http_301', explanation: '临时重定向，搜索引擎保留原 URL。' },
      { id: 'http_304', categoryId: 'CAT_3XX', layer: 2, title: '304 Not Modified', subtitle: '协商缓存命中', lang: 'zh-CN', phonetics: { tts_clean: '304 Not Modified' }, prompt: '其核心作用是？', answer: '资源未修改，客户端可直接使用本地缓存，不传输 Body', explanation: '配合 If-None-Match (ETag) 或 If-Modified-Since 使用。' },
      { id: 'http_307', categoryId: 'CAT_3XX', layer: 3, title: '307 Temporary Redirect', subtitle: '临时重定向 (严格保留方法)', lang: 'zh-CN', phonetics: { tts_clean: '307 Temporary Redirect' }, prompt: '其与 302 的根本区别是？', answer: '严格禁止客户端将 POST 方法篡改为 GET，必须以原方法重定向', confusedWith: 'http_302', explanation: '302 历史上会被浏览器错误重写为 GET，307 严格保护原始请求方法。' },

      // 4xx (4条)
      { id: 'http_400', categoryId: 'CAT_4XX', layer: 1, title: '400 Bad Request', subtitle: '请求报文错误', lang: 'zh-CN', phonetics: { tts_clean: '400 Bad Request' }, prompt: '常见诱因是？', answer: '请求参数或语法格式错误，服务器无法解析', explanation: '客户端提交了无效的 JSON 或缺损参数。' },
      { id: 'http_401', categoryId: 'CAT_4XX', layer: 3, title: '401 Unauthorized', subtitle: '未认证 (缺少凭据)', lang: 'zh-CN', phonetics: { tts_clean: '401 Unauthorized' }, prompt: '其核心定义是？', answer: '缺少有效身份凭证 (未携带 Token 或未登录)', confusedWith: 'http_403', pitfalls: '401 是不知道你是谁；403 是知道你是谁但不让你进！', explanation: '未认证状态，响应通常带有 WWW-Authenticate 头。' },
      { id: 'http_403', categoryId: 'CAT_4XX', layer: 3, title: '403 Forbidden', subtitle: '禁止访问 (权限不足)', lang: 'zh-CN', phonetics: { tts_clean: '403 Forbidden' }, prompt: '其核心定义是？', answer: '服务器理解请求但拒绝执行，即使提供有效凭据也无权访问', confusedWith: 'http_401', pitfalls: '403 重新输入密码登录依然无权访问，属于鉴权失败。', explanation: '权限不足 (如普通用户尝试访问超管接口)。' },
      { id: 'http_404', categoryId: 'CAT_4XX', layer: 1, title: '404 Not Found', subtitle: '资源未找到', lang: 'zh-CN', phonetics: { tts_clean: '404 Not Found' }, prompt: '其核心定义是？', answer: '服务器无法在请求的 URI 上找到对应资源', explanation: 'URL 不存在或已被彻底删除。' },

      // 5xx (充盈至4条)
      { id: 'http_500', categoryId: 'CAT_5XX', layer: 1, title: '500 Internal Server Error', subtitle: '服务器内部错误', lang: 'zh-CN', phonetics: { tts_clean: '500 Internal Server Error' }, prompt: '其核心定义是？', answer: '服务器在处理请求时发生未捕获的内部程序异常', explanation: '服务端代码崩溃抛出未处理的 Exception。' },
      { id: 'http_502', categoryId: 'CAT_5XX', layer: 3, title: '502 Bad Gateway', subtitle: '错误网关', lang: 'zh-CN', phonetics: { tts_clean: '502 Bad Gateway' }, prompt: '通常由什么架构原因触发？', answer: '反向代理 (如 Nginx) 从上游服务器收到了无效响应', confusedWith: 'http_504', explanation: '上游服务挂掉或端口未监听。' },
      { id: 'http_503', categoryId: 'CAT_5XX', layer: 2, title: '503 Service Unavailable', subtitle: '服务不可用', lang: 'zh-CN', phonetics: { tts_clean: '503 Service Unavailable' }, prompt: '其核心诱因与响应特征是？', answer: '服务器因过载或停机维护暂时无法响应，通常携带 Retry-After 建议重试间隔', explanation: '临时故障或计划停机，客户端应在稍后按退避策略重试。' },
      { id: 'http_504', categoryId: 'CAT_5XX', layer: 3, title: '504 Gateway Timeout', subtitle: '网关超时', lang: 'zh-CN', phonetics: { tts_clean: '504 Gateway Timeout' }, prompt: '其与 502 的根本区别是？', answer: '代理服务器等待上游服务响应超时，上游处理太慢未及时返回', confusedWith: 'http_502', explanation: '上游执行超时导致超时中断。' }
    ]
  },

  // 3. Python 核心概念与避坑指南 (充盈同胞池至 >=4 条)
  {
    id: 'deck_python',
    title: 'Python 核心数据类型与内存模型',
    icon: '🐍',
    lang: 'zh-CN',
    description: '透彻理解不可变对象与可变对象、引用计数、浅拷贝与深拷贝、默认参数跨调用共享等经典陷阱。',
    guide: {
      summary: 'Python 的核心机制建立在 "一切皆对象"、PyObject 内存模型以及引用传递基础之上。透彻理解可变对象与不可变对象在堆内存中的本质差异，掌握默认参数跨调用共享、深浅拷贝和 is vs == 判据。',
      markdown: `### 一、 CPython 堆内存对象与指针模型\n\n所有变量名本质上都是指向堆中 PyObject 结构体的引用指针：\n- **不可变对象 (Immutable)**：int, float, str, tuple, frozenset。一旦创建，其内存地址中的值绝不可更改；任何修改操作均在堆中创建全新的内存对象；\n- **可变对象 (Mutable)**：list, dict, set。可在自身原内存地址内就地进行修改 (In-place mutation)。\n\n---\n\n### 二、 经典语言级避坑指南\n\n- **默认参数跨函数调用共享陷阱**：\n  \`def append_to(item, list_arg=[])\` 默认参数在函数定义（编译阶段）仅求值一次！所有未传该参数的调用均在共享同一个列表对象。正解是使用不可变对象 \`None\` 作为默认占位符。\n- **is 与 == 的本质判据**：\n  \`is\` 比较的是底层物理内存地址 \`id(a) == id(b)\`；\`==\` 调用对象的 \`__eq__\` 比较其内容值。判空必须使用 \`if x is None\`。`
    },
    categories: [
      { id: 'CAT_MUTABLE', name: '可变对象与容器 (Mutable)', group: '一、核心内存对象模型' },
      { id: 'CAT_IMMUTABLE', name: '不可变对象 (Immutable)', group: '一、核心内存对象模型' },
      { id: 'CAT_PITFALLS', name: '语言运行时经典避坑 (Gotchas)', group: '二、语言运行时经典避坑' }
    ],
    layers: [
      { level: 1, name: 'Layer 1: 基础属性' },
      { level: 2, name: 'Layer 2: 内存与机制' },
      { level: 3, name: 'Layer 3: 隐蔽陷阱' }
    ],
    entities: [
      // 可变容器 (充盈至4条)
      { id: 'py_list', categoryId: 'CAT_MUTABLE', layer: 1, title: '列表 (list)', subtitle: '动态连续数组', lang: 'zh-CN', phonetics: { tts_clean: '列表' }, prompt: '其核心特征是？', answer: '可变序列，支持原地追加修改，时间复杂度 append 为 O(1)', explanation: '底层为可动态扩容的指针数组。' },
      { id: 'py_dict', categoryId: 'CAT_MUTABLE', layer: 1, title: '字典 (dict)', subtitle: '哈希映射表', lang: 'zh-CN', phonetics: { tts_clean: '字典' }, prompt: '其对键 (Key) 的要求是？', answer: '键必须是可哈希 (Hashable) 的不可变对象，查询为平均 O(1)', explanation: '基于紧凑哈希表实现。' },
      { id: 'py_set', categoryId: 'CAT_MUTABLE', layer: 1, title: '集合 (set)', subtitle: '无序互异容器', lang: 'zh-CN', phonetics: { tts_clean: '集合' }, prompt: '其核心特征与元素要求是？', answer: '无序且元素互异，支持快速 O(1) 成员检测，内部元素必须是不可变可哈希对象', explanation: '用于去重与交并差集合运算。' },
      { id: 'py_bytearray', categoryId: 'CAT_MUTABLE', layer: 2, title: '可变字节数组 (bytearray)', subtitle: '二进制可变序列', lang: 'zh-CN', phonetics: { tts_clean: '可变字节数组' }, prompt: '其与 bytes 的核心差异是？', answer: 'bytes 为不可变字节序列，bytearray 支持原地索引修改与切片赋值', explanation: '用于高性能二进制协议组包与底层 I/O 流缓冲。' },

      // 不可变对象 (充盈至4条)
      { id: 'py_tuple', categoryId: 'CAT_IMMUTABLE', layer: 1, title: '元组 (tuple)', subtitle: '不可变序列', lang: 'zh-CN', phonetics: { tts_clean: '元组' }, prompt: '其核心特征是？', answer: '一旦创建不可修改长度与指向，可作为字典键或集合元素', explanation: '内存开销小，元素只读。' },
      { id: 'py_str', categoryId: 'CAT_IMMUTABLE', layer: 1, title: '字符串 (str)', subtitle: '字符序列', lang: 'zh-CN', phonetics: { tts_clean: '字符串' }, prompt: '对其拼接修改会发生什么？', answer: '属于不可变对象，任何拼接或 replace 均会分配新内存', explanation: '大量拼接推荐使用 "".join(list) 提高效率。' },
      { id: 'py_int', categoryId: 'CAT_IMMUTABLE', layer: 1, title: '整数 (int)', subtitle: '不可变标量与大数精度', lang: 'zh-CN', phonetics: { tts_clean: '整数' }, prompt: '其在 CPython 运行时的内存行为是？', answer: '不可变标量，具备小整数对象池缓存 [-5, 256]，大整数支持理论无上限的任意精度', explanation: '数值运算超出范围会自动扩容为多字长表示。' },
      { id: 'py_frozenset', categoryId: 'CAT_IMMUTABLE', layer: 2, title: '冻结集合 (frozenset)', subtitle: '不可变可哈希集合', lang: 'zh-CN', phonetics: { tts_clean: '冻结集合' }, prompt: '其典型应用场景是？', answer: '由于其不可变性具备哈希值，可作为字典的键 (dict key) 或另一个 set 的元素', explanation: '不可变的集合实现。' },

      // 经典避坑 (充盈至4条)
      { id: 'py_def_arg', categoryId: 'CAT_PITFALLS', layer: 3, title: 'def f(x=[]): 默认参数陷阱', subtitle: '跨函数调用共享', lang: 'zh-CN', phonetics: { tts_clean: '默认参数陷阱' }, prompt: '该代码的潜在问题是？', answer: '默认参数在函数定义时完成求值，所有调用共享同一个列表对象', pitfalls: '多次调用该函数，x 会不断累积此前调用的值！推荐使用 def f(x=None)。', explanation: 'Python 函数属于一级对象，默认参数保存在 __defaults__ 元组中。' },
      { id: 'py_copy', categoryId: 'CAT_PITFALLS', layer: 3, title: 'copy.copy() 浅拷贝', subtitle: '与 deepcopy 的差异', lang: 'zh-CN', phonetics: { tts_clean: '浅拷贝' }, prompt: '其内存复制行为是？', answer: '仅复制父对象外壳，其内部嵌套的子对象依然共享相同引用', explanation: '修改子对象会相互影响；彻底隔离需用 copy.deepcopy()。' },
      { id: 'py_is_eq', categoryId: 'CAT_PITFALLS', layer: 2, title: 'is 与 == 的本质区别', subtitle: '同一性 vs 等价性', lang: 'zh-CN', phonetics: { tts_clean: '同一性对比' }, prompt: '其核心判决依据是？', answer: 'is 比较两个变量的内存地址 id()，== 比较对象的内容值', explanation: '判空必须使用 if x is None。' },
      { id: 'py_late_binding', categoryId: 'CAT_PITFALLS', layer: 3, title: '闭包晚期延迟绑定', subtitle: '循环中 lambda 引用变量陷阱', lang: 'zh-CN', phonetics: { tts_clean: '闭包延迟绑定' }, prompt: 'for 循环生成包含 lambda 的列表时，函数内部变量的值何时确定？', answer: '晚期绑定：内部函数在执行时而非定义时查找外部变量，最终均获得循环终值', pitfalls: '经典解法是借助默认参数立即固化值：lambda i=i: i * 2。', explanation: 'Python 闭包捕获的是作用域变量名引用而非当前数值快照。' }
    ]
  },

  // 4. 日语五十音与假名易混辨析题库 (全新官方示范库，第一公民多语种支持)
  {
    id: 'deck_japanese',
    title: '日语五十音与假名易混辨析',
    icon: '🌸',
    lang: 'ja-JP',
    type: 'language',
    description: '专攻五十音清音、易混假名（ね/れ/わ、あ/お、さ/き）发音及书写特征，建立高保真视听连结。',
    guide: {
      summary: '五十音图是日语语音和文字系统的基石。通过横向“段”（元音共鸣）与纵向“行”（辅音阻碍）的二维矩阵，配合微观形近字辨析（如ね/れ/わ三姐妹），构建坚实的假名视听神经回路。',
      markdown: `### 一、 五十音图的二维矩阵架构\n\n日语五十音图以 **5 个元音（段：あ、い、う、え、お）** 与 **9 个辅音（行：あ、か、さ、た、な、は、ま、や、ら、わ）** 构成二维坐标系：\n- **あ段 (元音根基)**：五大标准元音，口型从大到小，发音清脆短促不拖音；\n- **清音与浊音规律**：か/さ/た/は 行加上两点浊音点 (゛) 演化为 が/ざ/だ/ば 行；は 行加半浊音圆圈 (゜) 演化为 ぱ 行。\n\n---\n\n### 二、 核心易混假名形近对决指南\n\n- **ね vs れ vs わ (三姐妹核心鉴别)**：\n  - **ね (ne)**：右侧有“猫尾卷圆环”收尾；\n  - **れ (re)**：右侧向外舒展“扬帆起翘/踢腿”；\n  - **わ (wa)**：右侧为大弧度内扣圆，绝无圆环圈。\n- **あ vs お (十字与断笔)**：\n  - **あ (a)**：第一笔横，第二笔斜竖，第三笔从内绕大圈；\n  - **お (o)**：右上方有一点，第一笔横，第二笔垂直下折后带小圆圈。\n- **さ vs き (横线与连笔)**：\n  - **さ (sa)**：仅有一道横；\n  - **き (ki)**：有两道平行横。`
    },
    categories: [
      { id: 'CAT_JA_A_KA', name: 'あ行·か行 核心母音与舌根音', group: '一、基础发音矩阵' },
      { id: 'CAT_JA_SA_TA', name: 'さ行·た行 齿擦音与舌尖音', group: '一、基础发音矩阵' },
      { id: 'CAT_JA_NA_HA', name: 'な行·は行 鼻音与喉壁摩擦音', group: '一、基础发音矩阵' },
      { id: 'CAT_JA_CONFUSED', name: '⭐ 高频易混假名形近对决', group: '二、高频混淆与形近专攻' }
    ],
    layers: [
      { level: 1, name: 'Layer 1: 基础发音与标准平假名' },
      { level: 2, name: 'Layer 2: 罗马音映射与词汇实例' },
      { level: 3, name: 'Layer 3: 形近辨析与易错混淆' }
    ],
    entities: [
      // あ行·か行 (5条)
      { id: 'ja_a', categoryId: 'CAT_JA_A_KA', layer: 1, title: 'あ', subtitle: '/a/ · 罗马音 a (朝 asa)', lang: 'ja-JP', phonetics: { ipa: '/a/', romaji: 'a', tts_clean: 'あ' }, prompt: '识别假名发音与特征：', answer: '读作 a，口型自然张开，如“朝 (asa)”', confusedWith: 'ja_o', explanation: 'あ行元音之首，第一笔横，第三笔绕大圈。' },
      { id: 'ja_i', categoryId: 'CAT_JA_A_KA', layer: 1, title: 'い', subtitle: '/i/ · 罗马音 i (犬 inu)', lang: 'ja-JP', phonetics: { ipa: '/i/', romaji: 'i', tts_clean: 'い' }, prompt: '识别假名发音与特征：', answer: '读作 i，嘴角向两侧微咧，如“犬 (inu)”', explanation: '两笔写成，左长带微勾，右短呼应。' },
      { id: 'ja_u', categoryId: 'CAT_JA_A_KA', layer: 1, title: 'う', subtitle: '/ɯ/ · 罗马音 u (海 umi)', lang: 'ja-JP', phonetics: { ipa: '/ɯ/', romaji: 'u', tts_clean: 'う' }, prompt: '识别假名发音与特征：', answer: '读作 u，双唇扁平不向前突出，如“海 (umi)”', explanation: '日语 u 为扁唇元音，不同于汉语拼音 u。' },
      { id: 'ja_e', categoryId: 'CAT_JA_A_KA', layer: 1, title: 'え', subtitle: '/e/ · 罗马音 e (駅 eki)', lang: 'ja-JP', phonetics: { ipa: '/e/', romaji: 'e', tts_clean: 'え' }, prompt: '识别假名发音与特征：', answer: '读作 e，介于汉语“哎”与“诶”之间，如“駅 (eki)”', explanation: '第一笔短点点，第二笔折线滑行。' },
      { id: 'ja_o', categoryId: 'CAT_JA_A_KA', layer: 1, title: 'お', subtitle: '/o/ · 罗马音 o (音 oto)', lang: 'ja-JP', phonetics: { ipa: '/o/', romaji: 'o', tts_clean: 'お' }, prompt: '识别假名发音与特征：', answer: '读作 o，口型呈圆形收拢，如“音 (oto)”', confusedWith: 'ja_a', explanation: '右上带独立的一点，切勿漏点。' },

      // さ行·た行 (5条)
      { id: 'ja_sa', categoryId: 'CAT_JA_SA_TA', layer: 2, title: 'さ', subtitle: '/sa/ · 罗马音 sa (桜 sakura)', lang: 'ja-JP', phonetics: { ipa: '/sa/', romaji: 'sa', tts_clean: 'さ' }, prompt: '识别假名发音与特征：', answer: '读作 sa，清齿龈擦音，仅一道横', confusedWith: 'ja_ki', explanation: 'さ 只有一道横，与 き(ki) 的两道横形成鲜明对比。' },
      { id: 'ja_shi', categoryId: 'CAT_JA_SA_TA', layer: 2, title: 'し', subtitle: '/ɕi/ · 罗马音 shi (白 shiro)', lang: 'ja-JP', phonetics: { ipa: '/ɕi/', romaji: 'shi', tts_clean: 'し' }, prompt: '识别假名发音与特征：', answer: '读作 shi，像小鱼钩一样一笔向上捞起', explanation: '舌面前部贴近硬腭发擦音。' },
      { id: 'ja_su', categoryId: 'CAT_JA_SA_TA', layer: 2, title: 'す', subtitle: '/sɯ/ · 罗马音 su (寿司 sushi)', lang: 'ja-JP', phonetics: { ipa: '/sɯ/', romaji: 'su', tts_clean: 'す' }, prompt: '识别假名发音与特征：', answer: '读作 su，第一笔横，第二笔中间带环下垂', explanation: '常用助动词“です (desu)”的结尾发音。' },
      { id: 'ja_ta', categoryId: 'CAT_JA_SA_TA', layer: 2, title: 'た', subtitle: '/ta/ · 罗马音 ta (旅 tabi)', lang: 'ja-JP', phonetics: { ipa: '/ta/', romaji: 'ta', tts_clean: 'た' }, prompt: '识别假名发音与特征：', answer: '读作 ta，字形神似汉字“太”', explanation: '左侧短十字，右侧似“こ”。' },
      { id: 'ja_chi', categoryId: 'CAT_JA_SA_TA', layer: 2, title: 'ち', subtitle: '/tɕi/ · 罗马音 chi (父 chichi)', lang: 'ja-JP', phonetics: { ipa: '/tɕi/', romaji: 'chi', tts_clean: 'ち' }, prompt: '识别假名发音与特征：', answer: '读作 chi，数字“5”的反向变体', explanation: 'た行第二位，发清龈腭塞擦音。' },

      // な行·は行 (5条)
      { id: 'ja_na', categoryId: 'CAT_JA_NA_HA', layer: 1, title: 'な', subtitle: '/na/ · 罗马音 na (夏 natsu)', lang: 'ja-JP', phonetics: { ipa: '/na/', romaji: 'na', tts_clean: 'な' }, prompt: '识别假名发音与特征：', answer: '读作 na，右上有一点，右下有一圆圈', explanation: '来自汉字“奈”的草书演变。' },
      { id: 'ja_ni', categoryId: 'CAT_JA_NA_HA', layer: 1, title: 'に', subtitle: '/ni/ · 罗马音 ni (肉 niku)', lang: 'ja-JP', phonetics: { ipa: '/ni/', romaji: 'ni', tts_clean: 'に' }, prompt: '识别假名发音与特征：', answer: '读作 ni，左侧竖勾，右侧为“こ”', explanation: '来自汉字“仁”的草书。' },
      { id: 'ja_nu', categoryId: 'CAT_JA_NA_HA', layer: 2, title: 'ぬ', subtitle: '/nɯ/ · 罗马音 nu (布 nuno)', lang: 'ja-JP', phonetics: { ipa: '/nɯ/', romaji: 'nu', tts_clean: 'ぬ' }, prompt: '识别假名发音与特征：', answer: '读作 nu，左单弧交叉，右末尾打圆结', confusedWith: 'ja_me', explanation: '末端有小尾巴圆圈，无圆圈者为 め(me)。' },
      { id: 'ja_ne', categoryId: 'CAT_JA_NA_HA', layer: 3, title: 'ね', subtitle: '/ne/ · 罗马音 ne (猫 neko)', lang: 'ja-JP', phonetics: { ipa: '/ne/', romaji: 'ne', tts_clean: 'ね' }, prompt: '识别假名发音与特征：', answer: '读作 ne，右侧卷成圆环内扣（猫尾）', confusedWith: 'ja_re', pitfalls: '右侧向外撇的是 れ(re)，收圈内扣的是 ね(ne)！', explanation: '来自汉字“祢”的草书。' },
      { id: 'ja_ha', categoryId: 'CAT_JA_NA_HA', layer: 1, title: 'は', subtitle: '/ha/ · 罗马音 ha (花 hana)', lang: 'ja-JP', phonetics: { ipa: '/ha/', romaji: 'ha', tts_clean: 'は' }, prompt: '识别假名发音与特征：', answer: '读作 ha (作助词时读作 wa)，左竖右圈', explanation: '作为主题提示助词时读作 wa。' },

      // 高频易混假名深度对决 (6条)
      { id: 'ja_ne_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'ね (ne)', subtitle: '/ne/ · 猫 neko · 圈圈收尾', lang: 'ja-JP', phonetics: { ipa: '/ne/', romaji: 'ne', tts_clean: 'ね' }, prompt: '辨析 ね 的结构特征与读音：', answer: '读作 ne，右侧末端卷起一个小圆圈（猫咪卷尾）', confusedWith: 'ja_re_diff', pitfalls: '与 れ(re) 向外翘勾和 わ(wa) 圆弧大肚区分！', explanation: '易混三姐妹之首：ね 必带卷圈。' },
      { id: 'ja_re_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'れ (re)', subtitle: '/re/ · 礼 rei · 向外踢腿', lang: 'ja-JP', phonetics: { ipa: '/re/', romaji: 're', tts_clean: 'れ' }, prompt: '辨析 れ 的结构特征与读音：', answer: '读作 re，右侧末端向外踢腿挑勾，绝不打卷', confusedWith: 'ja_ne_diff', pitfalls: '看清尾端是向外挑勾，非圆圈！', explanation: '易混三姐妹之二：れ 向外踢起。' },
      { id: 'ja_wa_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'わ (wa)', subtitle: '/wa/ · 和 wa · 圆润大肚', lang: 'ja-JP', phonetics: { ipa: '/wa/', romaji: 'wa', tts_clean: 'わ' }, prompt: '辨析 わ 的结构特征与读音：', answer: '读作 wa，右侧为顺滑内收的大圆弧，无圈无翘勾', confusedWith: 'ja_ne_diff', explanation: '易混三姐妹之三：わ 大腹便便内收。' },
      { id: 'ja_o_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'お (o)', subtitle: '/o/ · 男 otoko · 右上有点', lang: 'ja-JP', phonetics: { ipa: '/o/', romaji: 'o', tts_clean: 'お' }, prompt: '辨析 お 与 あ 的根本区别：', answer: '读作 o，第二笔直接折向左下并打圈，右上有一孤立点', confusedWith: 'ja_a', pitfalls: 'あ 无右上点且有独立斜十字；お 必带右上点！', explanation: '字形源自“於”的草书。' },
      { id: 'ja_ki_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'き (ki)', subtitle: '/ki/ · 木 ki · 双横交叉', lang: 'ja-JP', phonetics: { ipa: '/ki/', romaji: 'ki', tts_clean: 'き' }, prompt: '辨析 き 与 さ 的根本区别：', answer: '读作 ki，上方有两道平行横线，斜竖穿过带底弧', confusedWith: 'ja_sa', pitfalls: 'さ 只有一道横；き 拥有两道横！', explanation: '字形源自“幾”的草书。' },
      { id: 'ja_ru_diff', categoryId: 'CAT_JA_CONFUSED', layer: 3, title: 'る (ru)', subtitle: '/rɯ/ · 留 ru · 末端打圈', lang: 'ja-JP', phonetics: { ipa: '/rɯ/', romaji: 'ru', tts_clean: 'る' }, prompt: '辨析 る 与 ろ 的根本区别：', answer: '读作 ru，字形神似数字“3”，但末尾内折卷成一个小圈', confusedWith: 'ja_ro_diff', pitfalls: 'ろ(ro) 尾部畅通无阻，る(ru) 尾部卷起圆圈！', explanation: 'る(打圈) vs ろ(开门)。' }
    ]
  }
];
