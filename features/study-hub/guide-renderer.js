/**
 * Systemic Knowledge Guide Renderer for Study Hub
 * Core: features/study-hub/guide-renderer.js
 * SPEC 32: Advance Organizer & Relational Learning
 */

import { renderIcon } from '../../design-system/icons/icons.js';

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-200 font-bold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono text-[11px] border border-slate-700/60">$1</code>');
}

export function renderGuideMarkdown(rawText = '') {
  if (!rawText || !rawText.trim()) return '';

  const codeBlocks = [];
  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`
      <pre class="p-3.5 my-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed"><code>${escapeHtml(code.trim())}</code></pre>
    `);
    return `__GUIDE_CODE_${idx}__`;
  });

  const lines = text.split('\n');
  const output = [];
  let inTable = false;
  let tableRows = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      let tHtml = '<div class="overflow-x-auto my-3 rounded-xl border border-slate-800"><table class="min-w-full text-xs text-left">';
      tableRows.forEach((row, i) => {
        const isHeader = i === 0;
        const cols = row.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cols.every(c => /^[-:]+$/.test(c))) return; // 分隔线跳过
        tHtml += `<tr class="${isHeader ? 'bg-slate-900/90 text-indigo-200 font-semibold border-b border-slate-800' : 'border-b border-slate-800/40 hover:bg-slate-900/40'}">`;
        cols.forEach(c => {
          tHtml += `<td class="px-3.5 py-2 leading-relaxed">${inlineFormat(c)}</td>`;
        });
        tHtml += '</tr>';
      });
      tHtml += '</table></div>';
      output.push(tHtml);
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableRows.push(trimmed);
      return;
    }
    if (inTable) flushTable();

    if (!trimmed) {
      output.push('<div class="h-2"></div>');
    } else if (trimmed === '---') {
      output.push('<hr class="border-slate-800 my-4">');
    } else if (trimmed.startsWith('### ')) {
      output.push(`<h3 class="text-sm font-bold text-white mt-5 mb-2 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span>${escapeHtml(trimmed.slice(4))}</span></h3>`);
    } else if (trimmed.startsWith('#### ')) {
      output.push(`<h4 class="text-xs font-bold text-indigo-300 mt-3 mb-1.5">${escapeHtml(trimmed.slice(5))}</h4>`);
    } else if (trimmed.startsWith('> ')) {
      output.push(`<blockquote class="p-3 my-2 rounded-xl bg-indigo-950/30 border-l-2 border-indigo-500 text-xs text-slate-300 leading-relaxed font-sans">${inlineFormat(trimmed.slice(2))}</blockquote>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      output.push(`<li class="flex items-start gap-2 text-xs text-slate-300 ml-2 py-0.5"><span class="text-indigo-400 shrink-0 font-bold">•</span><span class="leading-relaxed">${inlineFormat(trimmed.slice(2))}</span></li>`);
    } else {
      output.push(`<p class="text-xs leading-relaxed text-slate-300 my-1">${inlineFormat(trimmed)}</p>`);
    }
  });

  if (inTable) flushTable();

  let finalHtml = output.join('\n');
  codeBlocks.forEach((cb, idx) => {
    finalHtml = finalHtml.replace(`__GUIDE_CODE_${idx}__`, cb);
  });
  return finalHtml;
}

export class GuideRenderer {
  constructor(app) {
    this.app = app;
  }

  render(container, modeToggleBar, deck, ds) {
    if (!deck) return;

    if (!deck.guide || !deck.guide.markdown) {
      container.innerHTML = `
        ${modeToggleBar}
        <div class="p-10 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-4 max-w-lg mx-auto my-6">
          <div class="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-700/50 flex items-center justify-center text-indigo-400 mx-auto text-xl shadow-lg shadow-indigo-950/40">
            ${renderIcon('book', 'w-6 h-6')}
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">当前题库暂未配置体系化导读</h3>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">
              体系化导读能将碎片考点串联为网状心智模型（Advance Organizer），解决考点孤立与盲点混淆问题。
            </p>
          </div>
          <div class="pt-2">
            <button onclick="app.requestAiDeckGuide('${deck.id}')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition flex items-center gap-2 mx-auto shadow-lg shadow-indigo-600/30">
              ${renderIcon('cpu', 'w-4 h-4 text-current')}
              <span>呼叫 AI 智囊一键生成系统化导读</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    const guide = deck.guide;
    const bodyHtml = renderGuideMarkdown(guide.markdown);

    container.innerHTML = `
      ${modeToggleBar}
      <div class="surface-card rounded-2xl border border-slate-800 p-5 sm:p-6 mt-3 space-y-6">
        <!-- 导读头部先行组织者摘要卡片 -->
        <div class="p-4 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/40 border border-indigo-800/50 shadow-md">
          <div class="flex items-center gap-2 text-indigo-300 font-mono text-xs font-bold mb-1.5">
            ${renderIcon('target', 'w-4 h-4 text-indigo-400')}
            <span>先行组织者 · 核心心智模型 (Cognitive Model)</span>
          </div>
          <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-medium">
            ${escapeHtml(guide.summary || deck.description)}
          </p>
        </div>

        <!-- 导读正文 -->
        <div class="guide-markdown-body text-slate-300 font-sans">
          ${bodyHtml}
        </div>

        <!-- 底部引导与行动唤起 -->
        <div class="pt-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span class="text-slate-400">已建立全局认知图式？立即进入刻意练习：</span>
          <div class="flex items-center gap-2">
            <button onclick="app.treeRenderer.setStudyViewMode('focus')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition flex items-center gap-1.5">
              ${renderIcon('target', 'w-3.5 h-3.5')}
              <span>切换至聚焦精读</span>
            </button>
            <button onclick="app.router.navigate('arena')" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30">
              <span>前往自由沙盒刷题 →</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
