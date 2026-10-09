/**
 * Quiz Runner & State Machine
 * Core: features/arena/quiz-runner.js
 */

import { generateDistractors } from '../../shared/distractor-sampler.js';
import { calculateNextReview } from '../../shared/sm2-scheduler.js';
import { strategyFactory } from '../../shared/question-strategies/index.js';
import { renderIcon } from '../../design-system/icons/icons.js';
import { isLanguageDeck } from '../../platform/audio/speech-synth.js';

export class QuizRunner {
  constructor(app) {
    this.app = app;
  }

  startSession(mode, queue = [], sessionContext = {}) {
    this.app.currentMode = mode;
    this.app.currentSessionContext = { mode, sessionContext, queue, timestamp: Date.now() };
    this.app.quizQueue = queue.length > 0 ? queue : this.prepareQueue(mode, sessionContext);
    Object.assign(this.app, { currentIndex: 0, sessionCorrect: 0, sessionCombo: 0, maxComboInSession: 0, lives: 3, isAnswerLocked: false });

    if (this.app.quizQueue.length === 0) {
      if (typeof this.app.showModeGuidanceModal === 'function') {
        this.app.showModeGuidanceModal(mode, sessionContext);
      } else {
        alert('当前模式下暂无可考核的词条。');
        this.app.navigate('dashboard');
      }
      return;
    }

    this.app.navigate('arena');
    this.renderHeader();
    this.loadQuestion();
  }

