/**
 * Learn & Verify Topic Cluster Controller
 * Core: features/learn-verify/cluster-controller.js
 * 
 * Orchestrates Micro-Topic Capsule State Machine, Views, Interleaved Quizzes, and SM-2 Batching.
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

import { TopicClusterStateMachine, ClusterState } from './cluster-state-machine.js';
import { TaxonomyCapsuleProgressionStrategy } from './cluster-strategies.js';
import { LearnVerifyClusterView } from './cluster-view.js';
import { calculateNextReview } from '../../shared/sm2-scheduler.js';
import { isLanguageDeck, speechSynth, getDeckLangCode } from '../../platform/audio/speech-synth.js';

export class LearnVerifyClusterController {
  constructor(app) {
    this.app = app;
    this.view = new LearnVerifyClusterView(app);
    this.fsm = null;
    this.strategy = null;
    this.currentLayer = 1;
    this.selectedOptionIndex = null;
    this.totalCapsulesCount = 0;
    this.currentCapsuleIndex = 0;
  }

  startCapsuleSession(layerNum = 1) {
    const deck = this.app.getActiveDeck();
    if (!deck) return;

    this.currentLayer = layerNum;
    this.strategy = new TaxonomyCapsuleProgressionStrategy(layerNum);
    const deckState = this.app.getDeckState(deck.id);
    const capsules = this.strategy.prepareCapsules(deck, deckState);

    if (capsules.length === 0) {
      alert('当前层级下暂无可学习的微考点。');
      return;
    }

    this.totalCapsulesCount = capsules.length;
    this.currentCapsuleIndex = 0;
    this.selectedOptionIndex = null;

    this.fsm = new TopicClusterStateMachine({
      capsules,
      onTransition: (state) => this.render(state),
      onCapsuleComplete: (capsule, stats) => this.batchUpdateMastery(capsule, stats)
    });

    this.app.navigate('learn');
    this.fsm.start();
  }

  render(state) {
    const container = document.getElementById('view-learn');
    if (!container) return;

    const deck = this.app.getActiveDeck();
    const isLang = isLanguageDeck(deck);
    const capsule = this.fsm.getCurrentCapsule();

    if (state === ClusterState.SESSION_COMPLETED) {
      alert('🎉 恭喜！您已通关当前全部微考点胶囊！');
      this.exitSession(true);
      return;
    }

    const headerHtml = this.view.renderHeader({
      currentCapsuleIndex: this.currentCapsuleIndex,
      totalCapsules: this.totalCapsulesCount,
      capsule,
      accuracy: 100
    });

    let bodyHtml = '';
    if (state === ClusterState.CAPSULE_ENCODING) {
      this.selectedOptionIndex = null;
      bodyHtml = this.view.renderEncodingMatrixCard(capsule, isLang);
    } else if (state === ClusterState.INTERLEAVED_VERIFYING) {
      const q = this.fsm.getCurrentQuestion();
      const qIndex = this.fsm.currentQuestionIndex;
      const totalQ = capsule.questions.length;
      bodyHtml = this.view.renderInterleavedQuizCard(capsule, q, qIndex, totalQ, this.selectedOptionIndex);
    } else if (state === ClusterState.CAPSULE_EVALUATION) {
      const wrongAnswers = this.fsm.currentQuestionAnswers.filter(a => !a.isCorrect);
      bodyHtml = this.view.renderEvaluationCard(capsule, wrongAnswers);
    } else if (state === ClusterState.CAPSULE_REMEDIATION) {
      const remItem = this.fsm.getCurrentRemediation();
      const currIdx = this.fsm.currentRemediationIndex;
      const totalRem = this.fsm.remediationQueue.length;
      bodyHtml = this.view.renderRemediationCard(remItem, currIdx, totalRem);
    } else if (state === ClusterState.CAPSULE_CHECKPOINT) {
      const hasNext = this.fsm.capsulesQueue.length > 0;
      bodyHtml = this.view.renderCapsuleCheckpoint(capsule, {}, hasNext);
    }

    container.innerHTML = `
      <div class="space-y-4 max-w-2xl mx-auto">
        ${headerHtml}
        <div id="learn-verify-card-slot">${bodyHtml}</div>
      </div>
    `;
  }

  startInterleavedQuiz() {
    if (!this.fsm) return;
    this.selectedOptionIndex = null;
    this.fsm.startInterleavedQuiz();
  }

  selectInterleavedOption(index) {
    this.selectedOptionIndex = index;
    const capsule = this.fsm.getCurrentCapsule();
    const q = this.fsm.getCurrentQuestion();
    const slot = document.getElementById('learn-verify-card-slot');
    if (slot && capsule && q) {
      slot.innerHTML = this.view.renderInterleavedQuizCard(
        capsule,
        q,
        this.fsm.currentQuestionIndex,
        capsule.questions.length,
        this.selectedOptionIndex
      );
    }
  }

  submitInterleavedOption() {
    if (this.selectedOptionIndex === null || !this.fsm) return;
    const idx = this.selectedOptionIndex;
    this.selectedOptionIndex = null;
    this.fsm.submitInterleavedAnswer(idx);
  }

  startRemediation() {
    if (!this.fsm) return;
    this.fsm.startRemediation();
  }

  resolveRemediationStep() {
    if (!this.fsm) return;
    this.fsm.resolveRemediationStep();
  }

  advanceToCheckpoint() {
    if (!this.fsm) return;
    this.fsm.advanceToCheckpoint();
  }

  nextCapsule() {
    if (!this.fsm) return;
    this.currentCapsuleIndex++;
    this.selectedOptionIndex = null;
    this.fsm.nextCapsule();
  }

  batchUpdateMastery(capsule, stats) {
    const deck = this.app.getActiveDeck();
    if (!deck || !capsule) return;
    const ds = this.app.getDeckState(deck.id);

    const answersMap = new Map();
    stats.answers.forEach(a => answersMap.set(a.targetEntityId, a.isCorrect));

    capsule.entities.forEach(ent => {
      const isCorrect = answersMap.has(ent.id) ? answersMap.get(ent.id) : true;
      ds.cards[ent.id] = calculateNextReview(ds.cards[ent.id], isCorrect);
      ds.totalAttempts = (ds.totalAttempts || 0) + 1;
      if (isCorrect) {
        ds.totalCorrect = (ds.totalCorrect || 0) + 1;
      }
    });

    this.app.saveUserData();
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

  exitSession(force = false) {
    if (!force && this.fsm && this.fsm.capsulesQueue.length > 0) {
      if (!confirm('当前微考点学练尚未结束，确定退出吗？')) return;
    }
    this.fsm = null;
    this.app.navigate('study');
  }
}
