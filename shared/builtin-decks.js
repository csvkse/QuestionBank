/**
 * Built-in Preset Knowledge Decks
 * Core: shared/builtin-decks.js
 */

export const BUILTIN_DECKS = [
      // 1. 英语动词形态题库 (完整保留原版全部考点与规则)
      {
        id: 'deck_verbs',
        title: '英语动词形态与变异法则',
        icon: '⚡',
        description: '涵盖 -ic 加 k 黄金特例、-ing/-ed 规则变化、不规则 AAA~ABC 五大阵营、三单特例与词性辨析。',
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
          // -ic 特例
          { id: 'v_picnic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'picnic', subtitle: '/ˈpɪknɪk/ · 野餐', prompt: '转化为过去式 (-ed)：', answer: 'picnicked', confusedWith: 'v_panic', pitfalls: '漏加 k 拼成 picniced 是最高频错误！', explanation: '动词以 ic 结尾，变 -ing / -ed 时先加 k，再加后缀！' },
          { id: 'v_panic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'panic', subtitle: '/ˈpænɪk/ · 惊慌', prompt: '转化为现在分词 (-ing)：', answer: 'panicking', pitfalls: 'panicing 漏加 k 报错！', explanation: 'panic 变 -ing 必须先补 k 变 panicking。' },
          { id: 'v_mimic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'mimic', subtitle: '/ˈmɪmɪk/ · 模仿', prompt: '转化为过去分词 (-ed)：', answer: 'mimicked', explanation: 'mimic 变 -ed 先加 k → mimicked。' },
          { id: 'v_frolic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'frolic', subtitle: '/ˈfrɒlɪk/ · 嬉戏', prompt: '转化为现在分词 (-ing)：', answer: 'frolicking', explanation: 'frolic 变 -ing 先加 k → frolicking。' },
          { id: 'v_traffic', categoryId: 'CAT_IC_SPECIAL', layer: 3, title: 'traffic', subtitle: '/ˈtræfɪk/ · 非法交易', prompt: '转化为过去式 (-ed)：', answer: 'trafficked', explanation: 'traffic 作动词变 -ed 先加 k → trafficked。' },
          
          // -ing 规则
          { id: 'v_work', categoryId: 'CAT_ING_RULES', layer: 1, title: 'work', subtitle: '/wɜːk/ · 工作', prompt: '转化为现在分词 (-ing)：', answer: 'working', explanation: '一般情况直接加 ing。' },
          { id: 'v_write', categoryId: 'CAT_ING_RULES', layer: 2, title: 'write', subtitle: '/raɪt/ · 写作', prompt: '转化为现在分词 (-ing)：', answer: 'writing', pitfalls: '以不发音 e 结尾，必须去掉 e 再加 ing！', explanation: 'write 去 e + ing 变 writing。' },
          { id: 'v_run', categoryId: 'CAT_ING_RULES', layer: 2, title: 'run', subtitle: '/rʌn/ · 奔跑', prompt: '转化为现在分词 (-ing)：', answer: 'running', explanation: '重读闭音节辅元辅，双写 n 再加 ing。' },
          { id: 'v_lie', categoryId: 'CAT_ING_RULES', layer: 3, title: 'lie', subtitle: '/laɪ/ · 躺/说谎', prompt: '转化为现在分词 (-ing)：', answer: 'lying', pitfalls: '直接加 ing 或 lieing 都是经典错误！', explanation: '以 ie 结尾，变 y + ing → lying。' },
          { id: 'v_die', categoryId: 'CAT_ING_RULES', layer: 3, title: 'die', subtitle: '/daɪ/ · 死亡', prompt: '转化为现在分词 (-ing)：', answer: 'dying', explanation: '以 ie 结尾，变 y + ing → dying。' },

          // -ed 规则
          { id: 'v_love', categoryId: 'CAT_ED_RULES', layer: 1, title: 'love', subtitle: '/lʌv/ · 爱', prompt: '转化为过去式 (-ed)：', answer: 'loved', explanation: '以 e 结尾直接加 d。' },
          { id: 'v_stop', categoryId: 'CAT_ED_RULES', layer: 2, title: 'stop', subtitle: '/stɒp/ · 停止', prompt: '转化为过去式 (-ed)：', answer: 'stopped', explanation: '重读闭音节辅元辅，双写 p 再加 ed。' },
          { id: 'v_study', categoryId: 'CAT_ED_RULES', layer: 2, title: 'study', subtitle: '/ˈstʌdi/ · 学习', prompt: '转化为过去式 (-ed)：', answer: 'studied', explanation: '辅音+y 结尾，变 y 为 i 再加 ed。' },

          // 不规则 AAA
          { id: 'v_cost', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'cost', subtitle: '/kɒst/ · 花费', prompt: '转化为过去式：', answer: 'cost', explanation: 'AAA 型：cost → cost → cost 三态同形。' },
          { id: 'v_put', categoryId: 'CAT_IRREG_AAA', layer: 1, title: 'put', subtitle: '/pʊt/ · 放置', prompt: '转化为过去分词：', answer: 'put', explanation: 'AAA 型：put → put → put。' },
          { id: 'v_read', categoryId: 'CAT_IRREG_AAA', layer: 3, title: 'read', subtitle: '/riːd/ · 阅读', prompt: '转化为过去式：', answer: 'read', pitfalls: '拼写完全不变，但过去式发音变为 /red/！', explanation: 'AAA 型拼写同形，但注意读音发生改变。' },

          // 不规则 AAB / ABA
          { id: 'v_beat', categoryId: 'CAT_IRREG_AAB_ABA', layer: 3, title: 'beat', subtitle: '/biːt/ · 击败', prompt: '转化为过去分词：', answer: 'beaten', explanation: 'AAB 型：beat → beat → beaten，仅过去分词加 en。' },
          { id: 'v_come', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'come', subtitle: '/kʌm/ · 来', prompt: '转化为过去分词：', answer: 'come', explanation: 'ABA 型：come → came → come，原形与过去分词同形。' },
          { id: 'v_become', categoryId: 'CAT_IRREG_AAB_ABA', layer: 2, title: 'become', subtitle: '/bɪˈkʌm/ · 成为', prompt: '转化为过去分词：', answer: 'become', explanation: 'ABA 型：become → became → become。' },

          // 不规则 ABB
          { id: 'v_find', categoryId: 'CAT_IRREG_ABB', layer: 2, title: 'find', subtitle: '/faɪnd/ · 发现', prompt: '转化为过去式：', answer: 'found', explanation: 'ABB 型：find → found → found。' },
          { id: 'v_build', categoryId: 'CAT_IRREG_ABB', layer: 2, title: 'build', subtitle: '/bɪld/ · 建造', prompt: '转化为过去分词：', answer: 'built', explanation: 'ABB 型：build → built → built。' },
          { id: 'v_teach', categoryId: 'CAT_IRREG_ABB', layer: 3, title: 'teach', subtitle: '/tiːtʃ/ · 教授', prompt: '转化为过去式：', answer: 'taught', pitfalls: '注意与 think(thought) 区分！', explanation: 'ABB 型：teach → taught → taught。' },
          { id: 'v_think', categoryId: 'CAT_IRREG_ABB', layer: 3, title: 'think', subtitle: '/θɪŋk/ · 思考', prompt: '转化为过去式：', answer: 'thought', explanation: 'ABB 型：think → thought → thought。' },

          // 不规则 ABC
          { id: 'v_go', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'go', subtitle: '/ɡəʊ/ · 去', prompt: '转化为过去分词：', answer: 'gone', explanation: 'ABC 型：go → went → gone。' },
          { id: 'v_see', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'see', subtitle: '/siː/ · 看见', prompt: '转化为过去式：', answer: 'saw', explanation: 'ABC 型：see → saw → seen。' },
          { id: 'v_eat', categoryId: 'CAT_IRREG_ABC', layer: 2, title: 'eat', subtitle: '/iːt/ · 吃', prompt: '转化为过去分词：', answer: 'eaten', explanation: 'ABC 型：eat → ate → eaten。' },
          { id: 'v_break', categoryId: 'CAT_IRREG_ABC', layer: 3, title: 'break', subtitle: '/breɪk/ · 打碎', prompt: '转化为过去分词：', answer: 'broken', explanation: 'ABC 型：break → broke → broken。' },

          // 三单与真不规则
          { id: 'v_be', categoryId: 'CAT_THIRD_SINGULAR', layer: 3, title: 'be', subtitle: '/biː/ · 是', prompt: '转化为第三人称单数 (现在时)：', answer: 'is', explanation: '真不规则三单：be 直接变 is。' },
          { id: 'v_have', categoryId: 'CAT_THIRD_SINGULAR', layer: 3, title: 'have', subtitle: '/hæv/ · 拥有', prompt: '转化为第三人称单数：', answer: 'has', explanation: '真不规则三单：have 直接变 has。' },
          { id: 'v_pass', categoryId: 'CAT_THIRD_SINGULAR', layer: 1, title: 'pass', subtitle: '/pɑːs/ · 通过', prompt: '转化为第三人称单数：', answer: 'passes', explanation: '以 s 结尾加 es → passes。' }
        ]
      },

      // 2. HTTP 网络状态码与协议题库
      {
        id: 'deck_http',
        title: 'HTTP 状态码与网络协议',
        icon: '🌐',
        description: '梳理 2xx 成功、3xx 重定向、4xx 客户端错误与 5xx 服务端错误，专攻 401 vs 403 等高频混淆考点。',
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
          { id: 'http_200', categoryId: 'CAT_2XX', layer: 1, title: '200 OK', subtitle: '成功响应', prompt: '其核心含义与处理机制是？', answer: '请求已成功，响应头与实体主体正常返回', explanation: '标准成功响应。' },
          { id: 'http_204', categoryId: 'CAT_2XX', layer: 2, title: '204 No Content', subtitle: '无内容成功', prompt: '其核心特点是？', answer: '请求成功处理，但响应报文不包含实体主体内容', explanation: '常用于预检 OPTIONS 请求或 DELETE 成功后无需返回数据。' },
          { id: 'http_301', categoryId: 'CAT_3XX', layer: 2, title: '301 Moved Permanently', subtitle: '永久重定向', prompt: '其特征与缓存机制是？', answer: '资源永久迁移至新 URI，搜索引擎会更新索引且浏览器会强缓存', confusedWith: 'http_302', explanation: '永久重定向，后续直接访问 Location 给出的新地址。' },
          { id: 'http_302', categoryId: 'CAT_3XX', layer: 2, title: '302 Found', subtitle: '临时重定向', prompt: '其特征是？', answer: '资源临时移动，客户端本次应重定向但未来仍应访问原 URI', confusedWith: 'http_301', explanation: '临时重定向，搜索引擎保留原 URL。' },
          { id: 'http_304', categoryId: 'CAT_3XX', layer: 2, title: '304 Not Modified', subtitle: '协商缓存命中', prompt: '其核心作用是？', answer: '资源未修改，客户端可直接使用本地缓存，不传输 Body', explanation: '配合 If-None-Match (ETag) 或 If-Modified-Since 使用。' },
          { id: 'http_400', categoryId: 'CAT_4XX', layer: 1, title: '400 Bad Request', subtitle: '请求报文错误', prompt: '常见诱因是？', answer: '请求参数或语法格式错误，服务器无法解析', explanation: '客户端提交了无效的 JSON 或缺损参数。' },
          { id: 'http_401', categoryId: 'CAT_4XX', layer: 3, title: '401 Unauthorized', subtitle: '未认证 (缺少凭据)', prompt: '其核心定义是？', answer: '缺少有效身份凭证 (未携带 Token 或未登录)', confusedWith: 'http_403', pitfalls: '401 是不知道你是谁；403 是知道你是谁但不让你进！', explanation: '未认证状态，响应通常带有 WWW-Authenticate 头。' },
          { id: 'http_403', categoryId: 'CAT_4XX', layer: 3, title: '403 Forbidden', subtitle: '禁止访问 (权限不足)', prompt: '其核心定义是？', answer: '服务器理解请求但拒绝执行，即使提供有效凭据也无权访问', confusedWith: 'http_401', pitfalls: '403 重新输入密码登录依然无权访问，属于鉴权失败。', explanation: '权限不足 (如普通用户尝试访问超管接口)。' },
          { id: 'http_404', categoryId: 'CAT_4XX', layer: 1, title: '404 Not Found', subtitle: '资源未找到', prompt: '其核心定义是？', answer: '服务器无法在请求的 URI 上找到对应资源', explanation: 'URL 不存在或已被彻底删除。' },
          { id: 'http_500', categoryId: 'CAT_5XX', layer: 1, title: '500 Internal Server Error', subtitle: '服务器内部错误', prompt: '其核心定义是？', answer: '服务器在处理请求时发生未捕获的内部程序异常', explanation: '服务端代码崩溃抛出未处理的 Exception。' },
          { id: 'http_502', categoryId: 'CAT_5XX', layer: 3, title: '502 Bad Gateway', subtitle: '错误网关', prompt: '通常由什么架构原因触发？', answer: '反向代理 (如 Nginx) 从上游服务器收到了无效响应', confusedWith: 'http_504', explanation: '上游服务挂掉或端口未监听。' },
          { id: 'http_504', categoryId: 'CAT_5XX', layer: 3, title: '504 Gateway Timeout', subtitle: '网关超时', prompt: '其与 502 的根本区别是？', answer: '代理服务器等待上游服务响应超时，上游处理太慢未及时返回', confusedWith: 'http_502', explanation: '上游执行超时导致超时中断。' }
        ]
      },

      // 3. Python 核心概念与避坑指南
      {
        id: 'deck_python',
        title: 'Python 核心数据类型与内存模型',
        icon: '🐍',
        description: '透彻理解不可变对象与可变对象、引用计数、浅拷贝与深拷贝、默认参数跨调用共享等经典陷阱。',
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
          { id: 'py_list', categoryId: 'CAT_MUTABLE', layer: 1, title: '列表 (list)', subtitle: '动态连续数组', prompt: '其核心特征是？', answer: '可变序列，支持原地追加修改，时间复杂度 append 为 O(1)', explanation: '底层为可动态扩容的指针数组。' },
          { id: 'py_dict', categoryId: 'CAT_MUTABLE', layer: 1, title: '字典 (dict)', subtitle: '哈希映射表', prompt: '其对键 (Key) 的要求是？', answer: '键必须是可哈希 (Hashable) 的不可变对象，查询为平均 O(1)', explanation: '基于紧凑哈希表实现。' },
          { id: 'py_tuple', categoryId: 'CAT_IMMUTABLE', layer: 1, title: '元组 (tuple)', subtitle: '不可变序列', prompt: '其核心特征是？', answer: '一旦创建不可修改长度与指向，可作为字典键或集合元素', explanation: '内存开销小，元素只读。' },
          { id: 'py_str', categoryId: 'CAT_IMMUTABLE', layer: 1, title: '字符串 (str)', subtitle: '字符序列', prompt: '对其拼接修改会发生什么？', answer: '属于不可变对象，任何拼接或 replace 均会分配新内存', explanation: '大量拼接推荐使用 "".join(list) 提高效率。' },
          { id: 'py_def_arg', categoryId: 'CAT_PITFALLS', layer: 3, title: 'def f(x=[]): 默认参数陷阱', subtitle: '跨函数调用共享', prompt: '该代码的潜在问题是？', answer: '默认参数在函数定义时完成求值，所有调用共享同一个列表对象', pitfalls: '多次调用该函数，x 会不断累积此前调用的值！推荐使用 def f(x=None)。', explanation: 'Python 函数属于一级对象，默认参数保存在 __defaults__ 元组中。' },
          { id: 'py_copy', categoryId: 'CAT_PITFALLS', layer: 3, title: 'copy.copy() 浅拷贝', subtitle: '与 deepcopy 的差异', prompt: '其内存复制行为是？', answer: '仅复制父对象外壳，其内部嵌套的子对象依然共享相同引用', explanation: '修改子对象会相互影响；彻底隔离需用 copy.deepcopy()。' },
          { id: 'py_is_eq', categoryId: 'CAT_PITFALLS', layer: 2, title: 'is 与 == 的本质区别', subtitle: '同一性 vs 等价性', prompt: '其核心判决依据是？', answer: 'is 比较两个变量的内存地址 id()，== 比较对象的内容值', explanation: '判空必须使用 if x is None。' }
        ]
      }
    ];