  prepareQueue(mode, sessionContext = {}) {
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck ? deck.id : '');
    const strategy = strategyFactory.getStrategy(mode);
    return strategy.buildQueue({ deck, deckState: ds, options: sessionContext });
  }

  renderHeader() {
    const hpContainer = document.getElementById('arena-hp-container');
    const timerWrap = document.getElementById('arena-timer-bar-wrap');
    const isSpeed = (this.app.currentMode === 'speed' || this.app.currentMode === 'SPEED_SPRINT');

    if (hpContainer) {
      if (isSpeed) {
        hpContainer.classList.remove('hidden');
        let hearts = '';
        for (let i = 0; i < 3; i++) {
          const active = i < this.app.lives;
          hearts += `<span class="w-3.5 h-3.5 rounded-full ${active ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : 'bg-slate-800 border border-slate-700'} inline-block mx-0.5" title="生命值"></span>`;
        }
        hpContainer.innerHTML = hearts;
      } else {
        hpContainer.classList.add('hidden');
      }
    }

    if (timerWrap) {
      if (isSpeed) timerWrap.classList.remove('hidden');
      else timerWrap.classList.add('hidden');
    }

    const comboText = document.getElementById('arena-combo-text');
    if (comboText) comboText.innerText = `${this.app.sessionCombo} Combo`;
  }

  loadQuestion() {
    if (this.app.timerInterval) clearInterval(this.app.timerInterval);
    const drawer = document.getElementById('arena-feedback-drawer');
    if (drawer) drawer.classList.add('hidden');

    const isSpeed = (this.app.currentMode === 'speed' || this.app.currentMode === 'SPEED_SPRINT');
    if (this.app.currentIndex >= this.app.quizQueue.length || (isSpeed && this.app.lives <= 0)) {
      this.finishSession();
      return;
    }

    this.app.isAnswerLocked = false;
    const currentEntity = this.app.quizQueue[this.app.currentIndex];
    const deck = this.app.getActiveDeck();
    const cat = (deck.categories || []).find(c => c.id === currentEntity.categoryId);
    const catName = cat ? cat.name : '核心概念';

    // 更新进度
    const progressText = document.getElementById('arena-progress-text');
    if (progressText) progressText.innerText = `${this.app.currentIndex + 1} / ${this.app.quizQueue.length}`;

    const badge = document.getElementById('arena-target-badge');
    if (badge) badge.innerText = `🏷️ ${catName} · Layer ${currentEntity.layer || 1}`;

    const baseWord = document.getElementById('arena-base-word');
    if (baseWord) baseWord.innerText = currentEntity.title;

    const translation = document.getElementById('arena-translation');
    if (translation) translation.innerText = currentEntity.subtitle || '';

    // 核心答题指令
    const promptText = document.getElementById('arena-prompt-text');
    if (promptText) promptText.innerText = currentEntity.prompt || '请选择最准确的含义或目标对应项：';

    // 语言题库与自动发音联动
    const isLang = isLanguageDeck(deck);
    const btnReplay = document.getElementById('btn-replay-speech');
    const speechToggle = document.getElementById('arena-auto-speech-toggle');
    const shortcutHint = document.getElementById('arena-speech-shortcut-hint');

    if (isLang) {
      if (btnReplay) btnReplay.classList.remove('hidden');
      if (speechToggle) speechToggle.classList.remove('hidden');
      if (shortcutHint) shortcutHint.classList.remove('hidden');
      if (this.app.speechSynth) {
        this.app.speechSynth.speakEntity(currentEntity, deck, true);
      }
    } else {
      if (btnReplay) btnReplay.classList.add('hidden');
      if (speechToggle) speechToggle.classList.add('hidden');
      if (shortcutHint) shortcutHint.classList.add('hidden');
    }

    // 采样干扰项并渲染
    const options = generateDistractors(currentEntity, deck.entities);
    const grid = document.getElementById('arena-options-grid');
    if (grid) {
      grid.innerHTML = '';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-card w-full text-left p-3.5 sm:p-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-indigo-500 text-slate-100 text-sm font-semibold transition flex items-center justify-between group active:scale-[0.98]';
        btn.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-mono text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/50 transition shrink-0">
              ${idx + 1}
            </span>
            <span class="font-mono text-xs sm:text-sm leading-relaxed">${opt}</span>
          </div>
        `;
        btn.onclick = () => this.handleAnswer(opt, btn);
        grid.appendChild(btn);
      });
    }

    // 极速模式倒计时
    if (isSpeed) {
      this.app.timeLeft = 6;
      const bar = document.getElementById('arena-timer-bar');
      if (bar) bar.style.width = '100%';
      this.app.timerInterval = setInterval(() => {
        this.app.timeLeft -= 0.1;
        const pct = Math.max(0, (this.app.timeLeft / 6) * 100);
        if (bar) bar.style.width = `${pct}%`;
        if (this.app.timeLeft <= 0) {
          clearInterval(this.app.timerInterval);
          this.handleAnswer('TIMEOUT', null);
        }
      }, 100);
    }
  }

  handleAnswer(selected, targetBtn) {
    if (this.app.isAnswerLocked) return;
    this.app.isAnswerLocked = true;
    if (this.app.timerInterval) clearInterval(this.app.timerInterval);
    if (this.app.speechSynth) this.app.speechSynth.cancel();

    const currentEntity = this.app.quizQueue[this.app.currentIndex];
    const isCorrect = (selected.trim() === currentEntity.answer.trim());
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);

    // 禁用按键并高亮正确/错误
    const buttons = document.querySelectorAll('#arena-options-grid button');
    buttons.forEach(b => {
      b.disabled = true;
      const optText = (b.querySelector('.font-mono:not(span:first-child)') || b).innerText.trim();
      if (optText === currentEntity.answer) {
        b.classList.remove('bg-slate-800/80', 'border-slate-700');
        b.classList.add('bg-emerald-950/60', 'border-emerald-500', 'text-emerald-200');
      } else if (b === targetBtn && !isCorrect) {
        b.classList.remove('bg-slate-800/80', 'border-slate-700');
        b.classList.add('bg-rose-950/60', 'border-rose-500', 'text-rose-200');
      }
    });

    // 状态与音效
    if (isCorrect) {
      this.app.soundSynth.play('correct');
      this.app.sessionCorrect++;
      this.app.sessionCombo++;
      ds.streak = (ds.streak || 0) + 1;
      this.app.maxComboInSession = Math.max(this.app.maxComboInSession, this.app.sessionCombo);
    } else {
      this.app.soundSynth.play('wrong');
      this.app.sessionCombo = 0;
      ds.streak = 0;
      const cardEl = document.getElementById('arena-card');
      if (cardEl) {
        cardEl.classList.add('shake-anim');
        setTimeout(() => cardEl.classList.remove('shake-anim'), 400);
      }
      const isSpeed = (this.app.currentMode === 'speed' || this.app.currentMode === 'SPEED_SPRINT');
      if (isSpeed) {
        this.app.lives--;
        this.renderHeader();
      }
    }

    // 更新 SM-2 进度
    ds.cards[currentEntity.id] = calculateNextReview(ds.cards[currentEntity.id], isCorrect);
    ds.totalAttempts = (ds.totalAttempts || 0) + 1;
    if (isCorrect) ds.totalCorrect = (ds.totalCorrect || 0) + 1;
    this.app.saveUserData();

    const comboEl = document.getElementById('arena-combo-text');
    if (comboEl) comboEl.innerText = `${this.app.sessionCombo} Combo`;
    const streakEl = document.getElementById('header-streak');
    if (streakEl) streakEl.innerText = ds.streak;

    this.showFeedbackDrawer(isCorrect, currentEntity);
  }

  showFeedbackDrawer(isCorrect, currentEntity) {
    const drawer = document.getElementById('arena-feedback-drawer');
    const icon = document.getElementById('feedback-icon');
    const title = document.getElementById('feedback-title');
    const sub = document.getElementById('feedback-subtitle');
    const ruleExp = document.getElementById('feedback-rule-exp');
    const pitfalls = document.getElementById('feedback-pitfalls');

    if (!drawer) return;
    drawer.classList.remove('hidden');

    if (isCorrect) {
      drawer.className = 'bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-lg';
      if (icon) icon.innerHTML = renderIcon('check', 'w-5 h-5 text-emerald-400');
      if (title) { title.className = 'font-bold text-sm text-emerald-400'; title.innerText = '回答正确！'; }
      if (sub) sub.innerText = `命中目标要点！当前已连续答对 ${this.app.sessionCombo} 题。`;
    } else {
      drawer.className = 'bg-slate-900 border border-rose-500/40 rounded-2xl p-5 shadow-lg';
      if (icon) icon.innerHTML = renderIcon('alertCircle', 'w-5 h-5 text-rose-400');
      if (title) { title.className = 'font-bold text-sm text-rose-400'; title.innerText = `失误！正确答案为：${currentEntity.answer}`; }
      if (sub) sub.innerText = '已将该概念自动归入错题档案，艾宾浩斯复习周期已重置。';
    }

    if (ruleExp) ruleExp.innerText = currentEntity.explanation || '暂无详细解析';
    if (pitfalls) pitfalls.innerText = currentEntity.pitfalls || '暂无易错提醒';
  }

  finishSession() {
    if (this.app.timerInterval) clearInterval(this.app.timerInterval);
    if (this.app.speechSynth) this.app.speechSynth.cancel();

    const isSpeed = (this.app.currentMode === 'speed' || this.app.currentMode === 'SPEED_SPRINT');
    const isDefeated = isSpeed && this.app.lives <= 0;
    this.app.soundSynth.play(isDefeated ? 'wrong' : 'victory');
    this.app.navigate('summary');

    const totalQ = this.app.quizQueue.length;
    const answeredCount = isDefeated ? Math.max(1, this.app.currentIndex) : totalQ;
    const acc = answeredCount > 0 ? Math.round((this.app.sessionCorrect / answeredCount) * 100) : 0;

    const scoreEl = document.getElementById('summary-score');
    const accEl = document.getElementById('summary-acc');
    const comboEl = document.getElementById('summary-combo');
    if (scoreEl) scoreEl.innerText = `${this.app.sessionCorrect} / ${answeredCount}`;
    if (accEl) accEl.innerText = `${acc}%`;
    if (comboEl) comboEl.innerText = this.app.maxComboInSession;

    const icon = document.getElementById('summary-icon');
    const title = document.getElementById('summary-title');
    const sub = document.getElementById('summary-subtitle');

    const evalMap = isDefeated
      ? { icon: 'alertCircle', color: 'text-rose-400', title: '生命耗尽！极速生存结束', sub: `在高压极速生存中坚持答了 ${this.app.currentIndex} 题，达成 ${this.app.maxComboInSession} 连击！继续磨砺条件反射！` }
      : acc >= 90
      ? { icon: 'crown', color: 'text-amber-400', title: '宗师级表现！完美过关！', sub: '该知识图谱的核心脉络已高度内化，已成功沉淀至长效记忆。' }
      : acc >= 70 ? { icon: 'trophy', color: 'text-indigo-400', title: '通关成功！良好熟练度！', sub: '常规考点均已牢牢掌握，少量易错盲区已加入近期艾宾浩斯排程。' }
      : { icon: 'target', color: 'text-slate-400', title: '继续加油！还需多加巩固！', sub: '检测到部分易混淆概念失误，推荐针对性刷题。' };

    if (icon) icon.innerHTML = renderIcon(evalMap.icon, `w-8 h-8 ${evalMap.color}`);
    if (title) title.innerText = evalMap.title;
    if (sub) sub.innerText = evalMap.sub;

    const allowPromo = this.app.currentSessionContext?.sessionContext?.allowPromotion !== false;
    if (allowPromo && this.app.currentMode === 'CAMPAIGN' && this.app.steppedProgress) {
      const promo = this.app.steppedProgress.evaluateTierResult(this.app.sessionCorrect, totalQ);
      if (promo) setTimeout(() => this.app.steppedProgress.showPromotionModal(promo), 500);
    }
  }
}
