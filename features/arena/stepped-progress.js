/**
 * Stepped Campaign Ladder & Promotion Gate Controller
 * Core: features/arena/stepped-progress.js
 * 
 * Manages Bloom-taxonomy cognitive tiers (Tier 1 -> 2 -> 3),
 * 80% accuracy promotion gate, and ladder roadmap visualization.
 */

import { renderIcon } from '../../design-system/icons/icons.js';

export const TIERS = [
  {
    tier: 1,
    layer: 1,
    name: '基础认知阶梯',
    badge: 'Tier 1 · 核心概念',
    desc: '巩固核心概念与专有名词的精准定义与下意识反射',
    targetAccuracy: 80,
    requiredCount: 8
  },
  {
    tier: 2,
    layer: 2,
    name: '关联机制阶梯',
    badge: 'Tier 2 · 规律辨析',
    desc: '高强度同胞干扰项横向比对，理清运行逻辑与因果关联',
    targetAccuracy: 80,
    requiredCount: 8
  },
  {
    tier: 3,
    layer: 3,
    name: '高阶实战阶梯',
    badge: 'Tier 3 · 边界特例',
    desc: '攻克反常特例、防坑易错陷阱与生产环境实战边界',
    targetAccuracy: 80,
    requiredCount: 8
  }
];

export class SteppedProgressController {
  constructor(app) {
    this.app = app;
    this.currentTier = 1;
    this.unlockedTiers = new Set([1]);
  }

  getTierInfo(tierNum = this.currentTier) {
    return TIERS.find(t => t.tier === tierNum) || TIERS[0];
  }

  showRoadmapModal() {
    if (typeof document === 'undefined') return;
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    this.renderRoadmapContent();
    const modal = document.getElementById('modal-stepped-campaign');
    if (modal) modal.classList.remove('hidden');
  }

  closeRoadmapModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-stepped-campaign');
    if (modal) modal.classList.add('hidden');
  }

  renderRoadmapContent() {
    const deck = this.app.getActiveDeck();
    const container = document.getElementById('stepped-tiers-container');
    if (!container) return;

    container.innerHTML = TIERS.map(t => {
      const isUnlocked = this.unlockedTiers.has(t.tier);
      const isCurrent = this.currentTier === t.tier;
      const count = (deck.entities || []).filter(e => e.layer === t.layer).length;

      let borderClass = 'border-slate-800 bg-slate-900/60 opacity-60';
      let statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-mono flex items-center gap-1">${renderIcon('lock', 'w-3 h-3')} 未解锁</span>`;
      let actionBtn = `<button disabled class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed">锁定中</button>`;

      if (isUnlocked) {
        borderClass = isCurrent
          ? 'border-indigo-500/80 bg-slate-900/90 shadow-lg shadow-indigo-500/10'
          : 'border-slate-750 bg-slate-900 hover:border-slate-700';
        statusBadge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">${renderIcon('unlock', 'w-3 h-3')} 已解锁</span>`;
        actionBtn = `
          <button onclick="app.steppedProgress.startTier(${t.tier})" class="px-4 py-1.5 rounded-lg ${isCurrent ? 'btn-primary-cta font-bold' : 'btn-secondary'} text-xs transition flex items-center gap-1">
            <span>进入阶梯</span>
            ${renderIcon('arrowRight', 'w-3 h-3')}
          </button>
        `;
      }

      return `
        <div class="rounded-2xl border p-4.5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${borderClass}">
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold text-indigo-400">STAGE ${t.tier}</span>
              <h4 class="text-sm font-bold text-white">${t.name}</h4>
              ${statusBadge}
            </div>
            <p class="text-xs text-slate-400">${t.desc}</p>
            <div class="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
              <span>题库总量: ${count} 词条</span>
              <span>•</span>
              <span>晋级门槛: 正确率 ≥ ${t.targetAccuracy}%</span>
            </div>
          </div>
          <div class="shrink-0 flex items-center justify-end">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  }

  startTier(tierNum) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    this.currentTier = tierNum;
    const tier = this.getTierInfo(tierNum);
    const layerEntities = (deck.entities || []).filter(e => e.layer === tier.layer);

    if (layerEntities.length === 0) {
      alert(`当前题库在 Layer ${tier.layer} 暂无题目，请先补充词条。`);
      return;
    }

    const queue = [...layerEntities].sort(() => Math.random() - 0.5).slice(0, tier.requiredCount);
    this.closeRoadmapModal();
    this.app.startSession('CAMPAIGN', queue);
  }

  evaluateTierResult(correctCount, totalCount) {
    if (this.app.currentMode !== 'CAMPAIGN') return null;

    const acc = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const currentTierInfo = this.getTierInfo(this.currentTier);
    const isPromoted = acc >= currentTierInfo.targetAccuracy;

    if (isPromoted && this.currentTier < 3) {
      this.unlockedTiers.add(this.currentTier + 1);
    }

    return {
      currentTier: this.currentTier,
      isPromoted,
      acc,
      nextTier: this.currentTier < 3 ? this.currentTier + 1 : null,
      tierInfo: currentTierInfo
    };
  }

  showPromotionModal(result) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-tier-promotion');
    if (!modal) return;

    const titleEl = document.getElementById('tier-promotion-title');
    const descEl = document.getElementById('tier-promotion-desc');
    const actionBtn = document.getElementById('tier-promotion-action-btn');

    if (result.isPromoted) {
      if (result.nextTier) {
        if (titleEl) titleEl.innerText = `晋级成功！解锁 Tier ${result.nextTier}`;
        if (descEl) descEl.innerText = `你在 ${result.tierInfo.name} 取得了 ${result.acc}% 正确率（门槛 ${result.tierInfo.targetAccuracy}%），成功达成认知跨越！`;
        if (actionBtn) {
          actionBtn.innerText = `开启 Tier ${result.nextTier} 进阶挑战`;
          actionBtn.onclick = () => {
            modal.classList.add('hidden');
            this.startTier(result.nextTier);
          };
        }
      } else {
        if (titleEl) titleEl.innerText = '登顶通关！终极宗师！';
        if (descEl) descEl.innerText = `恭喜你完成全部 3 阶梯战役，当前知识体系的全部基础概念、同胞辨析与边界特例已全面掌握！`;
        if (actionBtn) {
          actionBtn.innerText = '查看知识法典';
          actionBtn.onclick = () => {
            modal.classList.add('hidden');
            this.app.navigate('codex');
          };
        }
      }
    } else {
      if (titleEl) titleEl.innerText = '未达晋级标准，继续巩固';
      if (descEl) descEl.innerText = `本次正确率为 ${result.acc}%，未达晋级门槛（${result.tierInfo.targetAccuracy}%）。建议复习错题后重新挑战！`;
      if (actionBtn) {
        actionBtn.innerText = `重试 ${result.tierInfo.name}`;
        actionBtn.onclick = () => {
          modal.classList.add('hidden');
          this.startTier(result.currentTier);
        };
      }
    }

    modal.classList.remove('hidden');
  }
}
