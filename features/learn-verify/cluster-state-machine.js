/**
 * Learn & Verify Topic Cluster Finite State Machine
 * Core: features/learn-verify/cluster-state-machine.js
 * 
 * Manages the deterministic lifecycle of a Micro-Topic Capsule Session:
 * IDLE -> CAPSULE_ENCODING -> INTERLEAVED_VERIFYING -> CAPSULE_EVALUATION 
 *      -> (CAPSULE_REMEDIATION) -> CAPSULE_CHECKPOINT -> NEXT_CAPSULE / SESSION_COMPLETED
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
 */

export const ClusterState = {
  IDLE: 'IDLE',
  CAPSULE_ENCODING: 'CAPSULE_ENCODING',
  INTERLEAVED_VERIFYING: 'INTERLEAVED_VERIFYING',
  CAPSULE_EVALUATION: 'CAPSULE_EVALUATION',
  CAPSULE_REMEDIATION: 'CAPSULE_REMEDIATION',
  CAPSULE_CHECKPOINT: 'CAPSULE_CHECKPOINT',
  SESSION_COMPLETED: 'SESSION_COMPLETED'
};

export class TopicClusterStateMachine {
  constructor({ capsules = [], onTransition = () => {}, onCapsuleComplete = () => {} } = {}) {
    this.capsulesQueue = [...capsules];
    this.completedCapsules = [];
    this.currentCapsule = null;
    this.state = ClusterState.IDLE;
    this.currentQuestionIndex = 0;
    this.currentQuestionAnswers = [];
    this.remediationQueue = [];
    this.currentRemediationIndex = 0;
    this.overallStats = {
      totalQuestions: 0,
      totalCorrect: 0,
      capsulesCount: capsules.length
    };
    this.onTransition = onTransition;
    this.onCapsuleComplete = onCapsuleComplete;
  }

  getCurrentState() {
    return this.state;
  }

  getCurrentCapsule() {
    return this.currentCapsule;
  }

  getCurrentQuestion() {
    if (!this.currentCapsule || !this.currentCapsule.questions) return null;
    return this.currentCapsule.questions[this.currentQuestionIndex] || null;
  }

  getCurrentRemediation() {
    return this.remediationQueue[this.currentRemediationIndex] || null;
  }

  start() {
    if (this.capsulesQueue.length === 0) {
      this.state = ClusterState.SESSION_COMPLETED;
      this.onTransition(this.state);
      return;
    }
    this.currentCapsule = this.capsulesQueue.shift();
    this.state = ClusterState.CAPSULE_ENCODING;
    this.onTransition(this.state);
  }

  startInterleavedQuiz() {
    if (this.state !== ClusterState.CAPSULE_ENCODING) {
      throw new Error(`Illegal state transition to quiz from ${this.state}`);
    }
    this.state = ClusterState.INTERLEAVED_VERIFYING;
    this.currentQuestionIndex = 0;
    this.currentQuestionAnswers = [];
    this.onTransition(this.state);
  }

  submitInterleavedAnswer(selectedIndex) {
    if (this.state !== ClusterState.INTERLEAVED_VERIFYING) {
      throw new Error(`Cannot submit quiz in state ${this.state}`);
    }
    const q = this.getCurrentQuestion();
    if (!q) throw new Error('No active question to submit');

    const isCorrect = selectedIndex === q.correctIndex;
    const answerRecord = {
      questionId: q.id,
      targetEntityId: q.targetEntityId,
      targetTitle: q.targetTitle,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect,
      chosenText: q.options[selectedIndex] || '',
      correctAnswer: q.correctAnswer
    };
    this.currentQuestionAnswers.push(answerRecord);

    this.overallStats.totalQuestions++;
    if (isCorrect) this.overallStats.totalCorrect++;

    // 判断题组是否全部作答完毕
    if (this.currentQuestionIndex + 1 < this.currentCapsule.questions.length) {
      this.currentQuestionIndex++;
      this.onTransition(this.state);
      return { hasNext: true, record: answerRecord };
    }

    // 全部作答完成，进入结算会诊
    return this._evaluateCapsuleResults();
  }

  _evaluateCapsuleResults() {
    this.state = ClusterState.CAPSULE_EVALUATION;
    const wrongAnswers = this.currentQuestionAnswers.filter(a => !a.isCorrect);

    if (wrongAnswers.length > 0) {
      this.remediationQueue = wrongAnswers.map(w => {
        const entity = this.currentCapsule.entities.find(e => e.id === w.targetEntityId) || {};
        return {
          ...w,
          entity,
          explanation: entity.explanation || '',
          anchor: entity.anchor || '',
          pitfall: entity.pitfalls || '注意审视核心区别'
        };
      });
      this.currentRemediationIndex = 0;
    } else {
      this.remediationQueue = [];
    }

    this.onTransition(this.state);
    return { hasNext: false, wrongCount: wrongAnswers.length };
  }

  startRemediation() {
    if (this.state !== ClusterState.CAPSULE_EVALUATION || this.remediationQueue.length === 0) {
      return this.advanceToCheckpoint();
    }
    this.state = ClusterState.CAPSULE_REMEDIATION;
    this.currentRemediationIndex = 0;
    this.onTransition(this.state);
  }

  resolveRemediationStep() {
    if (this.state !== ClusterState.CAPSULE_REMEDIATION) return;
    if (this.currentRemediationIndex + 1 < this.remediationQueue.length) {
      this.currentRemediationIndex++;
      this.onTransition(this.state);
    } else {
      this.advanceToCheckpoint();
    }
  }

  advanceToCheckpoint() {
    this.state = ClusterState.CAPSULE_CHECKPOINT;
    const correctCount = this.currentQuestionAnswers.filter(a => a.isCorrect).length;
    const totalCount = this.currentQuestionAnswers.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 100;

    const capsuleStats = {
      capsule: this.currentCapsule,
      accuracy,
      correctCount,
      totalCount,
      answers: this.currentQuestionAnswers
    };

    this.completedCapsules.push(this.currentCapsule);
    this.onCapsuleComplete(this.currentCapsule, capsuleStats);
    this.onTransition(this.state);
  }

  nextCapsule() {
    if (this.capsulesQueue.length > 0) {
      this.currentCapsule = this.capsulesQueue.shift();
      this.currentQuestionIndex = 0;
      this.currentQuestionAnswers = [];
      this.remediationQueue = [];
      this.state = ClusterState.CAPSULE_ENCODING;
      this.onTransition(this.state);
    } else {
      this.currentCapsule = null;
      this.state = ClusterState.SESSION_COMPLETED;
      this.onTransition(this.state);
    }
  }
}
