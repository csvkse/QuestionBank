/**
 * Markdown AST Parser & Serializer for 3D Knowledge Hierarchy
 * Core: shared/markdown-ast.js
 * Structure: Deck -> Group -> Category -> Layer -> Entity
 */

/**
 * 将结构化题库对象序列化为符合 3D 体系的规范 Markdown 文本
 * @param {Object} deck - 题库对象
 * @returns {string} Markdown 文本
 */
export function serializeDeckToMarkdown(deck) {
  if (!deck) return '';
  let md = `# ${deck.icon || '📚'} ${deck.title || '自定义知识库'}\n`;
  if (deck.description) md += `> ${deck.description}\n\n`;

  // 收集所有业务分组
  const groups = [];
  (deck.categories || []).forEach(cat => {
    const gName = cat.group || '核心知识板块';
    if (!groups.includes(gName)) groups.push(gName);
  });

  groups.forEach(groupName => {
    md += `## [分组] ${groupName}\n\n`;
    const catsInGroup = (deck.categories || []).filter(c => (c.group || '核心知识板块') === groupName);

    catsInGroup.forEach(cat => {
      md += `### [分类] ${cat.name}\n`;
      const catEntities = (deck.entities || []).filter(e => e.categoryId === cat.id);

      [1, 2, 3].forEach(layer => {
        const layerEntities = catEntities.filter(e => e.layer === layer);
        if (layerEntities.length > 0) {
          const layerLabels = { 1: '基础认知', 2: '规律运用', 3: '陷阱与特例' };
          md += `#### [Layer ${layer}] ${layerLabels[layer] || ''}\n`;
          layerEntities.forEach(e => {
            md += `- **${e.title}**: ${e.answer}\n`;
            if (e.subtitle) md += `  - *注记*: ${e.subtitle}\n`;
            if (e.prompt) md += `  - *考点*: ${e.prompt}\n`;
            if (e.explanation) md += `  - *解析*: ${e.explanation}\n`;
            if (e.pitfalls) md += `  - *误区*: ${e.pitfalls}\n`;
            if (e.confusedWith) md += `  - *混淆*: ${e.confusedWith}\n`;
          });
        }
      });
      md += `\n`;
    });
  });

  return md.trim();
}

/**
 * 将 Markdown 文本解析为内部 draftDeck AST 对象
 * @param {string} text - Markdown 字符串
 * @returns {Object} { title, icon, description, categories, entities }
 */
