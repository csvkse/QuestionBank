/**
 * 指数退避策略（Exponential Backoff with Full Jitter）
 * 参考 AWS 架构中心最佳实践与分布式韧性通信标准
 */

export class ExponentialBackoffStrategy {
  /**
   * @param {Object} options
   * @param {number} [options.initialDelayMs=500] 初始重试延迟（毫秒）
   * @param {number} [options.maxDelayMs=30000] 最大重试延迟（毫秒）
   * @param {number} [options.factor=2] 指数增长倍数
   * @param {'full'|'none'} [options.jitter='full'] 抖动模式，'full' (AWS 推荐) 打散重试峰值
   * @param {number} [options.minDelayMs=100] 最小延迟底线，防止 Full Jitter 产生 0ms 激进重试
   * @param {number} [options.maxAttempts=10] 最大重试次数
   * @param {() => number} [options.randomFn=Math.random] 随机数生成器，便于单元测试确定性断言
   */
  constructor(options = {}) {
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.factor = options.factor ?? 2;
    this.jitter = options.jitter ?? 'full';
    this.minDelayMs = options.minDelayMs ?? 100;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.randomFn = options.randomFn ?? Math.random;
    this.attempt = 0;
  }

  /**
   * 计算指定重试序号（或当前序号）的下一次重试等待时长
   * @param {number} [attempt]
   * @returns {number} 延迟毫秒数
   */
  computeDelay(attempt = this.attempt) {
    const rawDelay = Math.min(
      this.maxDelayMs,
      this.initialDelayMs * Math.pow(this.factor, attempt)
    );

    if (this.jitter === 'full') {
      const randomFactor = this.randomFn();
      const jittered = Math.floor(randomFactor * rawDelay);
      return Math.max(this.minDelayMs, jittered);
    }

    return Math.max(this.minDelayMs, rawDelay);
  }

  /**
   * 获取下一次重试延迟并将 internal attempt 递增
   * @returns {number}
   */
  nextDelay() {
    const delay = this.computeDelay(this.attempt);
    this.attempt++;
    return delay;
  }

  /**
   * 重置连续重试计数
   */
  reset() {
    this.attempt = 0;
  }

  /**
   * 根据关闭事件或错误判定是否应当执行退避重试
   * @param {Object} [reason]
   * @param {number} [reason.code] WebSocket close code
   * @returns {boolean}
   */
  shouldRetry(reason = {}) {
    // 超过最大重试次数，不再自动发起高频退避
    if (this.attempt >= this.maxAttempts) {
      return false;
    }

    const code = reason?.code;
    // 4002: DISPLACED 被同房间其他 Host 顶替，绝对禁止重试（避免双向互踢死循环）
    if (code === 4002) {
      return false;
    }

    // 4001 / 4003: 认证失败 / Token 错误，不可恢复性错误，禁止重试
    if (code === 4001 || code === 4003) {
      return false;
    }

    // 1000: 正常主动关闭（通常由客户端或服务端在业务完结时发起）
    if (code === 1000 && reason?.userInitiated) {
      return false;
    }

    return true;
  }
}
