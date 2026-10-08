/**
 * Quiz Runner & State Machine
 * Core: features/arena/quiz-runner.js
 */

import { generateDistractors } from '../../shared/distractor-sampler.js';
import { calculateNextReview } from '../../shared/sm2-scheduler.js';

export class QuizRunner {
  constructor(app) {
    this.app = app;
  }

  startSession(mode, queue = []) {
    this.app.currentMode = mode;
    this.app.quizQueue = queue.length > 0 ? queue : this.prepareQueue(mode);
    this.app.currentIndex = 0;
    this.app.sessionCorrect = 0;
    this.app.sessionCombo = 0;
    this.app.maxComboInSession = 0;
    this.app.lives = 3;
    this.app.isAnswerLocked = false;

    if (this.app.quizQueue.length === 0) {
      alert('🎉 太棒了！当前模式下没有需要复习的词条。');
      this.app.navigate('dashboard');
      return;
    }

    this.app.navigate('arena');
    this.renderHeader();
    this.loadQuestion();
  }

  prepareQueue(mode) {
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);
    const all = deck.entities || [];
    const endOfToday = new Date().setHours(23, 59, 59, 999);

    const norm = (mode || '').toLowerCase();
    if (norm === 'daily' || norm === 'daily_review' || norm === 'ebbinghaus_review') {
      const due = all.filter(e => {
        const c = ds.cards[e.id];
        return c && c.nextReviewAt && c.nextReviewAt <= endOfToday;
      });
      return due.length > 0 ? due.sort(() => Math.random() - 0.5) : all.slice(0, 10);
    } else if (norm === 'weakness' || norm === 'weakness_surge') {
      const weak = all.filter(e => {
        const c = ds.cards[e.id];
        return c && c.wrong > 0 && c.level < 3;
      });
      return weak.length > 0 ? weak.sort(() => Math.random() - 0.5) : all.slice(0, 10);
    } else if (norm === 'ladder' || norm === 'campaign' || norm === 'full_campaign') {
      return [...all].sort((a, b) => a.layer - b.layer).slice(0, 12);
    } else {
      return [...all].sort(() => Math.random() - 0.5).slice(0, 15);
    }
  }

  renderHeader() {
    const hpContainer = document.getElementById('arena-hp-container');
    const timerWrap = document.getElementById('arena-timer-bar-wrap');
    const isSpeed = (this.app.currentMode === 'speed' || this.app.currentMode === 'SPEED_SPRINT');

    if (hpContainer) {
      if (isSpeed) {
        hpContainer.classList.remove('hidden');
        let hearts = '';
        for (let i = 0; i < 3; i++) hearts += (i < this.app.lives ? '❤️' : '🖤');
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

    const promptText = document.getElementById('arena-prompt-text');
    if (promptText) promptText.innerText = currentEntity.prompt || '请选择最准确的含义或目标对应项：';

    // 采样干扰项并渲染
    const options = generateDistractors(currentEntity, deck.entities);
    const grid = document.getElementById('arena-options-grid');
    if (grid) {
      grid.innerHTML = '';
      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left p-3.5 sm:p-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-indigo-500 text-slate-100 text-sm font-semibold transition flex items-center justify-between group active:scale-[0.98]';
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
      if (icon) icon.innerText = '✨';
      if (title) {
        title.className = 'font-bold text-sm text-emerald-400';
        title.innerText = '回答正确！';
      }
      if (sub) sub.innerText = `命中目标要点！当前已连续答对 ${this.app.sessionCombo} 题。`;
    } else {
      drawer.className = 'bg-slate-900 border border-rose-500/40 rounded-2xl p-5 shadow-lg';
      if (icon) icon.innerText = '⚠️';
      if (title) {
        title.className = 'font-bold text-sm text-rose-400';
        title.innerText = `失误！正确答案为：${currentEntity.answer}`;
      }
      if (sub) sub.innerText = '已将该概念自动归入错题档案，艾宾浩斯复习周期已重置。';
    }

    if (ruleExp) ruleExp.innerText = currentEntity.explanation || '暂无详细解析';
    if (pitfalls) pitfalls.innerText = currentEntity.pitfalls || '暂无易错提醒';
  }

  finishSession() {
    if (this.app.timerInterval) clearInterval(this.app.timerInterval);
    this.app.soundSynth.play('victory');
    this.app.navigate('summary');

    const totalQ = this.app.quizQueue.length;
    const acc = totalQ > 0 ? Math.round((this.app.sessionCorrect / totalQ) * 100) : 0;

    const scoreEl = document.getElementById('summary-score');
    const accEl = document.getElementById('summary-acc');
    const comboEl = document.getElementById('summary-combo');
    if (scoreEl) scoreEl.innerText = `${this.app.sessionCorrect} / ${totalQ}`;
    if (accEl) accEl.innerText = `${acc}%`;
    if (comboEl) comboEl.innerText = this.app.maxComboInSession;

    const icon = document.getElementById('summary-icon');
    const title = document.getElementById('summary-title');
    const sub = document.getElementById('summary-subtitle');

    if (acc >= 90) {
      if (icon) icon.innerText = '👑';
      if (title) title.innerText = '宗师级表现！完美过关！';
      if (sub) sub.innerText = '该知识图谱的核心脉络已高度内化，已成功沉淀至长效记忆。';
    } else if (acc >= 70) {
      if (icon) icon.innerText = '🎉';
      if (title) title.innerText = '通关成功！良好熟练度！';
      if (sub) sub.innerText = '常规考点均已牢牢掌握，少量易错盲区已加入近期艾宾浩斯排程。';
    } else {
      if (icon) icon.innerText = '🧗';
      if (title) title.innerText = '继续加油！还需多加巩固！';
      if (sub) sub.innerText = '检测到部分易混淆同胞概念失误，推荐使用【弱点歼灭战】针对性刷题。';
    }
  }
}
