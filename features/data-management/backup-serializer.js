/**
 * v3 Backup Snapshot Serializer & Deterministic Hasher
 * Core: features/data-management/backup-serializer.js
 *
 * Constructs immutable v3 snapshots. Enforces strict boundary:
 * excludes aiConfig, API keys, and local credentials.
 */

export function sanitizePayload(state) {
  const profile = state.profile ? JSON.parse(JSON.stringify(state.profile)) : null;
  const customDecks = Array.isArray(state.customDecks) ? JSON.parse(JSON.stringify(state.customDecks)) : [];
  const deckVersions = state.deckVersions ? JSON.parse(JSON.stringify(state.deckVersions)) : {};
  const recycleBin = Array.isArray(state.recycleBin) ? JSON.parse(JSON.stringify(state.recycleBin)) : [];
  const activeDeckId = state.activeDeckId || 'deck_verbs';
  const maskState = state.maskState !== undefined ? Boolean(state.maskState) : true;

  return {
    profile,
    customDecks,
    deckVersions,
    recycleBin,
    activeDeckId,
    maskState
  };
}

/**
 * Deterministic JSON stringifier (sorts keys recursively)
 */
export function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 hash across browser and Node environments
 */
export async function computeHash(contentStr) {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(contentStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fast DJB2 + FNV1a deterministic fallback if SubtleCrypto unavailable
  let h1 = 0x811c9dc5;
  for (let i = 0; i < contentStr.length; i++) {
    h1 ^= contentStr.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return 'fast-' + (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function createV3Snapshot(options = {}) {
  const {
    workspaceId = 'default',
    deviceId = 'dev_' + Math.random().toString(36).slice(2, 10),
    localRevision = 1,
    parentSnapshotHash = null,
    appVersion = '2.1.0',
    builtinDeckVersions = { deck_verbs: 1, deck_common_sense: 1, deck_computer_basics: 1 },
    state = {}
  } = options;

  const payload = sanitizePayload(state);
  const canonicalPayload = canonicalizeJson(payload);
  const contentHash = await computeHash(canonicalPayload);
  const now = new Date().toISOString();
  const snapshotId = `snap_${Date.now()}_${contentHash.slice(0, 8)}`;

  return {
    schemaVersion: 3,
    workspaceId,
    snapshotId,
    deviceId,
    localRevision,
    parentSnapshotHash,
    contentHash,
    exportedAt: now,
    appVersion,
    builtinDeckVersions,
    payload
  };
}
