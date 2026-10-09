/**
 * AI Agent Feature Public Entry Point
 * Core 2.1: features/ai-agent/index.js
 */

export { AiAgentUIController } from './agent-ui.js';
export { DECK_TOOL_DEFINITIONS } from './tool-definitions.js';
export { DeckToolExecutor } from './tool-executor.js';
export { SessionStore, DEFAULT_AI_CONFIG } from './session-store.js';
export { REFERENCE_PRESET_PROVIDERS, DEFAULT_PROVIDERS, API_PROTOCOLS } from './provider-presets.js';
export { AiAgentClient } from './client.js';
export { AgentLoopEngine } from './agent-loop.js';
export { renderLoadingState, renderMarkdown } from './agent-templates.js';
