/**
 * Combo & Particle Effects Controller
 * Core: features/arena/combo-effect.js
 */

export class ComboEffectController {
  constructor(soundSynth) {
    this.soundSynth = soundSynth;
  }

  triggerComboAnimation(comboCount) {
    const banner = document.getElementById('combo-banner');
    const comboNum = document.getElementById('combo-count-number');
    if (!banner || !comboNum) return;

    comboNum.innerText = comboCount;
    banner.classList.remove('hidden', 'scale-90', 'opacity-0');
    banner.classList.add('scale-105', 'opacity-100');

    if (comboCount >= 3) {
      this.soundSynth.play('combo');
    }

    if (comboCount >= 5 && typeof window.confetti === 'function') {
      try {
        window.confetti({
          particleCount: Math.min(comboCount * 8, 80),
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // 容错
      }
    }

    setTimeout(() => {
      banner.classList.remove('scale-105');
      banner.classList.add('scale-90', 'opacity-0');
      setTimeout(() => banner.classList.add('hidden'), 250);
    }, 1200);
  }
}
