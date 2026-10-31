/**
 * Data Sync & Remote Backup Coordinator
 * Core: features/data-management/data-sync-manager.js
 *
 * Coordinates remote storage adapter creation, connection probing,
 * v3 snapshot backups to WebDAV, remote snapshot listing, and safe restoration.
 */

import { createRemoteAdapter } from '../../platform/storage/remote/index.js';
import { createV3Snapshot } from './backup-serializer.js';
import { validateBackup } from './backup-validator.js';

const CONFIG_STORAGE_KEY = 'verbmaster_remote_storage_config_v1';
const ROLLBACK_SNAPSHOT_KEY = 'verbmaster_rollback_snapshot_v3';

export class DataSyncManager {
  constructor(options = {}) {
    this.storage = options.storage || null;
    this.deviceId = this._loadOrCreateDeviceId();
    this.config = this.loadConfig();
    this._adapter = null;
  }

  _loadOrCreateDeviceId() {
    try {
      if (typeof localStorage !== 'undefined') {
        let id = localStorage.getItem('verbmaster_device_id_v1');
        if (!id) {
          id = 'dev_' + Math.random().toString(36).slice(2, 10);
          localStorage.setItem('verbmaster_device_id_v1', id);
        }
        return id;
      }
    } catch {}
    return 'dev_' + Math.random().toString(36).slice(2, 10);
  }

  loadConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return {
      provider: 'webdav',
      endpoint: '',
      username: '',
      password: '',
      basePath: '',
      workspaceId: 'default'
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this._adapter = null; // 重置适配器实例
    try {
      if (typeof localStorage !== 'undefined') {
        // 安全保存：可选项保存密码，如需脱敏可排除
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch {}
    return this.config;
  }

  getAdapter() {
    if (!this._adapter) {
      this._adapter = createRemoteAdapter(this.config);
    }
    return this._adapter;
  }

  async testConnection(signal) {
    const adapter = this.getAdapter();
    return await adapter.probe(signal);
  }

  async createBackup(stateSnapshot, options = {}) {
    const { writeScheduler = null, localRevision = 1 } = options;

    if (writeScheduler && typeof writeScheduler.flush === 'function') {
      writeScheduler.flush(stateSnapshot);
    }

    const state = typeof stateSnapshot === 'function' ? stateSnapshot() : stateSnapshot;
    const snapshot = await createV3Snapshot({
      workspaceId: this.config.workspaceId || 'default',
      deviceId: this.deviceId,
      localRevision,
      state
    });

    const basePath = (this.config.basePath || '').trim().replace(/^\/+|\/+$/g, '');
    const ws = (this.config.workspaceId || 'default').trim().replace(/^\/+|\/+$/g, '');
    const relParts = [basePath, ws, 'backups', this.deviceId, `${snapshot.snapshotId}.json`].filter(Boolean);
    const path = relParts.join('/');

    const adapter = this.getAdapter();
    const putRes = await adapter.put(path, snapshot, {
      ifNoneMatch: '*'
    });

    return {
      success: true,
      snapshotId: snapshot.snapshotId,
      contentHash: snapshot.contentHash,
      path,
      etag: putRes?.etag || null,
      exportedAt: snapshot.exportedAt
    };
  }

  async listBackups(signal) {
    const adapter = this.getAdapter();
    const basePath = (this.config.basePath || '').trim().replace(/^\/+|\/+$/g, '');
    const ws = (this.config.workspaceId || 'default').trim().replace(/^\/+|\/+$/g, '');
    const prefixParts = [basePath, ws, 'backups'].filter(Boolean);
    const prefix = prefixParts.length > 0 ? `${prefixParts.join('/')}/` : '';

    const items = await adapter.list(prefix, signal);
    let allFileItems = items.filter(it => it.path.endsWith('.json') && !it.isDirectory);

    // 针对分层存储结构：检查是否包含设备子文件夹 (如 dev_xxx/) 并拉取
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    const subDirs = items.filter(it => it.isDirectory && it.path && it.path !== cleanPrefix);
    for (const dir of subDirs) {
      try {
        const dirPrefix = dir.path.endsWith('/') ? dir.path : `${dir.path}/`;
        const subItems = await adapter.list(dirPrefix, signal);
        const subFiles = subItems.filter(it => it.path.endsWith('.json') && !it.isDirectory);
        allFileItems.push(...subFiles);
      } catch (e) {
        console.warn('读取设备备份子目录失败:', dir.path, e);
      }
    }

    const backups = allFileItems.map(it => {
      const fullPath = (basePath && !it.path.startsWith(basePath + '/'))
        ? `${basePath}/${it.path}`
        : it.path;
      return { ...it, path: fullPath };
    });

    backups.sort((a, b) => {
      const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return timeB - timeA;
    });

    return backups;
  }

  async restoreBackup(remotePath, targetStorage = null) {
    const storage = targetStorage || this.storage;
    if (!storage) {
      throw new Error('未提供有效的存储目标以执行恢复');
    }

    const adapter = this.getAdapter();
    const getRes = await adapter.get(remotePath);
    let data;
    try {
      data = JSON.parse(getRes.bytes);
    } catch {
      throw new Error('远端备份文件损坏：无法解析为有效 JSON');
    }

    const validation = await validateBackup(data);
    if (!validation.valid) {
      throw new Error(`备份校验失败: ${validation.error}`);
    }

    // 1. 创建本地回滚恢复点
    this._createRollbackSafetyPoint(storage);

    // 2. 原子应用数据载荷
    const payload = validation.version === 3 ? data.payload : {
      profile: data.profile,
      customDecks: data.customDecks,
      activeDeckId: data.activeDeckId,
      maskState: data.maskState
    };

    if (payload.profile && storage.saveProfile) {
      storage.saveProfile(payload.profile);
    }
    if (payload.customDecks && storage.saveCustomDecks) {
      storage.saveCustomDecks(payload.customDecks);
    }
    if (payload.activeDeckId && storage.saveActiveDeckId) {
      storage.saveActiveDeckId(payload.activeDeckId);
    }
    if (payload.maskState !== undefined && storage.saveMaskState) {
      storage.saveMaskState(payload.maskState);
    }
    if (payload.deckVersions && storage.saveDeckVersions) {
      storage.saveDeckVersions(payload.deckVersions);
    }
    if (payload.recycleBin && storage.saveRecycleBin) {
      storage.saveRecycleBin(payload.recycleBin);
    }

    return {
      success: true,
      version: validation.version,
      summary: validation.summary,
      payload
    };
  }

  _createRollbackSafetyPoint(storage) {
    try {
      const rollbackPoint = {
        createdAt: new Date().toISOString(),
        profile: storage.loadProfile ? storage.loadProfile() : null,
        customDecks: storage.loadCustomDecks ? storage.loadCustomDecks() : [],
        activeDeckId: storage.loadActiveDeckId ? storage.loadActiveDeckId() : 'deck_verbs',
        maskState: storage.loadMaskState ? storage.loadMaskState() : true,
        deckVersions: storage.loadDeckVersions ? storage.loadDeckVersions() : {},
        recycleBin: storage.loadRecycleBin ? storage.loadRecycleBin() : []
      };
      this._lastRollbackPoint = rollbackPoint;
      try {
        if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
          localStorage.setItem(ROLLBACK_SNAPSHOT_KEY, JSON.stringify(rollbackPoint));
        }
      } catch {}
    } catch (e) {
      console.warn('[SyncManager] Failed to create rollback safety point:', e);
    }
  }

  getRollbackSafetyPoint() {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const raw = localStorage.getItem(ROLLBACK_SNAPSHOT_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return this._lastRollbackPoint || null;
  }
}
