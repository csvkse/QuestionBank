/**
 * Learn & Verify Controller
 * Core: features/learn-verify/controller.js
 * 
 * Orchestrates State Machine, Strategies, Adapters, Views, and Audio/SM-2 Integration.
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { LearnVerifyStateMachine, LearnVerifyState } from './state-machine.js';
import { HierarchicalLayerProgressionStrategy, CategoryMasteryProgressionStrategy, SiblingChoiceVerificationStrategy } from './strategies.js';
import { LearnVerifyView } from './view.js';
import { calculateNextReview } from '../../shared/sm2-scheduler.js';
import { isLanguageDeck, speechSynth, getDeckLangCode } from '../../platform/audio/speech-synth.js';

export class LearnVerifyController {
  constructor(app) {
    this.app = app;
    this.view = new LearnVerifyView(app);
    this.stateMachine = null;
    this.strategy = null;
    this.quizStrategy = new SiblingChoiceVerificationStrategy();
    this.currentTier = 1;
    this.selectedOptionIndex = null;
    this.sessionMode = 'HIERARCHICAL';
    this.lastWrongAnswer = null;
    this.bindKeyboardShortcuts();
  }

  bindKeyboardShortcuts() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      if (this.app?.router?.currentView !== 'learn') return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const fsm = this.stateMachine;
      if (!fsm) return;
      const state = fsm.getCurrentState();

      if (state === LearnVerifyState.ENCODING) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.startVerify();
        } else if (e.key === 'p' || e.key === 'P') {
          const node = fsm.getCurrentNode();
          if (node) this.speakWord(node.title);
        }
      } else if (state === LearnVerifyState.VERIFYING) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault();
          this.selectOption(parseInt(e.key, 10) - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.selectedOptionIndex !== null) this.submitAnswer();
        }
      } else if (state === LearnVerifyState.NODE_ADVANCE || state === LearnVerifyState.REMEDIATION) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.proceedNext();
        }
      }
    });
  }

  startHierarchicalSession(layerNum = 1) {
    this.currentTier = layerNum;
    this.sessionMode = 'HIERARCHICAL';
    this.strategy = new HierarchicalLayerProgressionStrategy(layerNum);
    this._initSession();
  }

  startCategorySession(categoryId) {
    this.sessionMode = 'CATEGORY';
    this.strategy = new CategoryMasteryProgressionStrategy(categoryId);
    this._initSession();
  }

  _initSession() {
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    const ds = this.app.getDeckState(deck.id);
    const nodes = this.strategy.prepareNodes(deck, ds);

    if (nodes.length === 0) {
      alert('当前层级或分类下暂无可学习的知识点。');
      return;
    }

    this.selectedOptionIndex = null;
    this.lastWrongAnswer = null;
    this.stateMachine = new LearnVerifyStateMachine({
      nodes,
      onTransition: (t) => this.handleTransition(t)
    });

    this.app.navigate('learn');
    this.stateMachine.start();
  }

  handleTransition({ to, node, payload }) {
    const container = document.getElementById('view-learn');
    if (!container) return;

    const deck = this.app.getActiveDeck();
    const isLang = isLanguageDeck(deck);
    const fsm = this.stateMachine;

    const total = fsm.getTotalInitialCount();
    const completed = fsm.getCompletedCount();
    const accuracy = fsm.getFirstAttemptAccuracy();
    const remaining = fsm.getRemainingCount();
    const progressPercent = Math.min(100, Math.round((completed / Math.max(total, 1)) * 100));
    const progressText = `${completed} / ${total} (余 ${remaining})`;

    if (to === LearnVerifyState.TIER_CHECKPOINT) {
      const canUnlock = this.strategy.canUnlockNextTier({ accuracy });
      container.innerHTML = this.view.renderTierCheckpoint(
        this.currentTier,
        accuracy,
        completed,
        canUnlock,
        () => this.unlockNextTier(),
        () => this.exitSession()
      );
      return;
    }

    const headerHtml = this.view.renderHeader({
      currentTier: this.currentTier,
      progressText,
      progressPercent,
      accuracy,
      categoryName: node ? node.categoryName : '体系考点',
      groupName: node ? node.groupName : '核心大组'
    });

    let bodyHtml = '';
    if (to === LearnVerifyState.ENCODING) {
      this.selectedOptionIndex = null;
      bodyHtml = this.view.renderEncodingCard(node, isLang);
    } else if (to === LearnVerifyState.VERIFYING) {
      bodyHtml = this.view.renderVerificationCard(node, this.selectedOptionIndex);
    } else if (to === LearnVerifyState.NODE_ADVANCE) {
      bodyHtml = this.view.renderSuccessCard(node);
      this._applyCardMasteryUpdate(node, true);
    } else if (to === LearnVerifyState.REMEDIATION) {
      bodyHtml = this.view.renderRemediationCard(node, this.lastWrongAnswer, node.encoding.answer);
      this._applyCardMasteryUpdate(node, false);
    }

    container.innerHTML = `
      <div class="space-y-4 max-w-2xl mx-auto">
        ${headerHtml}
        <div id="learn-verify-card-slot">${bodyHtml}</div>
      </div>
    `;

    // 朗读发音 (仅在进入研读态且启用了语言题库自动发音时)
    if (to === LearnVerifyState.ENCODING && isLang && this.app.isSpeechEnabled) {
      this.speakWord(node.title);
    }
  }

  startVerify() {
    if (!this.stateMachine) return;
    this.selectedOptionIndex = null;
    this.stateMachine.startVerification();
  }

  selectOption(index) {
    this.selectedOptionIndex = index;
    const node = this.stateMachine?.getCurrentNode();
    if (!node) return;
    const slot = document.getElementById('learn-verify-card-slot');
    if (slot) {
      slot.innerHTML = this.view.renderVerificationCard(node, this.selectedOptionIndex);
    }
  }

  submitAnswer() {
    if (this.selectedOptionIndex === null || !this.stateMachine) return;
    const node = this.stateMachine.getCurrentNode();
    if (!node) return;

    const selectedAnswer = node.verification.options[this.selectedOptionIndex];
    const isCorrect = this.quizStrategy.evaluate(selectedAnswer, node.verification.correctAnswer);
    this.lastWrongAnswer = isCorrect ? null : selectedAnswer;

    this.stateMachine.submitAnswer(isCorrect, {
      selectedAnswer,
      selectedIndex: this.selectedOptionIndex
    });
  }

  proceedNext() {
    if (!this.stateMachine) return;
    const state = this.stateMachine.getCurrentState();
    if (state === LearnVerifyState.NODE_ADVANCE) {
      this.stateMachine.proceedFromAdvance();
    } else if (state === LearnVerifyState.REMEDIATION) {
      this.stateMachine.proceedFromRemediation();
    }
  }

  unlockNextTier() {
    if (this.currentTier < 3) {
      this.startHierarchicalSession(this.currentTier + 1);
    } else {
      alert('恭喜！您已全部通关所有认知层级！');
      this.exitSession();
    }
  }

  speakWord(text) {
    if (!text) return;
    if (this.app?.speakWord) {
      this.app.speakWord(text);
    } else {
      const deck = this.app?.getActiveDeck ? this.app.getActiveDeck() : null;
      speechSynth.speak(text, deck ? getDeckLangCode(deck) : 'en-US');
    }
  }

  exitSession() {
    if (this.stateMachine && this.stateMachine.getRemainingCount() > 0) {
      if (!confirm('当前学练会话尚未结束，确定要退出吗？')) return;
    }
    this.stateMachine = null;
    this.app.navigate('study');
  }

  _applyCardMasteryUpdate(node, isCorrect) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;
    const ds = this.app.getDeckState(deck.id);

    // 记录 SM-2 进度
    ds.cards[node.id] = calculateNextReview(ds.cards[node.id], isCorrect);
    ds.totalAttempts = (ds.totalAttempts || 0) + 1;
    if (isCorrect) {
      ds.totalCorrect = (ds.totalCorrect || 0) + 1;
    }

    this.app.saveUserData();
  }
}
