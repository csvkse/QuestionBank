/**
 * Status Pill & Badge Helpers
 * Core: design-system/components/pill.js
 */

export function renderHealthPill(count, minRequired = 4) {
  if (count >= minRequired) {
    return `<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">🟢 ${count}条 (同胞池充盈)</span>`;
  } else if (count > 0) {
    return `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono" title="少于4条将导致答题时同胞干扰项退火降级">⚠️ 仅${count}条 (建议≥${minRequired}条)</span>`;
  } else {
    return `<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">🔴 空分类</span>`;
  }
}

export function renderLayerBadge(layerNum) {
  const lColor = layerNum === 1 
    ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' 
    : (layerNum === 2 ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30');
  const lIcon = layerNum === 1 ? '🌱' : (layerNum === 2 ? '🌿' : '🔥');
  return `<span class="text-[10px] px-2 py-0.5 rounded border font-mono ${lColor}">${lIcon} L${layerNum}</span>`;
}
