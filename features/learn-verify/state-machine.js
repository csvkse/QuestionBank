/**
 * Learn & Verify Finite State Machine
 * Core: features/learn-verify/state-machine.js
 * 
 * Manages the deterministic lifecycle of a learn-and-verify session:
 * IDLE -> ENCODING -> VERIFYING -> EVALUATING -> (SUCCESS | REMEDIATION) -> NODE_ADVANCE -> TIER_CHECKPOINT -> COMPLETED
 */

export const LearnVerifyState = {
  IDLE: 'IDLE',
  ENCODING: 'ENCODING',
  VERIFYING: 'VERIFYING',
  EVALUATING: 'EVALUATING',
  REMEDIATION: 'REMEDIATION',
  NODE_ADVANCE: 'NODE_ADVANCE',
  TIER_CHECKPOINT: 'TIER_CHECKPOINT',
  COMPLETED: 'COMPLETED'
};

export class LearnVerifyStateMachine {
  constructor({ nodes = [], onTransition = () => {} }) {
    this.state = LearnVerifyState.IDLE;
    this.primaryQueue = [...nodes];
    this.retryQueue = [];
    this.currentNode = null;
    this.completedNodes = [];
    this.firstAttemptStats = {
      correct: 0,
      wrong: 0,
      totalInitial: nodes.length
    };
    this.seenInCurrentSession = new Set();
    this.onTransition = onTransition;
  }

  getCurrentState() {
    return this.state;
  }

  getCurrentNode() {
    return this.currentNode;
  }

  getRemainingCount() {
    const currentCount = this.currentNode ? 1 : 0;
    return this.primaryQueue.length + this.retryQueue.length + currentCount;
  }

  getTotalInitialCount() {
    return this.firstAttemptStats.totalInitial;
  }

  getCompletedCount() {
    return this.completedNodes.length;
  }

  getFirstAttemptAccuracy() {
    const total = this.firstAttemptStats.correct + this.firstAttemptStats.wrong;
    if (total === 0) return 100;
    return Math.round((this.firstAttemptStats.correct / total) * 100);
  }

  start() {
    if (this.state !== LearnVerifyState.IDLE) {
      throw new Error(`[FSM] Cannot start session from state: ${this.state}`);
    }
    this._loadNextNode();
  }

  _loadNextNode() {
    if (this.primaryQueue.length > 0) {
      this.currentNode = this.primaryQueue.shift();
    } else if (this.retryQueue.length > 0) {
      this.currentNode = this.retryQueue.shift();
    } else {
      this.currentNode = null;
      this._changeState(LearnVerifyState.TIER_CHECKPOINT, { reason: 'ALL_NODES_CLEARED' });
      return;
    }

    this._changeState(LearnVerifyState.ENCODING, { node: this.currentNode });
  }

  startVerification() {
    if (this.state !== LearnVerifyState.ENCODING) {
      throw new Error(`[FSM] Illegal startVerification from state: ${this.state}`);
    }
    this._changeState(LearnVerifyState.VERIFYING, { node: this.currentNode });
  }

  submitAnswer(isCorrect, answerPayload = {}) {
    if (this.state !== LearnVerifyState.VERIFYING) {
      throw new Error(`[FSM] Illegal submitAnswer from state: ${this.state}`);
    }

    this._changeState(LearnVerifyState.EVALUATING, { isCorrect, answerPayload });

    const isFirstEncounter = !this.seenInCurrentSession.has(this.currentNode.id);
    if (isFirstEncounter) {
      this.seenInCurrentSession.add(this.currentNode.id);
      if (isCorrect) {
        this.firstAttemptStats.correct++;
      } else {
        this.firstAttemptStats.wrong++;
      }
    }

    if (isCorrect) {
      this.completedNodes.push(this.currentNode);
      this._changeState(LearnVerifyState.NODE_ADVANCE, {
        node: this.currentNode,
        isFirstAttempt: isFirstEncounter,
        accuracy: this.getFirstAttemptAccuracy()
      });
    } else {
      // 错题推入本轮重测队列末尾
      this.retryQueue.push(this.currentNode);
      this._changeState(LearnVerifyState.REMEDIATION, {
        node: this.currentNode,
        wrongAnswer: answerPayload.selectedAnswer,
        correctAnswer: this.currentNode.encoding.answer,
        retryQueueLength: this.retryQueue.length
      });
    }
  }

  proceedFromRemediation() {
    if (this.state !== LearnVerifyState.REMEDIATION) {
      throw new Error(`[FSM] Illegal proceedFromRemediation from state: ${this.state}`);
    }
    this._loadNextNode();
  }

  proceedFromAdvance() {
    if (this.state !== LearnVerifyState.NODE_ADVANCE) {
      throw new Error(`[FSM] Illegal proceedFromAdvance from state: ${this.state}`);
    }
    this._loadNextNode();
  }

  completeSession() {
    this._changeState(LearnVerifyState.COMPLETED, {
      completedCount: this.completedNodes.length,
      accuracy: this.getFirstAttemptAccuracy()
    });
  }

  _changeState(nextState, payload = {}) {
    const prevState = this.state;
    this.state = nextState;
    this.onTransition({
      from: prevState,
      to: nextState,
      node: this.currentNode,
      payload
    });
  }
}
