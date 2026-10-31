/**
 * Backup Snapshot Validator & Security Sanitizer
 * Core: features/data-management/backup-validator.js
 *
 * Validates v3 and v2 snapshots, verifies content hash integrity,
 * checks cognitive capacity limits, and blocks prototype pollution.
 */

import { canonicalizeJson, computeHash } from './backup-serializer.js';

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

function checkNoPollution(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return true;
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
    return false;
  }
  const keys = Object.getOwnPropertyNames(obj);
  for (const key of keys) {
    if (DANGEROUS_KEYS.includes(key)) return false;
    if (typeof obj[key] === 'object' && obj[key] !== null && !checkNoPollution(obj[key], depth + 1)) {
      return false;
    }
  }
  return true;
}

export async function validateBackup(data, options = {}) {
  const { verifyHash = true, maxSizeBytes = 50 * 1024 * 1024 } = options;

  if (!data || typeof data !== 'object') {
    return { valid: false, error: '备份数据必须是非空 JSON 对象' };
  }

  // 1. 原型污染防御
  if (!checkNoPollution(data)) {
    return { valid: false, error: '检测到非法对象属性定义 (防原型污染触发)' };
  }

  // 2. 体积粗检
  const roughSize = JSON.stringify(data).length;
  if (roughSize > maxSizeBytes) {
    return { valid: false, error: `备份数据超出最大安全体积限制 (${(maxSizeBytes / 1024 / 1024).toFixed(1)}MB)` };
  }

  const schemaVersion = data.schemaVersion || data.version || 2;

  // 3. 校验 v3 格式
  if (schemaVersion === 3) {
    if (!data.snapshotId || typeof data.snapshotId !== 'string') {
      return { valid: false, error: 'v3 备份缺少有效的 snapshotId' };
    }
    if (!data.exportedAt || typeof data.exportedAt !== 'string') {
      return { valid: false, error: 'v3 备份缺少有效的 exportedAt 时间戳' };
    }
    if (!data.payload || typeof data.payload !== 'object') {
      return { valid: false, error: 'v3 备份缺少有效的 payload 数据载荷' };
    }

    const payload = data.payload;
    const customDecks = Array.isArray(payload.customDecks) ? payload.customDecks : [];
    let totalEntities = 0;
    let totalCards = 0;

    for (const deck of customDecks) {
      if (!deck.id || !deck.title) {
        return { valid: false, error: `题库缺少必须的 id 或 title 属性` };
      }
      const entCount = Array.isArray(deck.entities) ? deck.entities.length : 0;
      totalEntities += entCount;
    }

    if (payload.profile?.deckStates) {
      for (const ds of Object.values(payload.profile.deckStates)) {
        if (ds?.cards) {
          totalCards += Object.keys(ds.cards).length;
        }
      }
    }

    // 4. 内容完整性校验
    if (verifyHash && data.contentHash) {
      const canonical = canonicalizeJson(payload);
      const computed = await computeHash(canonical);
      if (computed !== data.contentHash) {
        return {
          valid: false,
          error: `备份内容完整性校验失败 (哈希不匹配，可能存在损坏或篡改)`,
          expectedHash: data.contentHash,
          computedHash: computed
        };
      }
    }

    return {
      valid: true,
      version: 3,
      summary: {
        snapshotId: data.snapshotId,
        workspaceId: data.workspaceId || 'default',
        deviceId: data.deviceId || 'unknown',
        customDeckCount: customDecks.length,
        totalEntities,
        totalCards,
        exportedAt: data.exportedAt
      }
    };
  }

  // 5. 校验兼容 v2 格式
  if (schemaVersion === 2) {
    const customDecks = Array.isArray(data.customDecks) ? data.customDecks : [];
    let totalEntities = 0;
    for (const deck of customDecks) {
      if (!deck.id || !deck.title) {
        return { valid: false, error: 'v2 题库结构无效：缺少 id 或 title' };
      }
      totalEntities += Array.isArray(deck.entities) ? deck.entities.length : 0;
    }

    return {
      valid: true,
      version: 2,
      summary: {
        customDeckCount: customDecks.length,
        totalEntities,
        exportedAt: data.exportedAt || null
      }
    };
  }

  return { valid: false, error: `不支持的备份协议版本: ${schemaVersion}` };
}
