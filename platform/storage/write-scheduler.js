/**
 * Write Scheduling & Coalescing Coordinator
 * Core: platform/storage/write-scheduler.js
 *
 * Implements domain-based dirty tracking, write coalescing with debounce & maxWait,
 * and eliminates duplicate serialization/writes for unchanged domains.
 */

export const STORAGE_DOMAINS = {
  PROFILE: 'profile',
  CUSTOM_DECKS: 'customDecks',
  ACTIVE_DECK_ID: 'activeDeckId',
  MASK_STATE: 'maskState',
  DECK_VERSIONS: 'deckVersions',
  RECYCLE_BIN: 'recycleBin'
};

export class WriteScheduler {
  constructor(storageAdapter, options = {}) {
    this.storage = storageAdapter;
    this.debounceMs = options.debounceMs ?? 150;
    this.maxWaitMs = options.maxWaitMs ?? 1500;

    this.dirtyDomains = new Set();
    this.domainRevisions = {
      profile: 0,
      customDecks: 0,
      activeDeckId: 0,
      maskState: 0,
      deckVersions: 0,
      recycleBin: 0
    };
    this.globalRevision = 0;

    this._debounceTimer = null;
    this._firstScheduledAt = null;
    this._isWriting = false;
    this._pendingResolve = null;

    this.metrics = {
      requestedSaves: 0,
      committedWrites: 0,
      coalescedCount: 0,
      writesByDomain: {
        profile: 0,
        customDecks: 0,
        activeDeckId: 0,
        maskState: 0,
        deckVersions: 0,
        recycleBin: 0
      }
    };
  }

  markDirty(domain) {
    if (!domain) return;
    this.dirtyDomains.add(domain);
    if (this.domainRevisions[domain] !== undefined) {
      this.domainRevisions[domain]++;
    }
    this.globalRevision++;
  }

  isDirty(domain) {
    return this.dirtyDomains.has(domain);
  }

  hasPendingWrites() {
    return this.dirtyDomains.size > 0;
  }

  getRevision() {
    return this.globalRevision;
  }

  getDomainRevision(domain) {
    return this.domainRevisions[domain] || 0;
  }

  schedule(stateSnapshotGetter, options = {}) {
    const { immediate = false, domains = null } = options;
    this.metrics.requestedSaves++;

    if (domains && Array.isArray(domains)) {
      domains.forEach(d => this.markDirty(d));
    }

    if (immediate) {
      return this.flush(stateSnapshotGetter);
    }

    if (this._debounceTimer) {
      this.metrics.coalescedCount++;
    }

    const now = Date.now();
    if (!this._firstScheduledAt) {
      this._firstScheduledAt = now;
    }

    const elapsed = now - this._firstScheduledAt;
    const remainingMaxWait = Math.max(0, this.maxWaitMs - elapsed);
    const delay = Math.min(this.debounceMs, remainingMaxWait);

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    return new Promise((resolve) => {
      this._pendingResolve = resolve;
      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this._firstScheduledAt = null;
        this._executeCommit(stateSnapshotGetter);
        if (this._pendingResolve) {
          const res = this._pendingResolve;
          this._pendingResolve = null;
          res({ revision: this.globalRevision });
        }
      }, delay);
    });
  }

  flush(stateSnapshotGetter) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._firstScheduledAt = null;

    const result = this._executeCommit(stateSnapshotGetter);

    if (this._pendingResolve) {
      const res = this._pendingResolve;
      this._pendingResolve = null;
      res(result);
    }

    return result;
  }

  _executeCommit(stateSnapshotGetter) {
    if (this.dirtyDomains.size === 0 || this._isWriting) {
      return { revision: this.globalRevision, committed: [] };
    }

    this._isWriting = true;
    const committed = [];

    try {
      const state = typeof stateSnapshotGetter === 'function'
        ? stateSnapshotGetter()
        : stateSnapshotGetter;

      if (!state) return { revision: this.globalRevision, committed };

      const domainsToCommit = Array.from(this.dirtyDomains);

      domainsToCommit.forEach(domain => {
        switch (domain) {
          case STORAGE_DOMAINS.PROFILE:
            if (state.profile && this.storage.saveProfile) {
              this.storage.saveProfile(state.profile);
              committed.push(domain);
              this.metrics.writesByDomain.profile++;
            }
            break;
          case STORAGE_DOMAINS.CUSTOM_DECKS:
            if (state.customDecks && this.storage.saveCustomDecks) {
              this.storage.saveCustomDecks(state.customDecks);
              committed.push(domain);
              this.metrics.writesByDomain.customDecks++;
            }
            break;
          case STORAGE_DOMAINS.ACTIVE_DECK_ID:
            if (state.activeDeckId && this.storage.saveActiveDeckId) {
              this.storage.saveActiveDeckId(state.activeDeckId);
              committed.push(domain);
              this.metrics.writesByDomain.activeDeckId++;
            }
            break;
          case STORAGE_DOMAINS.MASK_STATE:
            if (state.maskState !== undefined && this.storage.saveMaskState) {
              this.storage.saveMaskState(state.maskState);
              committed.push(domain);
              this.metrics.writesByDomain.maskState++;
            }
            break;
          case STORAGE_DOMAINS.DECK_VERSIONS:
            if (state.deckVersions && this.storage.saveDeckVersions) {
              this.storage.saveDeckVersions(state.deckVersions);
              committed.push(domain);
              this.metrics.writesByDomain.deckVersions++;
            }
            break;
          case STORAGE_DOMAINS.RECYCLE_BIN:
            if (state.recycleBin && this.storage.saveRecycleBin) {
              this.storage.saveRecycleBin(state.recycleBin);
              committed.push(domain);
              this.metrics.writesByDomain.recycleBin++;
            }
            break;
        }
        this.dirtyDomains.delete(domain);
      });

      if (committed.length > 0) {
        this.metrics.committedWrites++;
      }

      return { revision: this.globalRevision, committed };
    } finally {
      this._isWriting = false;
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics.requestedSaves = 0;
    this.metrics.committedWrites = 0;
    this.metrics.coalescedCount = 0;
    Object.keys(this.metrics.writesByDomain).forEach(k => {
      this.metrics.writesByDomain[k] = 0;
    });
  }
}
