/**
 * WebSocket 连接看门狗与自动保活调度器 (Connection Watchdog & Keep-Alive)
 * 职责：
 * 1. 握手问候哨兵（Greeting Timeout）
 * 2. 活性心跳探测与双向保活（Ping/Pong Heartbeat）
 * 3. 业务数据喂狗机制（Data-driven Feed）
 * 4. 浏览器后台节流容忍与前台唤醒补偿（VisibilityChange Aware）
 * 5. 网络恢复快速急救（Online Event Fast Probe）
 */

export class ConnectionWatchdog {
  /**
   * @param {Object} options
   * @param {number} [options.pingIntervalMs=15000] Ping 发送周期（毫秒）
   * @param {number} [options.pongTimeoutMs=35000] 无活动超时判定假死周期（毫秒）
   * @param {number} [options.greetingTimeoutMs=10000] 等待服务端连接握手超时（毫秒）
   * @param {Window} [options.windowObj] 全局 window 对象（便于跨平台与单测注入）
   * @param {Document} [options.documentObj] 全局 document 对象
   */
  constructor(options = {}) {
    this.pingIntervalMs = options.pingIntervalMs ?? 15000;
    this.pongTimeoutMs = options.pongTimeoutMs ?? 35000;
    this.greetingTimeoutMs = options.greetingTimeoutMs ?? 10000;
    this.windowObj = options.windowObj ?? globalThis.window;
    this.documentObj = options.documentObj ?? globalThis.document;

    this.armed = false;
    this.greetingTimer = null;
    this.probeInterval = null;
    this.lastActiveAt = 0;
    this.lastPingSentAt = 0;
    this.callbacks = null;

    this.handleOnline = this.handleOnline.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
  }

  /**
   * 激活并部署看门狗
   * @param {Object} callbacks
   * @param {() => Promise<void>|void} callbacks.onSendPing 发送心跳 Ping 回调
   * @param {(reason: string) => void} callbacks.onHung 检测到连接僵死时的自愈回调
   * @param {() => void} [callbacks.onGreetingTimeout] 握手超时回调
   */
  arm(callbacks) {
    this.disarm();
    this.armed = true;
    this.callbacks = callbacks;
    const now = Date.now();
    this.lastActiveAt = now;
    this.lastPingSentAt = now;

    // 1. 启动握手问候超时哨兵
    this.greetingTimer = setTimeout(() => {
      if (!this.armed) return;
      if (this.callbacks?.onGreetingTimeout) {
        this.callbacks.onGreetingTimeout();
      } else {
        this.callbacks?.onHung?.('握手问候超时 (Greeting timeout)');
      }
    }, this.greetingTimeoutMs);

    // 2. 启动周期性活性探测
    this.probeInterval = setInterval(() => {
      this.tick();
    }, Math.min(this.pingIntervalMs, 5000));

    // 3. 注册浏览器网络与可见性感知
    this.windowObj?.addEventListener?.('online', this.handleOnline);
    this.documentObj?.addEventListener?.('visibilitychange', this.handleVisibility);
  }

  /**
   * 握手成功时解除 Greeting 哨兵并正式进入就绪保活期
   */
  acknowledgeHandshake() {
    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
      this.greetingTimer = null;
    }
    this.feed();
  }

  /**
   * 喂狗（Kick/Feed the Dog）：
   * 无论收到 Pong 还是合法业务 RPC（tools/call, tools/list, tools/register），均证明信道完全存活
   */
  feed() {
    this.lastActiveAt = Date.now();
  }

  /**
   * 发送心跳 Ping
   */
  sendPing() {
    this.lastPingSentAt = Date.now();
    try {
      const promise = this.callbacks?.onSendPing?.();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          this.callbacks?.onHung?.('Ping 发送失败，信道不可写');
        });
      }
    } catch {
      this.callbacks?.onHung?.('Ping 发送异常');
    }
  }

  /**
   * 周期探测检查逻辑
   */
  tick() {
    if (!this.armed) return;
    const now = Date.now();

    // 检查假死（静默无应答超过阈值）
    if (now - this.lastActiveAt > this.pongTimeoutMs) {
      this.callbacks?.onHung?.(`连接假死已超过 ${this.pongTimeoutMs}ms 无任何数据交互`);
      return;
    }

    // 检查是否应当发送新一轮心跳 Ping
    if (now - this.lastPingSentAt >= this.pingIntervalMs) {
      this.sendPing();
    }
  }

  /**
   * 处理网络重连事件（Online Event，快速急救探测）
   */
  handleOnline() {
    if (!this.armed) return;
    this.sendPing();
  }

  /**
   * 处理页面可见性变化（切回前台时补偿被浏览器后台节流的定时器）
   */
  handleVisibility() {
    if (!this.armed) return;
    if (this.documentObj?.visibilityState === 'visible') {
      const now = Date.now();
      if (now - this.lastPingSentAt >= this.pingIntervalMs) {
        this.sendPing();
      }
    }
  }

  /**
   * 解除并销毁看门狗所有计时器与监听
   */
  disarm() {
    this.armed = false;
    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
      this.greetingTimer = null;
    }
    if (this.probeInterval) {
      clearInterval(this.probeInterval);
      this.probeInterval = null;
    }
    this.windowObj?.removeEventListener?.('online', this.handleOnline);
    this.documentObj?.removeEventListener?.('visibilitychange', this.handleVisibility);
    this.callbacks = null;
  }
}
