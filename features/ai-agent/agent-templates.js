/**
 * AI Agent View Templates, Safe Markdown Formatter & Actions
 * Core 2.1: features/ai-agent/agent-templates.js
 */

export function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

/**
 * 助手消息空内容态加载中动效模板
 */
export function renderLoadingState() {
  return `
    <div class="flex items-center gap-2 py-0.5 text-slate-400 select-none">
      <span class="inline-flex gap-1 items-center">
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 0ms"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 150ms"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style="animation-delay: 300ms"></span>
      </span>
      <span class="text-xs text-slate-400 font-medium">加载中...</span>
    </div>
  `;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-200 font-bold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-850 text-indigo-300 font-mono text-[10px] border border-slate-750">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:underline">$1</a>');
}

/**
 * 零依赖轻量安全流式 Markdown 块级格式化引擎 (语义化块隔离 + 排版节奏规范)
 */
export function renderMarkdown(rawText) {
  if (!rawText || !rawText.trim()) return '';

  // 1. 保护代码块
  const codeBlocks = [];
  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const language = lang.trim() || 'code';
    const encoded = encodeURIComponent(code.trim());
    codeBlocks.push(`
      <div class="rounded-lg bg-slate-950 border border-slate-800 my-2 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-1 bg-slate-900/90 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
          <span>${escapeHtml(language)}</span>
          <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encoded}'))" class="hover:text-white transition">复制</button>
        </div>
        <pre class="p-3 text-[11px] font-mono overflow-x-auto text-emerald-300"><code>${escapeHtml(code.trim())}</code></pre>
      </div>
    `);
    return `__CODE_BLOCK_${idx}__`;
  });

  const lines = text.split('\n');
  const blocks = [];
  let currentList = null; // { type: 'ul'|'ol', items: [] }
  let currentPara = [];
  let currentQuote = [];
  let currentTable = [];

  const flushPara = () => {
    if (currentPara.length) {
      blocks.push(`<p class="leading-relaxed">${currentPara.map(l => inlineFormat(escapeHtml(l))).join('<br>')}</p>`);
      currentPara = [];
    }
  };
  const flushList = () => {
    if (currentList) {
      const isUl = currentList.type === 'ul';
      const lis = currentList.items.map((it, idx) => `
        <li class="flex items-start gap-1.5 text-slate-300">
          <span class="${isUl ? 'text-indigo-400 select-none' : 'text-indigo-400 font-mono text-[10px] select-none'} leading-relaxed">${isUl ? '•' : (idx + 1) + '.'}</span>
          <span class="leading-relaxed">${inlineFormat(escapeHtml(it))}</span>
        </li>
      `).join('');
      blocks.push(isUl ? `<ul class="space-y-1.5 pl-0.5 my-1.5">${lis}</ul>` : `<ol class="space-y-1.5 pl-0.5 my-1.5">${lis}</ol>`);
      currentList = null;
    }
  };
  const flushQuote = () => {
    if (currentQuote.length) {
      blocks.push(`<blockquote class="pl-3 border-l-2 border-indigo-500 text-slate-400 my-1.5 italic text-[11px] leading-relaxed">${currentQuote.map(l => inlineFormat(escapeHtml(l))).join('<br>')}</blockquote>`);
      currentQuote = [];
    }
  };
  const flushTable = () => {
    if (currentTable.length) {
      const headerCells = currentTable[0].split('|').filter(c => c.trim().length > 0).map(c => `<th class="p-1.5 border border-slate-800 text-left font-bold">${inlineFormat(escapeHtml(c.trim()))}</th>`).join('');
      const bodyHtml = currentTable.slice(1).map(r => `<tr>${r.split('|').filter(c => c.trim().length > 0).map(c => `<td class="p-1.5 border border-slate-800">${inlineFormat(escapeHtml(c.trim()))}</td>`).join('')}</tr>`).join('');
      blocks.push(`<div class="overflow-x-auto my-2"><table class="w-full text-[11px] border-collapse border border-slate-800"><thead class="bg-slate-900 text-slate-300"><tr>${headerCells}</tr></thead><tbody class="divide-y divide-slate-800 text-slate-300">${bodyHtml}</tbody></table></div>`);
      currentTable = [];
    }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushAll();
      continue;
    }

    if (/^__CODE_BLOCK_\d+__$/.test(trimmed)) {
      flushAll();
      const idx = parseInt(trimmed.match(/\d+/)[0], 10);
      blocks.push(codeBlocks[idx]);
      continue;
    }

    const headMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (headMatch) {
      flushAll();
      const lvl = headMatch[1].length;
      const hClass = lvl === 1 ? 'text-sm font-bold text-white mt-3 mb-1.5 pb-1 border-b border-slate-800' : (lvl === 2 ? 'text-xs font-bold text-indigo-300 mt-2.5 mb-1' : 'text-xs font-bold text-slate-200 mt-2 mb-1');
      blocks.push(`<h${lvl + 2} class="${hClass}">${inlineFormat(escapeHtml(headMatch[2]))}</h${lvl + 2}>`);
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) continue;
      flushPara(); flushList(); flushQuote();
      currentTable.push(trimmed);
      continue;
    }

    const ulMatch = trimmed.match(/^[\-\*]\s+(.*)/);
    if (ulMatch) {
      flushPara(); flushQuote(); flushTable();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(ulMatch[1]);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      flushPara(); flushQuote(); flushTable();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(olMatch[1]);
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s*(.*)/);
    if (quoteMatch) {
      flushPara(); flushList(); flushTable();
      currentQuote.push(quoteMatch[1]);
      continue;
    }

    flushList(); flushQuote(); flushTable();
    currentPara.push(rawLine);
  }

  flushAll();
  return blocks.join('');
}

