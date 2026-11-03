/**
 * Learn & Verify Feature Public Entry Point
 * Core: features/learn-verify/index.js
 * 
 * Strict compliance with FE-STRUCT-002 (Feature Public Entry Boundary).
 */

export { LearnVerifyController } from './controller.js';
export { LearnVerifyClusterController } from './cluster-controller.js';
export { LearnVerifyStateMachine, LearnVerifyState } from './state-machine.js';
export { TopicClusterStateMachine, ClusterState } from './cluster-state-machine.js';
export { LearnVerifyNodeAdapter } from './adapters.js';
export { TopicCapsuleAdapter, KnowledgeCapsule } from './cluster-adapters.js';
export {
  HierarchicalLayerProgressionStrategy,
  CategoryMasteryProgressionStrategy,
  SiblingChoiceVerificationStrategy,
  ActiveSpellingVerificationStrategy
} from './strategies.js';
export {
  TaxonomyCapsuleProgressionStrategy,
  InterleavedClusterQuizStrategy
} from './cluster-strategies.js';
export { LearnVerifyView } from './view.js';
export { LearnVerifyClusterView } from './cluster-view.js';
