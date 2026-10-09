/**
 * Unit Test: Web Speech Synthesis & Language Classifier
 * tests/unit/speech-synth.test.mjs
 */

import assert from 'assert';
import { BUILTIN_DECKS } from '../../shared/builtin-decks.js';
import { isLanguageDeck, getDeckLangCode, SpeechSynthService } from '../../platform/audio/speech-synth.js';

console.log('🧪 Testing speech-synth.js and language classifier...');

// 1. 测试内置题库的语言类型判定
const verbDeck = BUILTIN_DECKS.find(d => d.id === 'deck_verbs');
const httpDeck = BUILTIN_DECKS.find(d => d.id === 'deck_http');
const pythonDeck = BUILTIN_DECKS.find(d => d.id === 'deck_python');

assert.strictEqual(isLanguageDeck(verbDeck), true, '英语动词题库必须判定为语言类型');
assert.strictEqual(isLanguageDeck(httpDeck), false, 'HTTP 协议题库必须判定为非语言类型');
assert.strictEqual(isLanguageDeck(pythonDeck), false, 'Python 数据结构题库必须判定为非语言类型');

// 2. 测试边界与启发式识别
assert.strictEqual(isLanguageDeck(null), false, '空题库必须返回 false');
assert.strictEqual(isLanguageDeck({}), false, '空对象题库必须返回 false');

const customExplicit = { id: 'd_custom', title: '自定义词汇', type: 'language' };
assert.strictEqual(isLanguageDeck(customExplicit), true, '显式 type: language 必须返回 true');

const customJapanese = { id: 'd_ja', title: '标准日本语初级词汇' };
assert.strictEqual(isLanguageDeck(customJapanese), true, '包含"日语"关键词必须返回 true');

const customPhonetic = {
  id: 'd_phonetic',
  title: '高频核心词',
  entities: [
    { id: '1', title: 'cat', subtitle: '/kæt/ · 猫' }
  ]
};
assert.strictEqual(isLanguageDeck(customPhonetic), true, '包含国际音标抽样的题库必须判定为 true');

// 3. 测试语言代码提取 (getDeckLangCode)
assert.strictEqual(getDeckLangCode(verbDeck), 'en-US', '英语动词题库默认语言代码应为 en-US');
assert.strictEqual(getDeckLangCode(customJapanese), 'ja-JP', '日语题库应推导为 ja-JP');
assert.strictEqual(getDeckLangCode({ title: '零基础法语核心动词变位' }), 'fr-FR', '法语题库应推导为 fr-FR');
assert.strictEqual(getDeckLangCode({ title: '德语语法', lang: 'de-DE' }), 'de-DE', '显式 lang 属性必须优先采用');

// 4. 测试 SpeechSynthService 实例与本地离线防御性逻辑
const service = new SpeechSynthService();
assert.strictEqual(typeof service.speak, 'function', 'speak 方法必须存在');
assert.strictEqual(typeof service.toggleAutoSpeech, 'function', 'toggleAutoSpeech 方法必须存在');
assert.strictEqual(typeof service.cancel, 'function', 'cancel 方法必须存在');

// Node.js 环境下 window 为空，必须优雅降级
assert.strictEqual(service.isSupported(), false, 'Node 环境下 isSupported 必须为 false');
assert.strictEqual(service.speak('hello'), false, 'Node 环境下 speak 必须安全返回 false 而不崩溃');

// 5. 模拟浏览器环境测试发音调用
const mockVoices = [
  { name: 'Microsoft David', lang: 'en-US' },
  { name: 'Microsoft Zira', lang: 'en-US' },
  { name: 'Kyoko', lang: 'ja-JP' }
];

let lastSpokenUtterance = null;
let cancelCalled = false;

const mockStorage = {};
global.window = {
  speechSynthesis: {
    speak: (utt) => { lastSpokenUtterance = utt; },
    cancel: () => { cancelCalled = true; },
    getVoices: () => mockVoices
  },
  SpeechSynthesisUtterance: function(text) {
    this.text = text;
    this.lang = 'en-US';
    this.rate = 1.0;
    this.pitch = 1.0;
    this.voice = null;
  },
  localStorage: {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); }
  }
};

const browserService = new SpeechSynthService();
assert.strictEqual(browserService.isSupported(), true, 'Mock 浏览器环境下 isSupported 必须为 true');

// 测试清洗与发音调用
cancelCalled = false;
lastSpokenUtterance = null;
const ok = browserService.speak('write (wrote)', 'en-US');
assert.strictEqual(ok, true, '发音调用成功应返回 true');
assert.strictEqual(cancelCalled, true, '每次发音前必须先清空正在播放的音频队列');
assert.strictEqual(lastSpokenUtterance.text, 'write', '发音文本必须自动过滤括号说明');
assert.strictEqual(lastSpokenUtterance.lang, 'en-US', '语言必须与参数一致');
assert.strictEqual(lastSpokenUtterance.voice.lang, 'en-US', '应自动匹配对应的 en-US 声音');

// 测试 speakEntity
cancelCalled = false;
lastSpokenUtterance = null;
const entity = { id: 'v1', title: 'become' };
const spoken = browserService.speakEntity(entity, verbDeck, true);
assert.strictEqual(spoken, true, '语言题库实体应成功触发发音');
assert.strictEqual(lastSpokenUtterance.text, 'become', '应正确朗读实体 title');

// 测试非语言题库拒绝朗读
const nonLangEntity = { id: 'http1', title: '200 OK' };
const nonLangSpoken = browserService.speakEntity(nonLangEntity, httpDeck, true);
assert.strictEqual(nonLangSpoken, false, '非语言题库实体绝不朗读');

// 测试开关切换
assert.strictEqual(browserService.isAutoSpeechEnabled(), true, '初始默认应开启自动发音');
browserService.toggleAutoSpeech();
assert.strictEqual(browserService.isAutoSpeechEnabled(), false, '切换后自动发音应关闭');

// 关闭自动发音时，isAuto 为 true 的调用应直接忽略
const ignored = browserService.speakEntity(entity, verbDeck, true);
assert.strictEqual(ignored, false, '关闭自动发音时自动朗读必须返回 false');

// 手动点播 (isAuto = false) 依然可以朗读
const manualSpoken = browserService.speakEntity(entity, verbDeck, false);
assert.strictEqual(manualSpoken, true, '关闭自动发音时手动点播依然可以朗读');

// 清理 mock
delete global.window;

console.log('✅ speech-synth.test.mjs PASSED!');