/**
 * 渲染用户消息 (带悬停操作栏 Req 5, 移除彩色 Emoji Req 6)
 */
export function renderUserMessage(msg) {
  const safeContent = escapeHtml(msg.content);
  return `
    <div class="flex gap-3 max-w-4xl mx-auto justify-end group">
      <div class="relative max-w-2xl flex flex-col items-end">
        <div class="p-3.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed text-slate-100 bg-[#1e1b4b] border border-indigo-500/30 shadow-md whitespace-pre-wrap break-words">
          ${safeContent}
        </div>
        <!-- 消息下方操作栏 -->
        <div class="mt-1 flex items-center gap-1.5 opacity-70 hover:opacity-100 transition text-[11px] text-slate-400">
          <button onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(msg.content)}'))" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-slate-200 transition flex items-center gap-1" title="复制提示词">
            <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
            <span>复制</span>
          </button>
          <button onclick="app.aiAgent.editPrompt('${msg.id}')" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-slate-200 transition flex items-center gap-1" title="编辑重提">
            <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>编辑</span>
          </button>
          <button onclick="app.aiAgent.deleteMessage('${msg.id}')" class="px-2 py-0.5 rounded hover:bg-slate-800 hover:text-rose-400 transition flex items-center gap-1" title="删除">
            <svg class="w-3 h-3 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>删除</span>
          </button>
        </div>
      </div>
      <div class="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-300">
        <svg class="w-4 h-4 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      </div>
    </div>
  `;
}

/**
 * 渲染思考链折叠卡片
 */
export function renderReasoningCard(reasoningText) {
  if (!reasoningText) return '';
  return `
    <details class="p-2.5 rounded-lg mb-3 text-[11px] text-amber-200/90 leading-relaxed bg-slate-900/80 border-l-2 border-amber-500">
      <summary class="font-bold cursor-pointer text-amber-400 flex items-center justify-between list-none">
        <span class="flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          <span>思考与推理链 (已折叠)</span>
        </span>
        <span class="text-[10px] text-amber-400/60">展开 ▼</span>
      </summary>
      <div class="pt-2 text-slate-300 border-t border-amber-500/20 mt-2 font-mono whitespace-pre-wrap">${escapeHtml(reasoningText)}</div>
    </details>
  `;
}

/**
 * 渲染工具卡片 (自动折叠 Req 3，未批准展开，已完成收起)
 */
export function renderToolCard(msgId, tc) {
  if (!tc) return '';
  const isDone = tc.status === 'success';
  const isPending = tc.status === 'pending';
  const isExecuting = tc.status === 'executing';
  const isRejected = tc.status === 'rejected';

  let statusBadge = '';
  if (isDone) {
    statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">已执行并回传</span>';
  } else if (isExecuting) {
    statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-950 text-indigo-400 border border-indigo-800 animate-pulse">执行中...</span>';
  } else if (isRejected) {
    statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-rose-950 text-rose-400 border border-rose-800">已拒绝</span>';
  } else {
    statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-950 text-amber-300 border border-amber-800">待确认</span>';
  }

  let actionsOrResult = '';
  if (isPending) {
    actionsOrResult = `
      <div class="pt-2 flex items-center justify-end gap-2 border-t border-indigo-900/30">
        <button onclick="app.aiAgent.approveToolCall('${msgId}', '${tc.id}')"
          class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition">
          批准执行
        </button>
        <button onclick="app.aiAgent.rejectToolCall('${msgId}')"
          class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] transition">
          拒绝
        </button>
      </div>
    `;
  } else if (isDone) {
    actionsOrResult = `
      <div class="pt-1.5 flex items-center justify-between text-[11px] text-emerald-400">
        <span>数据已同步至本地系统 (Local Storage)</span>
        <button onclick="app.switchDeck('${tc.result?.deckId || 'deck_verbs'}'); app.router.navigate('study');" class="text-indigo-400 hover:underline">
          去学习大厅查看 →
        </button>
      </div>
    `;
  }

  // 待确认时默认展开 open，已完成或已拒绝默认收起 (Req 3)
  const openAttr = isPending ? 'open' : '';

  return `
    <details ${openAttr} class="p-3 rounded-xl mb-3 text-xs bg-slate-900/90 border border-indigo-900/50 group">
      <summary class="flex items-center justify-between cursor-pointer list-none">
        <div class="flex items-center gap-2">
          <span class="p-0.5 px-1 rounded bg-indigo-950 text-indigo-300 font-mono text-[9px] border border-indigo-800">TOOL CALL</span>
          <span class="font-bold text-white font-mono">${escapeHtml(tc.name)}</span>
        </div>
        <div class="flex items-center gap-2">
          ${statusBadge}
          <span class="text-[10px] text-slate-500 group-open:rotate-180 transition">▼</span>
        </div>
      </summary>
      <div class="py-2 text-[11px] text-slate-300 font-mono border-t border-slate-800/80 mt-2">
        ${escapeHtml(tc.previewText || `参数：${JSON.stringify(tc.arguments || {})}`)}
      </div>
      ${actionsOrResult}
    </details>
  `;
}
