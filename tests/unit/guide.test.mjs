import { renderGuideMarkdown, GuideRenderer } from '../../features/study-hub/guide-renderer.js';
import { DeckToolExecutor } from '../../features/ai-agent/tool-executor.js';
import { ToolPermissionError, ToolFormatError } from '../../features/ai-agent/tool-errors.js';

console.log('🧪 Testing guide-renderer.js & deck guide tools...');

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

// 1. 测试 Markdown 渲染引擎 (先行组织者 / 体系化知识导读)
{
  const md = `
### 一、核心架构
> 这是核心模型说明

| 概念 | 说明 | 适用阶段 |
| :--- | :--- | :--- |
| Focus | 精读模式 | 初学 |
| Guide | 导读模式 | 宏观宏图 |

- 特性 A
- 特性 B

\`\`\`javascript
const x = 1;
\`\`\`
  `.trim();

  const html = renderGuideMarkdown(md);
  assert(html.includes('一、核心架构'), 'Should render H3 heading');
  assert(html.includes('<blockquote'), 'Should render blockquote');
  assert(html.includes('<table'), 'Should render markdown table');
  assert(html.includes('Focus') && html.includes('Guide'), 'Should render table cells');
  assert(html.includes('<li'), 'Should render list items');
  assert(html.includes('<pre') && html.includes('const x = 1;'), 'Should render code block');
}

// 2. 测试 GuideRenderer 空状态与非空状态渲染
{
  let lastHtml = '';
  const mockContainer = {
    set innerHTML(val) { lastHtml = val; }
  };

  const renderer = new GuideRenderer({});

  // 2.1 空导学状态
  const emptyDeck = { id: 'deck_empty', title: '空白题库', guide: null };
  renderer.render(mockContainer, '<div id="toggle"></div>', emptyDeck, {});
  assert(lastHtml.includes('当前题库暂未配置体系化导读'), 'Empty deck should show unconfigured state');
  assert(lastHtml.includes("app.requestAiDeckGuide('deck_empty')"), 'Empty deck should provide AI generator CTA');

  // 2.2 具备导学状态
  const guidedDeck = {
    id: 'deck_full',
    title: '完整题库',
    guide: {
      summary: '全局先行组织者概要',
      markdown: '### 知识骨架\n- 节点1'
    }
  };
  renderer.render(mockContainer, '<div id="toggle"></div>', guidedDeck, {});
  assert(lastHtml.includes('全局先行组织者概要'), 'Guided deck should show summary advance organizer');
  assert(lastHtml.includes('知识骨架'), 'Guided deck should render markdown body');
}

// 3. 测试 AI Agent 导读工具执行器
{
  const mockApp = {
    decks: [
      { id: 'deck_verbs', title: '英语动词', guide: { summary: '系统预设导读', markdown: '### 预设' } }
    ],
    state: {
      customDecks: [
        { id: 'custom_1', title: '自定义题库', entities: [], categories: [], guide: null }
      ]
    },
    getAllDecks() {
      return [...this.decks, ...this.state.customDecks];
    },
    getDeckState() { return { totalAttempts: 0 }; },
    saveUserData() { this.saved = true; },
    renderAllViews() { this.rendered = true; }
  };

  const executor = new DeckToolExecutor(mockApp);

  // 3.1 获取预设题库导读
  const resGet = await executor.execute('tool_get_deck_guide', { deckId: 'deck_verbs' });
  assert(resGet.hasGuide === true, 'deck_verbs should have guide');
  assert(resGet.guide.summary === '系统预设导读', 'guide summary matches');

  // 3.2 尝试覆盖预设题库导读应当抛出 ToolPermissionError
  let permErrorThrown = false;
  try {
    await executor.execute('tool_update_deck_guide', {
      deckId: 'deck_verbs',
      guide: { summary: '新摘要', markdown: '新内容' }
    });
  } catch (err) {
    permErrorThrown = err instanceof ToolPermissionError;
  }
  assert(permErrorThrown, 'Preset deck guide should be protected from update');

  // 3.3 正常更新自定义题库导读
  const resUpdate = await executor.execute('tool_update_deck_guide', {
    deckId: 'custom_1',
    guide: {
      summary: '自定义题库宏观模型',
      markdown: '### 自定义知识框架\n- 模块一'
    }
  });
  assert(resUpdate.success === true, 'Update custom deck guide should succeed');
  assert(mockApp.state.customDecks[0].guide.summary === '自定义题库宏观模型', 'Custom deck guide saved');
  assert(mockApp.saved === true, 'App data should be saved');

  // 3.4 格式错误抛出 ToolFormatError
  let formatErrorThrown = false;
  try {
    await executor.execute('tool_update_deck_guide', { deckId: 'custom_1' });
  } catch (err) {
    formatErrorThrown = err instanceof ToolFormatError;
  }
  assert(formatErrorThrown, 'Missing guide parameter should throw ToolFormatError');

  // 3.5 携带题库名称（title / deckTitle）或仅传题库名称均能精准寻址
  const deckByTitle = await executor.execute('tool_get_deck', { title: '自定义题库' });
  assert(deckByTitle.id === 'custom_1', 'Should resolve deck by title');

  const deckByNameAsId = await executor.execute('tool_get_deck', { deckId: '自定义题库' });
  assert(deckByNameAsId.id === 'custom_1', 'Should resolve deck when title is passed as deckId');

  const resUpdateWithTitle = await executor.execute('tool_update_deck_guide', {
    deckId: 'custom_1',
    title: '自定义题库',
    guide: {
      summary: '双参携带题库名称更新成功',
      markdown: '### 结构化双参导读'
    }
  });
  assert(resUpdateWithTitle.success === true && resUpdateWithTitle.title === '自定义题库', 'Update guide with title parameter should succeed');

  const resUpdateByNameOnly = await executor.execute('tool_update_deck_guide', {
    title: '自定义题库',
    guide: {
      summary: '仅凭题库名称成功更新导读',
      markdown: '### 纯题库名称导读'
    }
  });
  assert(resUpdateByNameOnly.success === true && resUpdateByNameOnly.deckId === 'custom_1', 'Update guide by title only should succeed');
}

console.log('✅ guide.test.mjs PASSED!');
