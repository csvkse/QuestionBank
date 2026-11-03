/**
 * Learn & Verify Feature Public Entry Point
 * Core: features/learn-verify/index.js
 * 
 * Strict compliance with FE-STRUCT-002 (Feature Public Entry Boundary).
 */

export { LearnVerifyController } from './controller.js';
export { LearnVerifyStateMachine, LearnVerifyState } from './state-machine.js';
export { LearnVerifyNodeAdapter } from './adapters.js';
export {
  HierarchicalLayerProgressionStrategy,
  CategoryMasteryProgressionStrategy,
  SiblingChoiceVerificationStrategy,
  ActiveSpellingVerificationStrategy
} from './strategies.js';
export { LearnVerifyView } from './view.js';