export function parseMarkdownToDeck(text = '') {
  const lines = text.split('\n');

  let deckTitle = '自定义知识库';
  let deckDesc = '';
  let deckIcon = '📝';
  const categories = [];
  const entities = [];

  let currentGroup = '核心知识板块';
  let currentCatId = null;
  let currentLayer = 1;
  let currentEntity = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. H1: 题库标题与图标
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      const fullTitle = trimmed.replace('# ', '').trim();
      const iconMatch = fullTitle.match(/^(\p{Emoji}|\p{Extended_Pictographic})/u);
      if (iconMatch) {
        deckIcon = iconMatch[0];
        deckTitle = fullTitle.replace(deckIcon, '').trim();
      } else {
        deckTitle = fullTitle;
      }
    } 
    // 2. 描述说明
    else if (trimmed.startsWith('> ')) {
      deckDesc = trimmed.replace('> ', '').trim();
    } 
    // 3. H2: 业务分组 或 分类
    else if (trimmed.startsWith('## ') && (trimmed.includes('[分组]') || trimmed.startsWith('## 分组') || trimmed.startsWith('## 业务分组') || trimmed.startsWith('## 一、') || trimmed.startsWith('## 二、') || trimmed.startsWith('## 三、') || trimmed.startsWith('## 四、') || trimmed.startsWith('## 五、') || (!trimmed.includes('[分类]') && !trimmed.startsWith('## [分类]')))) {
      if (trimmed.includes('[分类]')) {
        let catRaw = trimmed.replace(/^##\s*(\[分类\])?\s*/, '').trim();
        let catGroup = currentGroup;
        const inlineGroupMatch = catRaw.match(/[\[\(](?:分组|Group)[:：]\s*([^\]\)]+)[\]\)]/);
        if (inlineGroupMatch) {
          catGroup = inlineGroupMatch[1].trim();
          catRaw = catRaw.replace(inlineGroupMatch[0], '').trim();
        }
        const catId = 'CAT_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        currentCatId = catId;
        categories.push({ id: catId, name: catRaw, group: catGroup });
      } else {
        const grpRaw = trimmed.replace(/^##\s*(\[分组\]|分组:|业务分组:?|\[业务分组\])?\s*/, '').trim();
        if (grpRaw) currentGroup = grpRaw;
      }
    } 
    // 4. H3: 细分类别
    else if (trimmed.startsWith('### ') && (trimmed.includes('[分类]') || !trimmed.toLowerCase().includes('layer'))) {
      let catRaw = trimmed.replace(/^###\s*(\[分类\])?\s*/, '').trim();
      let catGroup = currentGroup;
      const inlineGroupMatch = catRaw.match(/[\[\(](?:分组|Group)[:：]\s*([^\]\)]+)[\]\)]/);
      if (inlineGroupMatch) {
        catGroup = inlineGroupMatch[1].trim();
        catRaw = catRaw.replace(inlineGroupMatch[0], '').trim();
      }
      const catId = 'CAT_' + Math.random().toString(36).substr(2, 6).toUpperCase();
      currentCatId = catId;
      categories.push({ id: catId, name: catRaw, group: catGroup });
    } 
    // 5. H3 / H4: 认知层级
    else if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      const layerMatch = trimmed.match(/Layer\s*(\d+)/i);
      if (layerMatch) currentLayer = parseInt(layerMatch[1]);
    } 
    // 6. 词条条目 (- **title**: answer)
    else if (trimmed.startsWith('- **') || trimmed.startsWith('* **')) {
      const match = trimmed.match(/^[-*]\s+\*\*(.+?)\*\*:\s*(.+)$/);
      if (match) {
        if (!currentCatId) {
          currentCatId = 'CAT_DEFAULT';
          categories.push({ id: currentCatId, name: '通用板块', group: currentGroup });
        }
        const eId = 'E_' + Math.random().toString(36).substr(2, 8);
        currentEntity = {
          id: eId,
          categoryId: currentCatId,
          layer: currentLayer,
          title: match[1].trim(),
          answer: match[2].trim(),
          subtitle: '',
          prompt: '',
          explanation: match[1].trim() + '：' + match[2].trim(),
          pitfalls: '',
          confusedWith: ''
        };
        entities.push(currentEntity);
      }
    } 
    // 7. 词条注解与考点字段
    else if (currentEntity && (trimmed.startsWith('- *') || trimmed.startsWith('* *') || trimmed.startsWith('  - *') || trimmed.startsWith('    - *'))) {
      if (trimmed.includes('*注记*:')) {
        currentEntity.subtitle = trimmed.split('*注记*:')[1].trim();
      } else if (trimmed.includes('*考点*:')) {
        currentEntity.prompt = trimmed.split('*考点*:')[1].trim();
      } else if (trimmed.includes('*解析*:')) {
        currentEntity.explanation = trimmed.split('*解析*:')[1].trim();
      } else if (trimmed.includes('*误区*:')) {
        currentEntity.pitfalls = trimmed.split('*误区*:')[1].trim();
      } else if (trimmed.includes('*混淆*:')) {
        currentEntity.confusedWith = trimmed.split('*混淆*:')[1].trim();
      }
    }
  });

  return {
    title: deckTitle || '自定义题库',
    icon: deckIcon || '📝',
    description: deckDesc || '',
    categories: categories.length > 0 ? categories : [{ id: 'CAT_DEF', name: '常规分类', group: '核心知识板块' }],
    entities: entities
  };
}
