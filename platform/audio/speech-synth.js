/**
 * Web Speech API Speech Synthesis Engine & Language Classifier
 * Core: platform/audio/speech-synth.js
 */

/**
 * 判断指定题库是否属于语言学习类型 (显式标记 + 启发式多维推导)
 * @param {Object} deck - 题库对象
 * @returns {boolean}
 */
export function isLanguageDeck(deck) {
  if (!deck) return false;
  if (deck.type === 'language' || deck.isLanguage === true) return true;

  const title = (deck.title || '').toLowerCase();
  const desc = (deck.description || '').toLowerCase();
  const id = (deck.id || '').toLowerCase();
  const text = `${title} ${desc} ${id}`;

  // 1. 关键词语义匹配 (包含各种语言与动词考点)
  const langKeywords = /(英语|英文|动词|词汇|单词|语法|时态|english|verb|vocabulary|grammar|日语|法语|德语|西语|俄语|韩语|语言|japanese|french|german|spanish|korean)/i;
  if (langKeywords.test(text)) return true;

  // 2. 词条内容启发式抽样检查 (检查前 5 条概念)
  const entities = deck.entities || [];
  if (entities.length > 0) {
    const sample = entities.slice(0, 5);
    const hasPhoneticOrWestern = sample.some(e => {
      const sub = e.subtitle || '';
      const t = (e.title || '').trim();
      // 是否包含国际音标格式 (/.../) 或 纯英文/拉丁词干
      const hasIpa = /\/[^\/]{2,}\//.test(sub);
      const isLatinWord = /^[a-zA-Z\s'-]+$/.test(t);
      return hasIpa || isLatinWord;
    });
    if (hasPhoneticOrWestern) return true;
  }

  return false;
}

/**
 * 推导指定题库所适用的 BCP 47 语言代码
 * @param {Object} deck - 题库对象
 * @returns {string} 语言代码 (如 'en-US', 'ja-JP', 'fr-FR' 等)
 */
export function getDeckLangCode(deck) {
  if (!deck) return 'en-US';
  if (deck.lang) return deck.lang;

  const text = `${deck.title || ''} ${deck.description || ''} ${deck.id || ''}`.toLowerCase();
  if (/日语|日本语|日文|japanese/i.test(text)) return 'ja-JP';
  if (/法语|法文|french/i.test(text)) return 'fr-FR';
  if (/德语|德文|german/i.test(text)) return 'de-DE';
  if (/西语|西班牙语|西班牙|spanish/i.test(text)) return 'es-ES';
  if (/韩语|朝鲜语|韩文|korean/i.test(text)) return 'ko-KR';
  if (/俄语|俄文|russian/i.test(text)) return 'ru-RU';

  return 'en-US';
}

/**
 * 纯前端原生语音合成服务
 */
export class SpeechSynthService {
  constructor() {
    this.storageKey = 'knowledge_arena_auto_speech';
    this.rate = 0.95;
    this.pitch = 1.0;
  }

  isSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  isAutoSpeechEnabled() {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    try {
      return window.localStorage.getItem(this.storageKey) !== 'false';
    } catch (e) {
      return true;
    }
  }

  setAutoSpeech(enabled) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(this.storageKey, enabled ? 'true' : 'false');
    } catch (e) {
      // 容错降级
    }
  }

  toggleAutoSpeech() {
    const nextState = !this.isAutoSpeechEnabled();
    this.setAutoSpeech(nextState);
    return nextState;
  }

  cancel() {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // 容错降级
      }
    }
  }

  getBestVoice(lang = 'en-US') {
    if (!this.isSupported()) return null;
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const prefix = lang.split('-')[0].toLowerCase();
      // 优先匹配完整 lang，其次匹配语言前缀
      return voices.find(v => v.lang === lang) ||
             voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix)) ||
             null;
    } catch (e) {
      return null;
    }
  }

  speak(text, lang = 'en-US', options = {}) {
    if (!this.isSupported() || !text) return false;

    // 清洗文本：去除括号说明与标点干扰 (如 "write (wrote)" -> "write")
    const cleanText = text.replace(/[\(（].*?[\)）]/g, '').trim();
    if (!cleanText) return false;

    try {
      this.cancel();

      const utterance = new window.SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = options.rate || this.rate;
      utterance.pitch = options.pitch || this.pitch;

      const voice = this.getBestVoice(lang);
      if (voice) utterance.voice = voice;

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (e) {
      return false;
    }
  }

  speakEntity(entity, deck, isAuto = false) {
    if (!entity || !deck) return false;
    if (isAuto && !this.isAutoSpeechEnabled()) return false;
    if (!isLanguageDeck(deck)) return false;

    const lang = getDeckLangCode(deck);
    return this.speak(entity.title, lang);
  }
}

export const speechSynth = new SpeechSynthService();
