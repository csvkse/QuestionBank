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
    this.app.isAnswerLocked = false;

    if (this.app.quizQueue.length === 0) {
      alert('🎉 太棒了！当前模式下没有需要复习的词条。');
      this.app.navigate('study');
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

    if (mode === 'EBBINGHAUS_REVIEW') {
      const due = all.filter(e => {
        const c = ds.cards[e.id];
        return c && c.nextReviewAt && c.nextReviewAt <= endOfToday;
      });
      return due.length > 0 ? due.sort(() => Math.random() - 0.5) : all.slice(0, 10);
    } else if (mode === 'WEAKNESS_SURGE') {
      const weak = all.filter(e => {
        const c = ds.cards[e.id];
        return c && c.wrong > 0 && c.level < 3;
      });
      return weak.length > 0 ? weak.sort(() => Math.random() - 0.5) : all.slice(0, 10);
    } else {
      return [...all].sort(() => Math.random() - 0.5);
    }
  }

  renderHeader() {
    const modeBadge = document.getElementById('arena-mode-badge');
    const deckBadge = document.getElementById('arena-deck-badge');
    const deck = this.app.getActiveDeck();

    if (deckBadge) deckBadge.innerText = `${deck.icon} ${deck.title}`;
    if (modeBadge) {
      const modeNames = {
        'EBBINGHAUS_REVIEW': '🧠 艾宾浩斯复习',
        'WEAKNESS_SURGE': '🎯 弱点专攻',
        'FULL_CAMPAIGN': '⚔️ 全量远征',
        'CATEGORY_DRILL': '⚡ 专项突破'
      };
      modeBadge.innerText = modeNames[this.app.currentMode] || '⚔️ 答题竞技场';
    }
  }

  loadQuestion() {
    if (this.app.currentIndex >= this.app.quizQueue.length) {
      this.finishSession();
      return;
    }

    this.app.isAnswerLocked = false;
    const currentEntity = this.app.quizQueue[this.app.currentIndex];
    const deck = this.app.getActiveDeck();

    // 更新进度条
    const progressFill = document.getElementById('arena-progress-fill');
    const progressText = document.getElementById('arena-progress-text');
    const pct = Math.round(((this.app.currentIndex) / this.app.quizQueue.length) * 100);
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressText) progressText.innerText = `${this.app.currentIndex + 1} / ${this.app.quizQueue.length}`;

    // 渲染题目头部与提示
    const titleEl = document.getElementById('question-target-title');
    const subtitleEl = document.getElementById('question-target-subtitle');
    const promptEl = document.getElementById('question-prompt-text');
    const categoryEl = document.getElementById('question-category-tag');

    if (titleEl) titleEl.innerText = currentEntity.title;
    if (subtitleEl) subtitleEl.innerText = currentEntity.subtitle || '';
    if (promptEl) promptEl.innerText = currentEntity.prompt || '请选择正确变形 / 含义对应：';

    const cat = deck.categories.find(c => c.id === currentEntity.categoryId);
    if (categoryEl) {
      categoryEl.innerText = cat ? `${cat.group ? cat.group + ' • ' : ''}${cat.name} (L${currentEntity.layer})` : `L${currentEntity.layer}`;
    }

    // 隐藏上一次的反馈面板
    const feedbackBox = document.getElementById('answer-feedback-box');
    if (feedbackBox) feedbackBox.classList.add('hidden');

    // 生成选项
    const options = generateDistractors(currentEntity, deck.entities);
    const optionsContainer = document.getElementById('arena-options-container');
    if (optionsContainer) {
      const keys = ['A', 'B', 'C', 'D'];
      let html = '';
      options.forEach((opt, idx) => {
        const key = keys[idx] || (idx + 1);
        html += `
          <button onclick="app.submitAnswer('${opt.replace(/'/g, "\\'")}', this)" class="option-card w-full p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/80 text-left transition flex items-center justify-between group shadow-sm">
            <div class="flex items-center gap-3">
              <span class="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-indigo-600/30 text-indigo-400 font-mono text-xs font-bold flex items-center justify-center border border-slate-700 transition">
                ${key}
              </span>
              <span class="text-white font-mono text-sm sm:text-base font-bold tracking-wide">${opt}</span>
            </div>
            <span class="text-slate-500 group-hover:text-indigo-400 text-xs transition">回车/点击 &rarr;</span>
          </button>
        `;
      });
      optionsContainer.innerHTML = html;
    }
  }

  handleAnswer(selected, targetBtn) {
    if (this.app.isAnswerLocked) return;
    this.app.isAnswerLocked = true;

    const currentEntity = this.app.quizQueue[this.app.currentIndex];
    const isCorrect = (selected.trim() === currentEntity.answer.trim());
    const deck = this.app.getActiveDeck();
    const ds = this.app.getDeckState(deck.id);

    // 更新 SM-2 进度
    ds.cards[currentEntity.id] = calculateNextReview(ds.cards[currentEntity.id], isCorrect);
    ds.totalAttempts = (ds.totalAttempts || 0) + 1;
    if (isCorrect) ds.totalCorrect = (ds.totalCorrect || 0) + 1;
    this.app.saveUserData();

    // 视觉与音频反馈
    const feedbackBox = document.getElementById('answer-feedback-box');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackExp = document.getElementById('feedback-explanation');
    const feedbackPitfall = document.getElementById('feedback-pitfall');

    if (isCorrect) {
      this.app.sessionCorrect++;
      this.app.sessionCombo++;
      this.app.maxComboInSession = Math.max(this.app.maxComboInSession, this.app.sessionCombo);
      this.app.soundSynth.play('correct');

      if (targetBtn) {
        targetBtn.classList.remove('bg-slate-900/90', 'border-slate-800');
        targetBtn.classList.add('bg-emerald-950/40', 'border-emerald-500', 'text-emerald-300');
      }

      if (this.app.sessionCombo >= 3) {
        this.app.comboController.triggerComboAnimation(this.app.sessionCombo);
      }
    } else {
      this.app.sessionCombo = 0;
      this.app.soundSynth.play('wrong');

      if (targetBtn) {
        targetBtn.classList.remove('bg-slate-900/90', 'border-slate-800');
        targetBtn.classList.add('bg-rose-950/40', 'border-rose-500', 'text-rose-300');
      }
    }

    // 展开解析卡片
    if (feedbackBox) {
      feedbackBox.classList.remove('hidden');
      if (feedbackTitle) {
        feedbackTitle.innerHTML = isCorrect 
          ? `<span class="text-emerald-400 font-bold flex items-center gap-1.5">✅ 回答正确！Combo: ${this.app.sessionCombo}</span>`
          : `<span class="text-rose-400 font-bold flex items-center gap-1.5">❌ 回答错误！正确答案：<span class="underline font-mono">${currentEntity.answer}</span></span>`;
      }
      if (feedbackExp) feedbackExp.innerText = currentEntity.explanation || '';
      if (feedbackPitfall) {
        if (currentEntity.pitfalls) {
          feedbackPitfall.classList.remove('hidden');
          feedbackPitfall.innerText = `⚠️ 避坑提醒: ${currentEntity.pitfalls}`;
        } else {
          feedbackPitfall.classList.add('hidden');
        }
      }
    }

    // 自动或按键进入下一题
    setTimeout(() => {
      this.app.currentIndex++;
      this.loadQuestion();
    }, isCorrect ? 1000 : 2200);
  }

  finishSession() {
    this.app.soundSynth.play('victory');
    const accuracy = Math.round((this.app.sessionCorrect / this.app.quizQueue.length) * 100);
    alert(`🎉 恭喜完成本轮练习！\n\n• 正确率: ${accuracy}% (${this.app.sessionCorrect}/${this.app.quizQueue.length})\n• 最高连击: ${this.app.maxComboInSession} Combo\n• 记忆数据已根据艾宾浩斯曲线自动排程！`);
    this.app.navigate('study');
  }
}
