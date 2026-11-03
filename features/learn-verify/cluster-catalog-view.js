/**
 * Learn & Verify Topic Cluster Catalog & Navigation Drawer
 * Core 2.1: features/learn-verify/cluster-catalog-view.js
 * 
 * Strict compliance with FE-ICON-002: Zero emojis in UI chrome (all monochrome SVG).
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { renderIcon } from '../../design-system/icons/icons.js';

export function getCapsuleMasteryStatus(capsule, deckState = {}) {
  const cards = (deckState && deckState.cards) || {};
  const entities = capsule.entities || [];
  if (entities.length === 0) return { label: '未学习', color: 'slate', isMastered: false };

  let totalAttempts = 0;
  let masteredCount = 0;

  for (const ent of entities) {
    const card = cards[ent.id];
    if (card) {
      totalAttempts += (card.totalAttempts || 0);
      if ((card.interval || 0) >= 2) {
        masteredCount++;
      }
    }
  }

  if (masteredCount === entities.length) {
    return { label: '已掌握', color: 'emerald', isMastered: true };
  }
  if (totalAttempts > 0) {
    return { label: '待巩固', color: 'amber', isMastered: false };
  }
  return { label: '未学习', color: 'slate', isMastered: false };
}

export function renderCapsuleCatalogModal(capsules = [], currentCapsuleId = null, deckState = {}) {
  return `
    <div id="capsule-catalog-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onclick="if (event.target === this) app.learnVerifyController.toggleCatalog(false)">
      <div class="surface-card rounded-2xl border border-slate-750 p-5 sm:p-6 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col space-y-4">
        
        <!-- 弹窗标题栏 -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-indigo-400 font-bold">${renderIcon('layers', 'w-4 h-4')}</span>
            <h3 class="text-base font-bold text-white">微考点目录选单 (Capsule Navigator)</h3>
          </div>
          <button onclick="app.learnVerifyController.toggleCatalog(false)" class="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition">
            ${renderIcon('x', 'w-4 h-4')}
          </button>
        </div>

        <p class="text-xs text-slate-400 leading-relaxed">
          双轨制自主学习：点击任意微考点即可立即跳入该胶囊进行对比研读与微测，便于定向回顾与薄弱点加练。
        </p>

        <!-- 考点胶囊列表 (滚动区) -->
        <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
          ${capsules.map((cap, idx) => {
            const status = getCapsuleMasteryStatus(cap, deckState);
            const isCurrent = cap.id === currentCapsuleId;
            const badgeBg = status.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : status.color === 'amber' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700';

            return `
              <div class="p-3.5 rounded-xl border ${isCurrent ? 'border-indigo-500 bg-indigo-950/20 shadow-md' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'} flex items-center justify-between gap-3 transition">
                <div class="space-y-1 min-w-0">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="font-mono text-indigo-400 font-bold">#${idx + 1}</span>
                    <span class="font-bold text-white truncate text-sm">${cap.title}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono border ${badgeBg}">
                      ${status.label}
                    </span>
                  </div>
                  <div class="text-xs text-slate-400 flex items-center gap-2">
                    <span>${cap.groupName} · ${cap.categoryName}</span>
                    <span class="text-slate-600">|</span>
                    <span class="font-mono text-slate-400">Layer ${cap.layer} · ${(cap.entities || []).length} 个概念</span>
                  </div>
                </div>

                <div class="shrink-0">
                  ${isCurrent ? `
                    <span class="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-1 font-mono">
                      ${renderIcon('sparkles', 'w-3 h-3')}
                      <span>正在研读</span>
                    </span>
                  ` : `
                    <button onclick="app.learnVerifyController.jumpToCapsule('${cap.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow flex items-center gap-1">
                      <span>研读此考点</span>
                      ${renderIcon('arrowRight', 'w-3 h-3')}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- 底部说明与操作栏 -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>共 ${capsules.length} 个微考点胶囊</span>
          <button onclick="app.learnVerifyController.toggleCatalog(false)" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
            关闭目录
          </button>
        </div>

      </div>
    </div>
  `;
}
