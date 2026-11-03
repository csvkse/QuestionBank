/**
 * Web Speech API Speech Synthesis Engine & Multi-Modal Phonetic Sanitizer
 * Core: platform/audio/speech-synth.js
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

/**
 * 清洗发音文本：去除 Markdown 标记、括号注解、元说明词及标点干扰
 * 彻底解决形如 "【ね 的读音】"、"apple [ˈæpl]"、"write (wrote)" 导致的读音污染
 * @param {string} text - 原始词条文本
 * @returns {string} 纯净可发音文本
 */
export function sanitizePronunciation(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim().replace(/[*_`#]/g, '');

  const bracketRegex = /[\(（\[【「『<][^\)）\]】」』>]*[\)）\]】」』>]/g;
  const ipaRegex = /\/[^\/]{2,}\//g;
  const withoutBrackets = cleaned.replace(bracketRegex, ' ').replace(ipaRegex, ' ').trim();

  if (withoutBrackets.length > 0) {
    cleaned = withoutBrackets;
  } else {
    cleaned = cleaned.replace(/^[【\[（\(「『<]+|[】\]）\)」』>]+$/g, '').trim();
  }
  cleaned = cleaned.replace(/(?:的)?(?:读音|发音|音标|注音|释义|假名)[:：]?/g, '').trim();
  return cleaned.replace(/\s+/g, ' ').trim();
}

export function detectLocale(text, defaultLang = 'en-US') {
  if (!text) return defaultLang || 'en-US';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja-JP';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko-KR';
  if (/[\u0400-\u04FF]/.test(text)) return 'ru-RU';
  if (/[\u4E00-\u9FA5]/.test(text)) return 'zh-CN';
  if (defaultLang && defaultLang !== 'en-US') return defaultLang;
  return 'en-US';
}

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
  const langKeywords = /(英语|英文|动词|词汇|单词|语法|时态|english|verb|vocabulary|grammar|日语|法语|德语|西语|俄语|韩语|语言|japanese|french|german|spanish|korean|五十音)/i;
  if (langKeywords.test(text)) return true;

  // 2. 词条内容启发式抽样检查 (检查前 5 条概念)
  const entities = deck.entities || [];
  if (entities.length > 0) {
    const sample = entities.slice(0, 5);
    const hasPhoneticOrWestern = sample.some(e => {
      const sub = e.subtitle || '';
      const t = (e.title || '').trim();
      // 是否包含国际音标格式 (/.../) 或 纯英文/拉丁词干 或 日文假名 / 韩文
      const hasIpa = /\/[^\/]{2,}\//.test(sub);
      const isLatinWord = /^[a-zA-Z\s'-]+$/.test(t);
      const isEastAsianKana = /[\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(t);
      return hasIpa || isLatinWord || isEastAsianKana;
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
  if (/日语|日本语|日文|japanese|五十音/i.test(text)) return 'ja-JP';
  if (/法语|法文|french/i.test(text)) return 'fr-FR';
  if (/德语|德文|german/i.test(text)) return 'de-DE';
  if (/西语|西班牙语|西班牙|spanish/i.test(text)) return 'es-ES';
  if (/韩语|朝鲜语|韩文|korean/i.test(text)) return 'ko-KR';
  if (/俄语|俄文|russian/i.test(text)) return 'ru-RU';
  if (/中文|汉语|常识|网络|计算机|协议|算法|哲学|历史|地理|python/i.test(text)) return 'zh-CN';

  return 'en-US';
}

/**
 * 纯前端原生语音合成服务 (具备在线高保真音频与 Web Speech 双引擎自愈回退)
 */
export class SpeechSynthService {
  constructor() {
    this.storageKey = 'knowledge_arena_auto_speech';
    this.rate = 0.95;
    this.pitch = 1.0;
    this._activeUtterance = null;
    this._activeAudio = null;
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
    if (this._activeAudio) {
      try { this._activeAudio.pause(); this._activeAudio = null; } catch (_) {}
    }
    if (this.isSupported()) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    this._activeUtterance = null;
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

  playAudioFallback(cleanText, lang) {
    if (typeof window === 'undefined' || typeof window.Audio === 'undefined') return false;
    try {
      if (this._activeAudio) {
        this._activeAudio.pause();
        this._activeAudio = null;
      }
      const enc = encodeURIComponent(cleanText);
      let url = `https://dict.youdao.com/dictvoice?audio=${enc}&type=2`;
      if (lang === 'ja-JP' || lang?.startsWith('ja')) {
        url = `https://dict.youdao.com/dictvoice?audio=${enc}&le=jap`;
      } else if (lang === 'ko-KR' || lang?.startsWith('ko')) {
        url = `https://dict.youdao.com/dictvoice?audio=${enc}&le=ko`;
      } else if (lang === 'zh-CN' || lang?.startsWith('zh')) {
        url = `https://dict.youdao.com/dictvoice?audio=${enc}&le=zh`;
      }

      const audio = new window.Audio(url);
      this._activeAudio = audio;
      audio.play().catch(() => {
        // 若网络音频失败，降级为默认本地声音
        const fallbackVoice = (window.speechSynthesis?.getVoices?.() || [])[0];
        if (fallbackVoice && this.isSupported()) {
          const fallbackUtt = new window.SpeechSynthesisUtterance(cleanText);
          fallbackUtt.voice = fallbackVoice;
          window.speechSynthesis.speak(fallbackUtt);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  speak(text, lang = null, options = {}) {
    if (!text) return false;

    // 清洗文本：去除括号说明与标点干扰
    const cleanText = sanitizePronunciation(text);
    if (!cleanText) return false;

    // 智能探测语言 (若未显式指定，或显式传入为 en-US 但文本具有明确非英文特征)
    const effectiveLang = (!lang || (lang === 'en-US' && /[\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u4E00-\u9FA5]/.test(cleanText)))
      ? detectLocale(cleanText, lang || 'zh-CN')
      : lang;

    this.cancel();

    // 1. 如果浏览器原生支持且存在该语种的语音库，优先使用原生 SpeechSynthesis
    const voice = this.getBestVoice(effectiveLang);
    if (this.isSupported() && voice) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        const utterance = new window.SpeechSynthesisUtterance(cleanText);
        utterance.lang = effectiveLang;
        utterance.rate = options.rate || this.rate;
        utterance.pitch = options.pitch || this.pitch;
        utterance.voice = voice;

        // 保持对象全局引用，防止 Chromium V8 GC 导致中途静音崩溃
        this._activeUtterance = utterance;
        utterance.onend = () => { if (this._activeUtterance === utterance) this._activeUtterance = null; };
        utterance.onerror = () => { if (this._activeUtterance === utterance) this._activeUtterance = null; };

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (e) {
        return this.playAudioFallback(cleanText, effectiveLang);
      }
    }

    // 2. 本地系统无目标语种语音库 (如 Windows 无日文/韩文语音包)，自适应切换为高保真在线发音
    const audioOk = this.playAudioFallback(cleanText, effectiveLang);
    if (audioOk) return true;

    // 3. 兜底回退：若无网络音频可用 (如纯离线或测试夹具)，但 Web Speech 支持，使用系统可用声音尝试朗读
    if (this.isSupported()) {
      try {
        const fallbackVoice = (window.speechSynthesis.getVoices() || [])[0];
        const utterance = new window.SpeechSynthesisUtterance(cleanText);
        utterance.lang = fallbackVoice ? fallbackVoice.lang : effectiveLang;
        if (fallbackVoice) utterance.voice = fallbackVoice;
        this._activeUtterance = utterance;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (_) {}
    }

    return false;
  }

  speakEntity(entity, deck, isAuto = false) {
    if (!entity || !deck) return false;
    if (isAuto && !this.isAutoSpeechEnabled()) return false;
    // 自动播放时仅在语言题库生效；手动播放（isAuto=false）在所有题库均可触发
    if (isAuto && !isLanguageDeck(deck)) return false;

    const deckLang = getDeckLangCode(deck);
    const targetText = (entity.phonetics && entity.phonetics.tts_clean) || entity.title;
    const targetLang = entity.lang || detectLocale(targetText, deckLang);

    return this.speak(targetText, targetLang);
  }
}

export const speechSynth = new SpeechSynthService();
