/**
 * Web Audio API 8-Bit Synthesizer Sound Engine
 * Core: platform/audio/web-audio-synth.js
 */

export class WebAudioSynth {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  playTone(freq, type, duration, delay = 0, gainLevel = 0.1) {
    if (this.isMuted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const startTime = this.audioCtx.currentTime + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainLevel, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      // 容错降级
    }
  }

  play(name) {
    if (this.isMuted) return;
    switch (name) {
      case 'correct':
        this.playTone(523.25, 'triangle', 0.1, 0, 0.12); // C5
        this.playTone(659.25, 'triangle', 0.15, 0.08, 0.12); // E5
        this.playTone(783.99, 'triangle', 0.25, 0.16, 0.15); // G5
        break;
      case 'combo':
        this.playTone(587.33, 'square', 0.08, 0, 0.08);
        this.playTone(880.00, 'square', 0.15, 0.06, 0.1);
        this.playTone(1174.66, 'square', 0.25, 0.12, 0.12);
        break;
      case 'wrong':
        this.playTone(180, 'sawtooth', 0.25, 0, 0.15);
        this.playTone(140, 'sawtooth', 0.35, 0.15, 0.15);
        break;
      case 'victory':
        this.playTone(440, 'triangle', 0.1, 0, 0.1);
        this.playTone(554.37, 'triangle', 0.1, 0.1, 0.1);
        this.playTone(659.25, 'triangle', 0.1, 0.2, 0.1);
        this.playTone(880, 'triangle', 0.4, 0.3, 0.15);
        break;
      case 'click':
        this.playTone(440, 'sine', 0.03, 0, 0.05);
        break;
      default:
        break;
    }
  }
}

export const soundSynth = new WebAudioSynth();
