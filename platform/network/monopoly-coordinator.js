/**
 * MCP 桥接单主垄断协调器 (Monopoly Coordinator)
 * 职责：保证同浏览器同房间仅唯一活跃 Host；细粒度锁隔离；Web Locks / BroadcastChannel 降级适配；队列接管与生命周期联动。
 */

export class WebLocksAdapter {
  constructor(locksApi) {
    this._locksApi = locksApi;
  }

  get locksApi() {
    return this._locksApi ?? globalThis.navigator?.locks;
  }

  isSupported() {
    return Boolean(this.locksApi?.request);
  }

  request(lockKey, { ifAvailable = true } = {}, grantCallback) {
    if (!this.isSupported()) {
      return Promise.reject(new Error('Web Locks API 不可用'));
    }

    return new Promise((resolve, reject) => {
      void this.locksApi
        .request(lockKey, { ifAvailable }, lock => {
          if (!lock) {
            resolve({ acquired: false, release: null });
            return;
          }

          return new Promise(releaseLock => {
            grantCallback?.(releaseLock);
            resolve({ acquired: true, release: releaseLock });
          });
        })
        .catch(reject);
    });
  }
}

export class BroadcastChannelAdapter {
  constructor(channelName = 'mcp-monopoly-channel') {
    this.channelName = channelName;
  }

  isSupported() {
    return typeof globalThis.BroadcastChannel === 'function';
  }

  async request(lockKey, { ifAvailable = true } = {}, grantCallback) {
    if (!this.isSupported()) {
      let released = false;
      const release = () => { released = true; };
      grantCallback?.(release);
      return { acquired: true, release };
    }

    const channel = new globalThis.BroadcastChannel(`${this.channelName}:${lockKey}`);
    channel.unref?.();
    const hostId = `host-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let currentLeader = null;

    const probePromise = new Promise(resolve => {
      const timer = setTimeout(() => {
        resolve(!currentLeader);
      }, 50);

      channel.onmessage = event => {
        if (event.data?.type === 'LEADER_HEARTBEAT' && event.data.hostId !== hostId) {
          currentLeader = event.data.hostId;
          clearTimeout(timer);
          resolve(false);
        }
      };

      channel.postMessage({ type: 'WHO_IS_LEADER', hostId });
    });

    const isAvailable = await probePromise;
    if (!isAvailable && ifAvailable) {
      channel.close();
      return { acquired: false, release: null };
    }

    let heartbeatTimer = setInterval(() => {
      try {
        channel.postMessage({ type: 'LEADER_HEARTBEAT', hostId });
      } catch {
        // channel closed
      }
    }, 500);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      try {
        channel.postMessage({ type: 'LEADER_RESIGN', hostId });
        channel.close();
      } catch {
        // ignore
      }
    };

    channel.onmessage = event => {
      if (event.data?.type === 'WHO_IS_LEADER') {
        try {
          channel.postMessage({ type: 'LEADER_HEARTBEAT', hostId });
        } catch {
          // ignore
        }
      }
    };

    grantCallback?.(release);
    return { acquired: true, release };
  }
}

export class MonopolyCoordinator {
  /**
   * @param {Object} [options]
   * @param {Object} [options.adapter] 自定义锁适配器
   * @param {string} [options.lockPrefix='knowledge-master-mcp-host']
   */
  constructor(options = {}) {
    this.lockPrefix = options.lockPrefix ?? 'knowledge-master-mcp-host';
    this.customAdapter = options.adapter;
    this.currentRelease = null;
    this.currentKey = null;
    this._adapter = null;
  }

  get adapter() {
    if (this.customAdapter) return this.customAdapter;
    if (!this._adapter) {
      const webLocks = new WebLocksAdapter();
      this._adapter = webLocks.isSupported() ? webLocks : new BroadcastChannelAdapter();
    }
    return this._adapter;
  }

  /**
   * 初始化跨标签页抢占与协调控制通道
   * @param {Function} onStepDown
   */
  initControl(onStepDown) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this._controlChannel = new BroadcastChannel('mcp-monopoly-control');
        this._controlChannel.unref?.();
        this._controlChannel.onmessage = ev => {
          if (ev.data?.type === 'RESIGN' && ev.data?.key === this.currentKey && this.isHolding()) {
            this.release();
            onStepDown?.();
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }
  }

  /**
   * 广播控制指令
   * @param {Object} msg
   */
  sendControlMessage(msg) {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel('mcp-monopoly-control');
        ch.postMessage(msg);
        ch.close();
      } catch {
        // ignore
      }
    }
  }

  // 构造房间级别细粒度锁键
  buildLockKey(server = '', room = '') {
    if (!room) return this.lockPrefix;
    return `${this.lockPrefix}:${encodeURIComponent(server)}:${encodeURIComponent(room)}`;
  }

  // 申请独占垄断锁
  async acquire({ server, room, ifAvailable = true } = {}) {
    this.release();
    const key = this.buildLockKey(server, room);
    this.currentKey = key;

    try {
      const result = await this.adapter.request(key, { ifAvailable }, releaseFn => {
        this.currentRelease = releaseFn;
      });

      if (!result.acquired) {
        this.currentKey = null;
        return { acquired: false, release: null };
      }

      this.currentRelease = result.release;
      return result;
    } catch {
      this.currentKey = null;
      return { acquired: false, release: null };
    }
  }

  /**
   * 参与房间单主选举（支持非阻塞即时当选与排队无感接管）
   * @param {Object} params
   * @param {string} params.server
   * @param {string} params.room
   * @param {Function} [params.onPromoted] 晋升为主节点 (Leader) 回调
   * @param {Function} [params.onDemoted] 降级为待命节点 (Standby) 回调
   * @returns {Promise<{ isLeader: boolean, release: Function }>}
   */
  async electLeader({ server, room, force = false, onPromoted, onDemoted } = {}) {
    const key = this.buildLockKey(server, room);
    if (force) {
      this.sendControlMessage({ type: 'RESIGN', key });
      await new Promise(r => setTimeout(r, 40));
    }
    const immediate = await this.acquire({ server, room, ifAvailable: true });
    if (immediate.acquired) {
      this._electionCancelled = false;
      onPromoted?.();
      return { isLeader: true, release: () => this.release() };
    }

    this._electionCancelled = false;
    onDemoted?.('STANDBY');

    if (this.adapter.locksApi?.request) {
      void this.adapter.locksApi.request(key, { mode: 'exclusive' }, async () => {
        if (this._electionCancelled) return;
        this.isPromotedFromQueue = true;
        onPromoted?.();
        await new Promise(resolve => {
          this.currentRelease = resolve;
        });
      }).catch(() => {});
    }

    return {
      isLeader: false,
      release: () => {
        this._electionCancelled = true;
        this.release();
      }
    };
  }

  /**
   * 主动释放垄断锁
   */
  release() {
    this._electionCancelled = true;
    if (this.currentRelease) {
      try {
        this.currentRelease();
      } catch {
        // ignore
      }
      this.currentRelease = null;
    }
    this.currentKey = null;
  }

  /**
   * 当前是否正持有锁
   * @returns {boolean}
   */
  isHolding() {
    return Boolean(this.currentRelease);
  }
}
