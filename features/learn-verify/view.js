/**
 * Learn & Verify View Renderer (Pure DOM & Componentry)
 * Core: features/learn-verify/view.js
 * 
 * Strict compliance with FE-ICON-002: Zero emojis in UI chrome (all monochrome SVG).
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { renderIcon } from '../../design-system/icons/icons.js';

export class LearnVerifyView {
  constructor(app) {
    this.app = app;
  }

  renderHeader({ currentTier, progressText, progressPercent, accuracy, categoryName, groupName }) {
    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-4 shadow-md space-y-3">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <button onclick="app.learnVerifyController.exitSession()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 font-medium">
              ${renderIcon('arrowLeft', 'w-3 h-3')}
              <span>退出学练</span>
            </button>
            <div class="h-3.5 w-px bg-slate-800"></div>
            <span class="text-indigo-400 font-mono font-bold">Tier ${currentTier}</span>
            <span class="text-slate-500">/</span>
            <span class="text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[220px]">${groupName} · ${categoryName}</span>
          </div>
          <div class="flex items-center gap-3 font-mono">
            <span class="text-slate-400">正确率: <span class="text-emerald-400 font-bold">${accuracy}%</span></span>
            <span class="text-slate-500 font-bold">${progressText}</span>
          </div>
        </div>
        <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
    `;
  }

  renderEncodingCard(node, isLanguageDeck) {
    const enc = node.encoding;
    const isNewBadge = node.isNew
      ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono flex items-center gap-1">${renderIcon('sparkles', 'w-3 h-3')} 新知初学</span>`
      : `<span class="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">熟练度 Lv ${node.cardState.level}</span>`;

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-2 text-slate-400 font-mono">
            <span class="text-indigo-400 font-bold">${node.groupName}</span>
            <span>/</span>
            <span>${node.categoryName}</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400">Layer ${node.layer}</span>
          </div>
          <div>${isNewBadge}</div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${node.title}</h2>
            <button onclick="app.learnVerifyController.speakWord('${(node.phonetics?.tts_clean || node.title).replace(/'/g, "\\'")}', '${node.lang || ''}')" class="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-slate-700 transition" title="朗读发音 (快捷键 P)">
              <svg class="w-4 h-4 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            </button>
          </div>
          ${node.subtitle ? `<p class="text-xs text-slate-400 font-mono">${node.subtitle}</p>` : ''}
        </div>

        <div class="surface-inset rounded-xl p-4 border border-slate-750/80 space-y-3">
          <div class="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
            ${renderIcon('book', 'w-3.5 h-3.5 text-indigo-400')}
            <span>${enc.prompt}</span>
          </div>
          <div class="text-lg font-bold text-emerald-400 font-mono tracking-wide">${enc.answer}</div>
          ${enc.explanation ? `<p class="text-xs text-slate-300 leading-relaxed">${enc.explanation}</p>` : ''}
        </div>

        ${enc.pitfalls ? `
          <div class="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
            ${renderIcon('alertCircle', 'w-4 h-4 text-rose-400 shrink-0 mt-0.5')}
            <div class="space-y-0.5">
              <span class="font-bold text-rose-300">易错盲区与陷阱提示：</span>
              <p class="text-rose-200/90 leading-relaxed">${enc.pitfalls}</p>
            </div>
          </div>
        ` : ''}

        ${enc.confusedSibling ? `
          <div class="rounded-xl p-3 bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
            <span class="font-bold text-amber-300 flex items-center gap-1.5">
              ${renderIcon('bulb', 'w-3.5 h-3.5 text-amber-400')}
              <span>对偶易混淆考点对照：</span>
            </span>
            <div class="flex items-center justify-between text-slate-300 pt-1">
              <span class="font-bold text-white font-mono">${enc.confusedSibling.title}</span>
              <span class="text-amber-300 font-mono font-bold">${enc.confusedSibling.answer}</span>
            </div>
            ${enc.confusedSibling.explanation ? `<p class="text-[11px] text-slate-400">${enc.confusedSibling.explanation}</p>` : ''}
          </div>
        ` : ''}

        <div class="pt-2 flex justify-end">
          <button onclick="app.learnVerifyController.startVerify()" class="btn-primary-cta w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2">
            <span>记住了，开启即时验证</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderVerificationCard(node, selectedIndex = null) {
    const q = node.verification;
    const optionLetters = ['A', 'B', 'C', 'D'];

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-1.5 text-indigo-400 font-bold font-mono">
            ${renderIcon('target', 'w-3.5 h-3.5')}
            <span>即时形成性微测 · 请凭记忆选出正确项</span>
          </div>
          <span class="text-[10px] font-mono text-slate-500">快捷键 1/2/3/4</span>
        </div>

        <div class="space-y-1.5">
          <span class="text-[11px] font-mono text-slate-400">${node.categoryName} · Layer ${node.layer}</span>
          <h2 class="text-xl sm:text-2xl font-black text-white">${node.title}</h2>
          <p class="text-xs font-medium text-slate-300 bg-slate-850 px-3 py-2 rounded-lg border border-slate-750 inline-block">${q.prompt}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          ${q.options.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            const borderStyle = isSelected
              ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold ring-2 ring-indigo-500/50'
              : 'border-slate-750 bg-slate-900/90 text-slate-200 hover:border-slate-600 hover:bg-slate-850';

            return `
              <button onclick="app.learnVerifyController.selectOption(${idx})"
                class="p-3.5 rounded-xl border text-left transition select-none flex items-center justify-between group ${borderStyle}">
                <div class="flex items-center gap-2.5 min-w-0 pr-2">
                  <span class="w-5 h-5 rounded-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'} flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    ${idx + 1}
                  </span>
                  <span class="font-mono text-sm truncate">${opt}</span>
                </div>
                <span class="text-[10px] font-mono text-slate-500 opacity-60">${optionLetters[idx]}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="pt-3 flex justify-end">
          <button onclick="app.learnVerifyController.submitAnswer()" ${selectedIndex === null ? 'disabled' : ''}
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${selectedIndex !== null ? 'btn-primary-cta shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}">
            <span>提交验证</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderSuccessCard(node) {
    return `
      <div class="surface-card rounded-2xl border border-emerald-500/40 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold pb-2 border-b border-emerald-500/20">
          ${renderIcon('check', 'w-4 h-4')}
          <span>验证通过 · 概念提取成功</span>
        </div>

        <div class="space-y-2">
          <h2 class="text-2xl font-black text-white">${node.title}</h2>
          <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-mono font-bold">
            正确答案: ${node.encoding.answer}
          </div>
          ${node.encoding.explanation ? `<p class="text-xs text-slate-300 leading-relaxed">${node.encoding.explanation}</p>` : ''}
        </div>

        <div class="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
          ${renderIcon('sparkles', 'w-3.5 h-3.5 text-indigo-400')}
          <span>已晋级为稳固节点 (Lv 1)，今后自动纳入艾宾浩斯间隔复习！</span>
        </div>

        <div class="pt-2 flex justify-end">
          <button onclick="app.learnVerifyController.proceedNext()" class="btn-primary-cta w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2">
            <span>继续下一个考点</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderRemediationCard(node, wrongAnswer, correctAnswer) {
    const rem = node.remediation;

    return `
      <div class="surface-card rounded-2xl border border-rose-500/40 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold pb-2 border-b border-rose-500/20">
          ${renderIcon('cross', 'w-4 h-4')}
          <span>掉入陷阱 · 测验增强学习激活</span>
        </div>

        <div class="space-y-2">
          <h2 class="text-xl sm:text-2xl font-black text-white">${node.title}</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <span class="text-slate-400 block text-[10px]">你选择的干扰项：</span>
              <span class="font-bold line-through">${wrongAnswer || '未作答'}</span>
            </div>
            <div class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span class="text-slate-400 block text-[10px]">正确答案：</span>
              <span class="font-bold">${correctAnswer}</span>
            </div>
          </div>
        </div>

        ${rem.pitfalls ? `
          <div class="rounded-xl p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
            <span class="font-bold text-rose-300 flex items-center gap-1.5">
              ${renderIcon('alertCircle', 'w-3.5 h-3.5 text-rose-400')}
              <span>盲区解析：</span>
            </span>
            <p class="leading-relaxed text-rose-200/90">${rem.pitfalls}</p>
          </div>
        ` : ''}

        <div class="p-3 rounded-xl bg-slate-900 border border-slate-750 text-xs text-slate-400 flex items-center gap-2 font-mono">
          ${renderIcon('redo', 'w-3.5 h-3.5 text-indigo-400')}
          <span>该考点已自动推入本组末尾，完成其他考点后压轴复验！</span>
        </div>

        <div class="pt-2 flex justify-end">
          <button onclick="app.learnVerifyController.proceedNext()" class="btn-primary-cta w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2">
            <span>记住了，继续下一个</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderTierCheckpoint(currentTier, accuracy, completedCount, canUnlockNext, onUnlockNext, onExit) {
    return `
      <div class="surface-card rounded-2xl border ${canUnlockNext ? 'border-indigo-500/60' : 'border-amber-500/60'} p-6 sm:p-8 text-center space-y-5 shadow-2xl animate-fade-in max-w-lg mx-auto">
        <div class="w-14 h-14 mx-auto rounded-2xl ${canUnlockNext ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40' : 'bg-amber-600/20 text-amber-400 border border-amber-500/40'} flex items-center justify-center">
          ${renderIcon(canUnlockNext ? 'trophy' : 'bulb', 'w-8 h-8')}
        </div>

        <div class="space-y-1">
          <h2 class="text-2xl font-black text-white">${canUnlockNext ? `Tier ${currentTier} 阶梯大通关！` : `Tier ${currentTier} 巩固建议`}</h2>
          <p class="text-xs text-slate-400">已完整学习并验证本阶段 ${completedCount} 个知识点</p>
        </div>

        <div class="grid grid-cols-2 gap-3 py-2 text-xs font-mono">
          <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span class="text-slate-400 block text-[10px]">首答正确率</span>
            <span class="text-xl font-bold ${accuracy >= 80 ? 'text-emerald-400' : 'text-amber-400'}">${accuracy}%</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span class="text-slate-400 block text-[10px]">掌握状态</span>
            <span class="text-sm font-bold text-indigo-300">${canUnlockNext ? '已达成门禁' : '建议再强化'}</span>
          </div>
        </div>

        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onclick="app.learnVerifyController.exitSession()" class="btn-secondary w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-medium transition">
            返回学习大厅
          </button>
          ${canUnlockNext && currentTier < 3 ? `
            <button onclick="app.learnVerifyController.unlockNextTier()" class="btn-primary-cta w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-1.5">
              <span>进阶 Tier ${currentTier + 1}</span>
              ${renderIcon('arrowRight', 'w-3.5 h-3.5')}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
}
