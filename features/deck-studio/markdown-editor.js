/**
 * Markdown Editor Controller & Live AST Synchronizer
 * Core: features/deck-studio/markdown-editor.js
 */

import { parseMarkdownToDeck, serializeDeckToMarkdown } from '../../shared/markdown-ast.js';
import { validateDeckHealth } from '../../shared/deck-validator.js';

export class MarkdownEditorController {
  constructor(app) {
    this.app = app;
    this.syncTimer = null;
  }

  onInput() {
    this.updateStats();
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      const textarea = document.getElementById('deck-markdown-input');
      if (textarea) {
        this.app.draftDeck = parseMarkdownToDeck(textarea.value);
        this.app.visualEditor.render();
        this.updateLintStatus();
      }
    }, 180);
  }

  updateStats() {
    const textarea = document.getElementById('deck-markdown-input');
    const countEl = document.getElementById('studio-md-line-count');
    if (textarea && countEl) {
      const lines = textarea.value.split('\n').length;
      const chars = textarea.value.length;
      countEl.innerText = `行数: ${lines} | 字符: ${chars}`;
    }
  }

  updateLintStatus() {
    const msg = document.getElementById('deck-studio-lint-msg');
    if (!msg || !this.app.draftDeck) return;

    const health = validateDeckHealth(this.app.draftDeck);
    const groups = new Set((this.app.draftDeck.categories || []).map(c => c.group || '核心知识板块')).size;
    const cats = this.app.draftDeck.categories ? this.app.draftDeck.categories.length : 0;
    const ents = this.app.draftDeck.entities ? this.app.draftDeck.entities.length : 0;

    let html = '';
    if (!health.valid) {
      html = `<span class="text-rose-400 font-bold flex items-center gap-1.5 text-xs truncate">❌ 阻断项: ${health.errors[0]}</span>`;
      msg.className = 'text-xs text-rose-400 flex items-center gap-1.5 font-medium flex-1 overflow-hidden';
    } else if (health.warnings.length > 0) {
      html = `<span class="text-amber-300 flex items-center gap-1.5 text-xs truncate">🟡 <b>${groups}</b>大组 · <b>${cats}</b>细类 · <b>${ents}</b>词条 | ${health.warnings[0]}</span>`;
      msg.className = 'text-xs text-amber-300 flex items-center gap-1.5 font-medium flex-1 overflow-hidden';
    } else {
      html = `<span class="text-emerald-400 flex items-center gap-1.5 text-xs truncate">🟢 <b>${groups}</b>大组 · <b>${cats}</b>细类 · <b>${ents}</b>词条 · 结构健康 (符合 5-3-10 标准)</span>`;
      msg.className = 'text-xs text-slate-300 flex items-center gap-1.5 font-medium flex-1 overflow-hidden';
    }
    msg.innerHTML = html;
  }
}
