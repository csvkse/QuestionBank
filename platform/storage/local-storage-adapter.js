/**
 * Local Storage Persistence Adapter
 * Core: platform/storage/local-storage-adapter.js
 */

const STORAGE_KEYS = {
  PROFILE: 'verbmaster_player_profile_v2',
  CUSTOM_DECKS: 'verbmaster_user_decks_v2',
  ACTIVE_DECK_ID: 'verbmaster_active_deck_id_v2',
  MASK_STATE: 'verbmaster_study_mask_v2',
  DECK_VERSIONS: 'verbmaster_deck_versions_v2',
  RECYCLE_BIN: 'verbmaster_deck_recycle_bin_v2'
};

export class StorageAdapter {
  _write(key, value) {
    if (this._staged) this._staged.set(key, value);
    else localStorage.setItem(key, value);
  }

  runTransaction(operation) {
    if (this._staged) throw new Error('存储事务已在执行');
    this._staged = new Map();
    const previous = new Map();
    try {
      const result = operation();
      if (typeof localStorage !== 'undefined') {
        for (const key of this._staged.keys()) previous.set(key, localStorage.getItem(key));
        for (const [key, value] of this._staged) localStorage.setItem(key, value);
      }
      return result;
    } catch (error) {
      // Best effort rollback across legacy localStorage keys. A crash between
      // writes is not a transaction; never claim crash-safe exactly-once.
      let restored = true;
      for (const [key, value] of previous) {
        try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
        catch { restored = false; }
      }
      throw new Error(restored ? '保存失败，未完成操作：' + error.message : '保存失败，部分存储恢复失败，请重新载入并检查数据');
    } finally { this._staged = null; }
  }

  loadProfile() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('[Storage] Failed to load profile:', e);
      return null;
    }
  }

  saveProfile(profile) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save profile:', e);
    }
  }

  loadCustomDecks() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_DECKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[Storage] Failed to load custom decks:', e);
      return [];
    }
  }

  saveCustomDecks(decks) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.CUSTOM_DECKS, JSON.stringify(decks));
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save custom decks:', e);
    }
  }

  loadActiveDeckId() {
    try {
      if (typeof localStorage === 'undefined') return 'deck_verbs';
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_DECK_ID) || 'deck_verbs';
    } catch (e) {
      return 'deck_verbs';
    }
  }

  saveActiveDeckId(deckId) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.ACTIVE_DECK_ID, deckId);
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save active deck id:', e);
    }
  }

  loadMaskState() {
    try {
      if (typeof localStorage === 'undefined') return true;
      const val = localStorage.getItem(STORAGE_KEYS.MASK_STATE);
      return val !== null ? JSON.parse(val) : true;
    } catch (e) {
      return true;
    }
  }

  saveMaskState(isMasked) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.MASK_STATE, JSON.stringify(isMasked));
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save mask state:', e);
    }
  }

  loadDeckVersions() {
    try {
      if (typeof localStorage === 'undefined') return {};
      const data = localStorage.getItem(STORAGE_KEYS.DECK_VERSIONS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.warn('[Storage] Failed to load deck versions:', e);
      return {};
    }
  }

  saveDeckVersions(versionsMap) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.DECK_VERSIONS, JSON.stringify(versionsMap));
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save deck versions:', e);
    }
  }

  loadRecycleBin() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEYS.RECYCLE_BIN);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('[Storage] Failed to load recycle bin:', e);
      return [];
    }
  }

  saveRecycleBin(items) {
    try {
      if (typeof localStorage === 'undefined') return;
      this._write(STORAGE_KEYS.RECYCLE_BIN, JSON.stringify(items));
    } catch (e) {
      if (this._staged) throw e;
      console.warn('[Storage] Failed to save recycle bin:', e);
    }
  }
}

export const storageAdapter = new StorageAdapter();
