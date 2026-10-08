/**
 * Deck Studio Visual Form Editor
 * Core: features/deck-studio/visual-editor.js
 */

import { renderHealthPill } from '../../design-system/components/pill.js';

export class VisualEditorController {
  constructor(app) {
    this.app = app;
  }

  render() {
    const container = document.getElementById('studio-visual-cards-container');
    if (!container || !this.app.draftDeck) return;
    const d = this.app.draftDeck;

    let html = `
      <!-- 题库基础信息表单 -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
        <div class="text-[11px] font-bold text-indigo-400 flex items-center justify-between">
          <span class="flex items-center gap-1">📌 知识库核心信息</span>
          <span class="text-[10px] text-slate-500 font-mono">标题限 30 字 · 单库限 500 词条</span>
        </div>
        <div class="grid grid-cols-4 gap-2">
          <div class="col-span-1">
            <label class="block text-[10px] text-slate-400 mb-1">图标 (Emoji)</label>
            <input type="text" value="${d.icon}" maxlength="4" oninput="app.onDeckMetaChange('icon', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-center text-sm font-bold text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div class="col-span-3">
            <label class="block text-[10px] text-slate-400 mb-1">知识库标题 <span class="text-rose-400">*</span></label>
            <input type="text" value="${d.title}" maxlength="30" oninput="app.onDeckMetaChange('title', this.value)" placeholder="题库名称 (必填，最多30字)" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500">
          </div>
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">简要描述说明</label>
          <input type="text" value="${d.description || ''}" maxlength="100" oninput="app.onDeckMetaChange('description', this.value)" placeholder="一句话描述知识要点..." class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
        </div>
      </div>
    `;

    (d.categories || []).forEach((cat, catIdx) => {
      const catEntities = (d.entities || []).filter(e => e.categoryId === cat.id);
      const healthPill = renderHealthPill(catEntities.length);

      html += `
        <div class="bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 space-y-3">
          <!-- 分类标头 (显式体现 业务分组 与 细分类别) -->
          <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div class="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
              <span class="text-xs text-indigo-400 font-mono font-bold">#${catIdx + 1}</span>
              <div class="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                <span class="text-slate-400 font-medium">📦 分组:</span>
                <input type="text" value="${cat.group || '核心知识板块'}" maxlength="24" oninput="app.onCategoryGroupChange('${cat.id}', this.value)" placeholder="所属分组 (例如: 不规则核心记忆法)" class="bg-transparent text-indigo-300 font-bold focus:outline-none w-36 truncate">
              </div>
              <div class="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] flex-1 min-w-[140px]">
                <span class="text-slate-400 font-medium">🏷️ 细类:</span>
                <input type="text" value="${cat.name}" maxlength="30" oninput="app.onCategoryNameChange('${cat.id}', this.value)" placeholder="细类名称 (例如: AAA型三态同形)" class="bg-transparent text-white font-bold focus:outline-none flex-1 truncate">
              </div>
              ${healthPill}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="app.addEntityInVisual('${cat.id}')" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-medium border border-indigo-500/30 transition shadow-sm">
                + 概念
              </button>
              <button onclick="app.deleteCategoryInVisual('${cat.id}')" class="text-slate-500 hover:text-rose-400 text-xs px-1" title="删除分类">&times;</button>
            </div>
          </div>

          <!-- 概念卡片列表 -->
          <div class="space-y-2.5">
      `;

      if (catEntities.length === 0) {
        html += `<div class="text-[11px] text-rose-400/80 bg-rose-950/20 border border-rose-900/30 rounded-lg p-2 text-center">此分类暂无条目，请点击「+ 概念」添加（至少需要 4 条以生成纯同胞干扰项）</div>`;
      }

      catEntities.forEach(e => {
        html += `
          <div class="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2">
              <input type="text" value="${e.title}" maxlength="50" oninput="app.onEntityFieldChange('${e.id}', 'title', this.value)" placeholder="概念/单词名称 (必填)" class="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-bold text-xs flex-1 focus:outline-none focus:border-indigo-500">
              
              <select onchange="app.onEntityFieldChange('${e.id}', 'layer', parseInt(this.value))" class="bg-slate-900 text-[10px] text-slate-300 rounded px-1.5 py-1 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono">
                <option value="1" ${e.layer === 1 ? 'selected' : ''}>L1: 基础</option>
                <option value="2" ${e.layer === 2 ? 'selected' : ''}>L2: 规律</option>
                <option value="3" ${e.layer === 3 ? 'selected' : ''}>L3: 特例陷阱</option>
              </select>

              <button onclick="app.deleteEntityInVisual('${e.id}')" class="text-slate-500 hover:text-rose-400 text-sm px-1" title="删除此概念条目">&times;</button>
            </div>

            <div>
              <input type="text" value="${e.answer}" maxlength="80" oninput="app.onEntityFieldChange('${e.id}', 'answer', this.value)" placeholder="核心正确答案 (必填)" class="w-full bg-indigo-950/20 border border-indigo-500/30 rounded px-2 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500">
            </div>

            <div>
              <input type="text" value="${e.explanation || ''}" oninput="app.onEntityFieldChange('${e.id}', 'explanation', this.value)" placeholder="规则解析/记忆口诀" class="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-0.5 text-slate-300 text-[11px] focus:outline-none focus:border-indigo-500">
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <input type="text" value="${e.pitfalls || ''}" oninput="app.onEntityFieldChange('${e.id}', 'pitfalls', this.value)" placeholder="⚠️ 避坑误区(可选)" class="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-0.5 text-rose-300 focus:outline-none focus:border-indigo-500">
              <input type="text" value="${e.confusedWith || ''}" oninput="app.onEntityFieldChange('${e.id}', 'confusedWith', this.value)" placeholder="🔗 强混淆概念(可选)" class="w-full bg-slate-900 border border-slate-800/80 rounded px-2 py-0.5 text-amber-300 font-mono focus:outline-none focus:border-indigo-500">
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }
}
