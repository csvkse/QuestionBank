# 自由沙盒试炼全模式支持与大组层级分类架构规约 (Sandbox Universal Modes & Group Taxonomy Spec)

> **文档标识**：`26_SANDBOX_UNIVERSAL_MODES_AND_GROUP_TAXONOMY_SPEC.md`  
> **所属版本**：v2.4+ (通用知识图谱游戏化记忆引擎)  
> **关联模块**：`features/arena/sandbox-config.js`、`app/app-shell.html`、`tests/unit/arena-modes.test.mjs`

---

## 一、背景与用户诉求

在知识图谱竞技场系统演进中，针对自由沙盒定制试炼（Free Lab），用户提出了以下核心诉求与决策指引：

1. **自由沙盒试炼能否支持所有模式？**  
   要求沙盒不局限于单一随机练习，而是全面接入核心 4 大规则模式：**默认自测 (DEFAULT)**、**弱点攻坚 (WEAKNESS)**、**分层递进 (STEPPED)**、**极速生存 (SPEED_SPRINT)**。
2. **分类呈现能否参考「知识精读」(Study Hub) 分类方案？**  
   此前沙盒分类列表为平铺式展示，难以体现知识库的顶层模块划分。需参考「知识精读」的三维架构，按**业务大组 (Group)** 对细分类别进行卡片化聚合展示，并提供大组级快捷操作。
3. **认知层级是否应放到细分类别上层？**  
   经过交互心智与认知负荷推演，用户明确决策指示：**「都不调整，保持现有方案」**。即保持既有层级排布顺序（第一维度细分类别在上，第二维度认知层级在下），不逆转既有认知习惯。

---

## 二、架构设计与本体映射

### 1. 三维本体体系在沙盒维度的映射关系

系统严格遵循 `08_GROUP_CATEGORY_LAYER_HIERARCHY_SPEC.md` 确立的三维本体架构（Group × Category × Layer），在沙盒定制配置弹窗中映射为清晰的视觉与逻辑流：

```
┌────────────────────────────────────────────────────────────────────────┐
│               自由沙盒试炼 · 自定义配置模态框 (Surface 4)              │
├────────────────────────────────────────────────────────────────────────┤
│ 维度 1: 选择考察分类章节 (参考知识精读业务大组聚合方案)                 │
│ ┌────────────────────────────────────────────────────────────────────┐ │
│ │ [Group 1: 核心规则板块]                          [全选] | [清空]   │ │
│ │  ☑ Category A (12题)       ☑ Category B (8题)                      │ │
│ ├────────────────────────────────────────────────────────────────────┤ │
│ │ [Group 2: 不规则与特例]                          [全选] | [清空]   │ │
│ │  ☑ Category C (15题)       ☐ Category D (6题)                      │ │
│ └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│ 维度 2: 认知难度分层 (保持既有位置，位于细分类别下方)                    │
│  ☑ Layer 1 基础概念      ☑ Layer 2 综合运用      ☑ Layer 3 边界特例    │
├────────────────────────────────────────────────────────────────────────┤
│ 维度 3: 试炼规则模式 (全新支持 4 大核心规则引擎)                         │
│  [🔘 默认自测]      [⚪ 弱点攻坚]      [⚪ 分层递进]      [⚪ 极速生存]   │
│  自由无压力复习    错题/薄弱项优先    由浅入深阶梯推进    6秒限时·3点生命│
├────────────────────────────────────────────────────────────────────────┤
│ 维度 4: 出题题目数量                                                  │
│  [5 题]             [10 题 (默认)]      [15 题]            [全部题目]    │
├────────────────────────────────────────────────────────────────────────┤
│ 维度 5: 随机乱序开关                                                  │
│  ☑ 随机乱序出题 (Shuffle Order) - 分层模式下自动互斥置为顺序递进       │
├────────────────────────────────────────────────────────────────────────┤
│ [已匹配 41 道词条 · 将抽取 10 题]                  [取消] [开启沙盒实战]│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 三、4 大规则引擎特性与分派矩阵

自由沙盒突破了传统“仅随机出题”的局限，让学习者可以在**自定义题池范围**（任意指定的知识板块组合与认知层级）内，运行系统所有的核心玩法引擎：

| 模式标识 | 模式名称 | 核心题列算法 (`buildQueue`) | 对应会话模式 (`startSession`) | 游戏化战斗机制与规则 |
| :--- | :--- | :--- | :--- | :--- |
| `DEFAULT` | **默认自测** | 匹配条目池 + 随机打乱（若启用乱序） | `FREE_LAB` | • 无倒计时压力<br>• 无生命值损耗<br>• 适合新概念探索或自由巩固 |
| `WEAKNESS` | **弱点攻坚** | 按 `wrong` 降序 + `level` 升序排布 | `WEAKNESS` | • 优先呈现历史上做错次数最多、艾宾浩斯掌握度最低的词条<br>• 精准消灭薄弱概念 |
| `STEPPED` | **分层递进** | 自动取消乱序，按 `layer` 升序递进 (1 ➔ 2 ➔ 3) | `CAMPAIGN` | • 遵循布鲁姆认知阶梯<br>• 基础定义先夯实，再进阶综合运用，最后攻克特殊变体 |
| `SPEED_SPRINT` | **极速生存** | 匹配条目池 + 随机打乱 | `SPEED_SPRINT` | • **6 秒极速倒计时**高压答题<br>• **3 点初始生命值 (Hearts)**<br>• 答错或超时扣除 1 心，生命耗尽即结算 |

---

## 四、核心实现与关键代码规范

### 1. 控制器重构 (`features/arena/sandbox-config.js`)

#### (1) 业务大组聚合与全选/清空
```javascript
// 提取业务大组 (参考知识精读 Study Hub 分类方案)
const groups = [];
(deck.categories || []).forEach(c => {
  const gName = c.group || '核心知识板块';
  if (!groups.includes(gName)) groups.push(gName);
});

