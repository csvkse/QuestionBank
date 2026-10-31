/**
 * Data Management Feature Public Entry
 * Core: features/data-management/index.js
 */

export { createV3Snapshot, computeHash, canonicalizeJson, sanitizePayload } from './backup-serializer.js';
export { validateBackup } from './backup-validator.js';
export { DataSyncManager } from './data-sync-manager.js';
