/**
 * MCP 桥接单主垄断协调器 (Monopoly Coordinator)
 * 职责：
 * 1. 保证同一浏览器实例、同一房间（Room）下仅有唯一的活跃 MCP Host
 * 2. 细粒度资源锁隔离（不同房间可并发独立运行，同房间绝对排他）
 * 3. 跨环境适配器模式：优先 Web Locks API，无原生锁时降级至 BroadcastChannel 单主心跳租约
 * 4. 主动释放与生命周期联动（如网关 4002 DISPLACED 时即时释放本地独占权）
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
  }

  get adapter() {
    if (this.customAdapter) return this.customAdapter;
    const webLocks = new WebLocksAdapter();
    if (webLocks.isSupported()) return webLocks;
    return new BroadcastChannelAdapter();
  }

  /**
   * 构造房间级别细粒度锁键
   * @param {string} [server]
   * @param {string} [room]
   * @returns {string}
   */
  buildLockKey(server = '', room = '') {
    if (!room) return this.lockPrefix;
    return `${this.lockPrefix}:${encodeURIComponent(server)}:${encodeURIComponent(room)}`;
  }

  /**
   * 申请独占垄断锁
   * @param {Object} params
   * @param {string} [params.server]
   * @param {string} [params.room]
   * @param {boolean} [params.ifAvailable=true]
   * @returns {Promise<{ acquired: boolean, release: Function|null }>}
   */
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
   * 主动释放垄断锁
   */
  release() {
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
