/**
 * Learn & Verify Topic Cluster View Renderer (DOM Componentry)
 * Core: features/learn-verify/cluster-view.js
 * 
 * Strict compliance with FE-ICON-002: Zero emojis in UI chrome (all monochrome SVG).
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { renderIcon } from '../../design-system/icons/icons.js';

export class LearnVerifyClusterView {
  constructor(app) {
    this.app = app;
  }

  renderHeader({ currentCapsuleIndex = 0, totalCapsules = 1, capsule, accuracy = 100 }) {
    const progressPercent = totalCapsules > 0 ? Math.round(((currentCapsuleIndex + 1) / totalCapsules) * 100) : 100;

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-4 shadow-md space-y-3">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <button onclick="app.learnVerifyController.exitSession()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 font-medium">
              ${renderIcon('arrowLeft', 'w-3 h-3')}
              <span>退出</span>
            </button>
            <button onclick="app.learnVerifyController.toggleCatalog()" class="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white border border-indigo-500/30 transition flex items-center gap-1 font-medium font-mono">
              ${renderIcon('layers', 'w-3 h-3')}
              <span>考点目录</span>
            </button>
            <div class="h-3.5 w-px bg-slate-800"></div>
            <span class="text-indigo-400 font-mono font-bold">微考点 ${currentCapsuleIndex + 1}/${totalCapsules}</span>
            <span class="text-slate-500">/</span>
            <span class="text-slate-300 font-medium truncate max-w-[140px] sm:max-w-[240px]">${capsule ? `${capsule.groupName} · ${capsule.categoryName}` : ''}</span>
          </div>
          <div class="flex items-center gap-3 font-mono">
            <span class="text-slate-400">正确率: <span class="text-emerald-400 font-bold">${accuracy}%</span></span>
            <span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px]">Layer ${capsule ? capsule.layer : 1}</span>
          </div>
        </div>
        <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all duration-300" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
    `;
  }

  renderEncodingMatrixCard(capsule, isLanguageDeck = false) {
    const items = capsule.comparativeMatrix || [];

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6 animate-fade-in">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-2 text-indigo-400 font-mono font-bold">
            ${renderIcon('layers', 'w-4 h-4')}
            <span>微考点全景对比研读 · 建议横向对比记忆</span>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">包含 ${items.length} 个概念</span>
        </div>

        <div class="space-y-1">
          <h2 class="text-2xl sm:text-3xl font-black text-white tracking-tight">${capsule.title}</h2>
          <p class="text-xs text-slate-400">研读以下并列同胞概念定义与关键区别，随后进入交错冲关微测：</p>
        </div>

        <div class="grid grid-cols-1 ${items.length >= 3 ? 'md:grid-cols-2' : ''} gap-3.5">
          ${items.map((item, idx) => `
            <div class="surface-inset rounded-xl p-4 border border-slate-750/70 space-y-2.5 relative group hover:border-indigo-500/50 transition">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-mono font-bold">${idx + 1}</span>
                  <h3 class="text-lg font-bold text-white">${item.title}</h3>
                </div>
                <button onclick="app.learnVerifyController.speakWord('${item.title.replace(/'/g, "\\'")}')" class="p-1 rounded bg-slate-800 text-slate-400 hover:text-white transition" title="朗读纯净发音">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
              </div>
              <div class="text-sm font-bold text-emerald-400 font-mono">${item.answer}</div>
              <div class="text-xs text-slate-300 leading-relaxed">${item.explanation || item.prompt}</div>
              <div class="pt-1 border-t border-slate-800/80 flex flex-col gap-1 text-[11px]">
                <div class="text-indigo-300 flex items-center gap-1 font-mono">
                  ${renderIcon('sparkles', 'w-3 h-3 text-indigo-400 shrink-0')}
                  <span>锚点: ${item.anchor}</span>
                </div>
                <div class="text-amber-300/90 flex items-center gap-1">
                  ${renderIcon('alertCircle', 'w-3 h-3 text-amber-400 shrink-0')}
                  <span>${item.pitfall}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="pt-2 flex justify-end">
          <button onclick="app.learnVerifyController.startInterleavedQuiz()" class="btn-primary-cta w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-bold shadow-lg transition flex items-center justify-center gap-2">
            <span>掌握了，开启交错微测冲关 (${items.length} 题)</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderInterleavedQuizCard(capsule, q, qIndex, totalQ, selectedIndex = null) {
    const letters = ['A', 'B', 'C', 'D'];

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-1.5 text-indigo-400 font-bold font-mono">
            ${renderIcon('target', 'w-3.5 h-3.5')}
            <span>交错冲关 · 第 ${qIndex + 1} / ${totalQ} 题</span>
          </div>
          <div class="flex items-center gap-1.5">
            ${Array.from({ length: totalQ }).map((_, i) => `
              <span class="w-2.5 h-2.5 rounded-full ${i === qIndex ? 'bg-indigo-500 ring-2 ring-indigo-400/40' : i < qIndex ? 'bg-emerald-500' : 'bg-slate-750'} transition"></span>
            `).join('')}
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-[11px] font-mono text-slate-400">${capsule.categoryName} · Layer ${capsule.layer}</span>
          <h2 class="text-2xl font-black text-white">${q.targetTitle}</h2>
          <p class="text-xs font-medium text-slate-300 bg-slate-850 px-3 py-2 rounded-lg border border-slate-750 inline-block">${q.prompt}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          ${q.options.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            const style = isSelected
              ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold ring-2 ring-indigo-500/50'
              : 'border-slate-750 bg-slate-900/90 text-slate-200 hover:border-slate-600 hover:bg-slate-850';

            return `
              <button onclick="app.learnVerifyController.selectInterleavedOption(${idx})"
                class="p-3.5 rounded-xl border text-left transition select-none flex items-center justify-between group ${style}">
                <div class="flex items-center gap-2.5 min-w-0 pr-2">
                  <span class="w-5 h-5 rounded-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'} flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    ${idx + 1}
                  </span>
                  <span class="font-mono text-sm truncate">${opt}</span>
                </div>
                <span class="text-[10px] font-mono text-slate-500 opacity-60">${letters[idx]}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="pt-3 flex justify-end">
          <button onclick="app.learnVerifyController.submitInterleavedOption()" ${selectedIndex === null ? 'disabled' : ''}
            class="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${selectedIndex !== null ? 'btn-primary-cta shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}">
            <span>${qIndex + 1 === totalQ ? '提交并结算会诊' : '提交进入下一题'}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderEvaluationCard(capsule, wrongAnswers = []) {
    const total = capsule.questions.length;
    const correct = total - wrongAnswers.length;
    const accuracy = Math.round((correct / total) * 100);
    const isPerfect = wrongAnswers.length === 0;

    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6 animate-fade-in">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl ${isPerfect ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'} flex items-center justify-center">
            ${isPerfect ? renderIcon('check', 'w-6 h-6') : renderIcon('alertCircle', 'w-6 h-6')}
          </div>
          <div>
            <h2 class="text-xl sm:text-2xl font-black text-white">${isPerfect ? '微考点完美通关！' : '微考点会诊完毕'}</h2>
            <p class="text-xs text-slate-400">正确率: <span class="font-mono font-bold ${isPerfect ? 'text-emerald-400' : 'text-amber-400'}">${accuracy}%</span> (${correct}/${total} 题正确)</p>
          </div>
        </div>

        ${!isPerfect ? `
          <div class="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
            <span class="font-bold text-amber-300 flex items-center gap-1.5">
              ${renderIcon('bulb', 'w-4 h-4 text-amber-400')}
              <span>捕获到 ${wrongAnswers.length} 处概念混淆，建议就地进行靶向辨析：</span>
            </span>
            <ul class="space-y-1.5 pt-1">
              ${wrongAnswers.map(w => `
                <li class="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2 rounded-lg font-mono">
                  <span class="font-bold text-white">${w.targetTitle}</span>
                  <span class="text-rose-400 line-through">${w.chosenText}</span>
                  <span class="text-emerald-400 font-bold">${w.correctAnswer}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <div class="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-3">
            ${renderIcon('sparkles', 'w-5 h-5 text-emerald-400 shrink-0')}
            <span>已成功建立并列概念认知图式，所有实体的长时记忆稳定度获得提升！</span>
          </div>
        `}

        <div class="pt-2 flex justify-end gap-3">
          ${!isPerfect ? `
            <button onclick="app.learnVerifyController.startRemediation()" class="btn-primary-cta px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2">
              <span>就地靶向对偶纠偏</span>
            </button>
          ` : `
            <button onclick="app.learnVerifyController.advanceToCheckpoint()" class="btn-primary-cta px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2">
              <span>完成考点，同步记忆</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  renderRemediationCard(item, currIdx, totalRem) {
    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-5 animate-fade-in">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div class="flex items-center gap-1.5 text-rose-400 font-bold font-mono">
            ${renderIcon('alertCircle', 'w-3.5 h-3.5')}
            <span>靶向纠偏 · 第 ${currIdx + 1} / ${totalRem} 处混淆</span>
          </div>
        </div>

        <div class="space-y-1">
          <h2 class="text-2xl font-black text-white">${item.targetTitle}</h2>
          <p class="text-xs text-slate-400">核心区别与对偶深度辨析：</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div class="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 space-y-1">
            <span class="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">正确定义与考点</span>
            <div class="text-base font-bold text-white font-mono">${item.correctAnswer}</div>
          </div>
          <div class="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 space-y-1">
            <span class="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">你误选的混淆项</span>
            <div class="text-base font-bold text-rose-300 font-mono">${item.chosenText}</div>
          </div>
        </div>

        <div class="surface-inset p-4 rounded-xl border border-slate-750/80 text-xs text-slate-300 space-y-2">
          <div class="font-bold text-indigo-400 flex items-center gap-1.5 font-mono">
            ${renderIcon('book', 'w-3.5 h-3.5')}
            <span>考点解析：</span>
          </div>
          <p class="leading-relaxed">${item.explanation || '注意对比同胞概念的上下文边界。'}</p>
        </div>

        <div class="pt-2 flex justify-end">
          <button onclick="app.learnVerifyController.resolveRemediationStep()" class="btn-primary-cta px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2">
            <span>理解了差异，继续</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono">Enter</span>
          </button>
        </div>
      </div>
    `;
  }

  renderCapsuleCheckpoint(capsule, stats, hasNext) {
    return `
      <div class="surface-card rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6 text-center animate-fade-in">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
          ${renderIcon('award', 'w-8 h-8')}
        </div>

        <div class="space-y-1">
          <h2 class="text-2xl font-black text-white">微考点达成掌握！</h2>
          <p class="text-xs text-slate-400 font-mono">${capsule.title} · ${capsule.entities.length} 个概念已写入 SM-2 记忆流</p>
        </div>

        <div class="pt-4 flex justify-center gap-3">
          ${hasNext ? `
            <button onclick="app.learnVerifyController.nextCapsule()" class="btn-primary-cta px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2">
              <span>进阶下一微考点</span>
              ${renderIcon('arrowRight', 'w-4 h-4')}
            </button>
          ` : `
            <button onclick="app.learnVerifyController.exitSession()" class="btn-primary-cta px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2">
              <span>完成全部学练，返回仪表盘</span>
            </button>
          `}
        </div>
      </div>
    `;
  }
}