// 大组级批量勾选/清空方法
selectGroupCategories(groupName, select) {
  const deck = this.app.getActiveDeck();
  if (!deck) return;

  const groupCats = (deck.categories || []).filter(c => (c.group || '核心知识板块') === groupName);
  groupCats.forEach(c => {
    if (select) this.selectedCategories.add(c.id);
    else this.selectedCategories.delete(c.id);
  });

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    groupCats.forEach(c => {
      const cbs = document.querySelectorAll(`#sandbox-categories-list input[data-cat-id="${c.id}"]`);
      cbs.forEach(cb => { cb.checked = select; });
    });
  }
  this.updateMatchingCount();
}
```

#### (2) 4 大模式排队算法与互斥逻辑
```javascript
setTrialMode(mode) {
  this.trialMode = mode;
  this.updateModeStyles();
  // 分层递进模式自动互斥关闭随机乱序，确保层级递进生效
  if (mode === 'STEPPED') {
    this.isShuffle = false;
    if (typeof document !== 'undefined') {
      const shuffleEl = document.getElementById('sandbox-shuffle-toggle');
      if (shuffleEl) shuffleEl.checked = false;
    }
  }
}

buildQueue(matched) {
  const deck = this.app.getActiveDeck();
  const ds = this.app.getDeckState(deck ? deck.id : '');
  let queue = [...matched];

  if (this.trialMode === 'WEAKNESS') {
    // 弱点模式：错题降序 -> 掌握度升序
    queue.sort((a, b) => {
      const cardA = ds.cards[a.id] || { level: 0, wrong: 0 };
      const cardB = ds.cards[b.id] || { level: 0, wrong: 0 };
      if (cardB.wrong !== cardA.wrong) return cardB.wrong - cardA.wrong;
      return cardA.level - cardB.level;
    });
  } else if (this.trialMode === 'STEPPED') {
    // 分层递进：层级升序 (Layer 1 -> 2 -> 3)
    queue.sort((a, b) => (a.layer || 1) - (b.layer || 1));
  } else if (this.isShuffle) {
    queue.sort(() => Math.random() - 0.5);
  }

  const count = this.questionCount === 9999 ? queue.length : Math.min(this.questionCount, queue.length);
  return queue.slice(0, count);
}
```

#### (3) 会话模式分派
```javascript
startCustomQuiz() {
  const matched = this.getMatchedEntities();
  if (matched.length === 0) {
    alert('请至少选择一个分类和一个认知层级以匹配题目。');
    return;
  }

  const queue = this.buildQueue(matched);
  const sessionMode = this.trialMode === 'SPEED_SPRINT' ? 'SPEED_SPRINT'
    : this.trialMode === 'WEAKNESS' ? 'WEAKNESS'
    : this.trialMode === 'STEPPED' ? 'CAMPAIGN'
    : 'FREE_LAB';

  this.closeModal();
  this.app.startSession(sessionMode, queue);
}
```

---

## 五、无头测试兼容与质量门禁验证

### 1. Node.js 无头环境 DOM 防御
在单元测试（如 `tests/unit/arena-modes.test.mjs`）中，`document` 可能为 undefined 或 mock 对象缺少完整的 `querySelectorAll` 实现。`SandboxConfigController` 中所有涉及 DOM 操作的函数均加入环境防御：
```javascript
if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
  // DOM 变更逻辑
}
```

### 2. 自动化单元测试验证 (`tests/unit/arena-modes.test.mjs`)
对沙盒新增的大组过滤、大类/小类快速预选打开与 4 大模式排队算法进行 100% 单元测试断言覆盖：
- ✅ 测试业务大组勾选与批量清除 (`selectGroupCategories`)
- ✅ 测试大类快速打开沙盒并精准预选对应大类全部考点 (`openModalForGroup`)
- ✅ 测试小类快速打开沙盒并精准预选该小类独立考点 (`openModalForCategory`)
- ✅ 测试 STEPPED 分层模式按 `layer` (1 ➔ 2 ➔ 3) 升序出题
- ✅ 测试 WEAKNESS 弱点模式按 `wrong` 降序优先出题
- ✅ 测试 SPEED_SPRINT 模式分派 `SPEED_SPRINT` 会话引擎
- ✅ 测试 DEFAULT 模式分派 `FREE_LAB` 会话引擎

### 3. 全局质量门禁验证 (`gates/run-gates.mjs`)
- ✅ `FE-QUALITY-001`：`sandbox-config.js` 控制在 287 行，严格满足 `<= 300` 行限额。
- ✅ `FE-ICON-002`：全界面采用纯单色矢量 SVG，无任何彩色 Emoji 伪图标。
- ✅ `FE-BIND-001`：全域 103 个事件绑定契约 100% 验证可调用。
- ✅ 19 项全量架构门禁与 9 项单元测试套件全部通过 (0 Failures)。

---

## 六、全景看板大小类型快速直达沙盒机制 (Panorama Quick Entry)

在「各分类板块熟练度全景」中，为学习者提供了基于实际掌握率即时开启针对性沙盒试炼的快捷闭环：

### 1. 交互与视觉设计
1. **大类型 (Group) Header 快速按键**：
   - 位于大类标题栏右侧数据条旁，展示矢量烧瓶图标与 `[沙盒]` 按钮。
   - 使用 `event.stopPropagation()` 阻止事件向上冒泡，避免触发大类折叠/展开。
   - 触发 `app.openSandboxForGroup('${groupName}')`。
2. **小类型 (Category) 细分行快速按键**：
   - 位于小类掌握度条右侧，展示矢量烧瓶图标与 `[沙盒]` 按钮。
   - 触发 `app.openSandboxForCategory('${cat.id}')`。

### 2. 状态流转与预选机制
```
用户点击大类[沙盒] ──> app.openSandboxForGroup(groupName)
                          │
                          ▼
                 sandboxConfig.openModalForGroup(groupName)
                          │
                          ├─ 1. 过滤当前大类名下所有小类 ID 集合
                          ├─ 2. 选中集合更新至 this.selectedCategories (其余小类自动取消)
                          ├─ 3. 重置层级为 [1, 2, 3]、模式为 'DEFAULT'
                          ├─ 4. 计算当前大类匹配题量并校准 questionCount
                          └─ 5. 渲染模态框并移除 hidden，弹窗即时展现

用户点击小类[沙盒] ──> app.openSandboxForCategory(categoryId)
                          │
                          ▼
                 sandboxConfig.openModalForCategory(categoryId)
                          │
                          ├─ 1. 仅将该 categoryId 放入 this.selectedCategories (其余全部取消)
                          ├─ 2. 重置层级为 [1, 2, 3]、模式为 'DEFAULT'
                          ├─ 3. 计算该小类匹配题量并校准 questionCount
                          └─ 4. 渲染模态框并移除 hidden，弹窗即时展现
```

学习者呼出弹窗后，对应板块已被精准勾选，可直接点击「开启沙盒实战」立即练习，亦可自由切换弱点/分层/极速等规则引擎进行针对性攻坚。

