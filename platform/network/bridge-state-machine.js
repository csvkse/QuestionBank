/**
 * MCP 桥接连接有限状态机 (Bridge Finite State Machine)
 * 严格管理连接生命周期与垄断/退避/服务状态跃迁
 */

export const BRIDGE_STATES = Object.freeze({
  DISABLED: 'DISABLED',
  ELECTING: 'ELECTING',
  STANDBY: 'STANDBY',
  ACQUIRING_LOCK: 'ACQUIRING_LOCK',
  CONNECTING: 'CONNECTING',
  REGISTERING: 'REGISTERING',
  REGISTERED: 'REGISTERED',
  READY: 'READY',
  BACKOFF: 'BACKOFF',
  DISPLACED: 'DISPLACED',
  FAILED: 'FAILED'
});

export class BridgeStateMachine {
  /**
   * @param {Object} [options]
   * @param {string} [options.initialState=BRIDGE_STATES.DISABLED]
   * @param {(state: string, prevState: string, context?: any) => void} [options.onStateChange]
   */
  constructor(options = {}) {
    this.state = options.initialState ?? BRIDGE_STATES.DISABLED;
    this.onStateChange = options.onStateChange ?? (() => {});
    this.history = [this.state];
  }

  /**
   * 判定目标状态跃迁是否合法
   * @param {string} targetState
   * @returns {boolean}
   */
  canTransitionTo(targetState) {
    if (!Object.values(BRIDGE_STATES).includes(targetState)) {
      return false;
    }

    const current = this.state;
    if (current === targetState) return true;

    // 任何状态都可以转移到 DISABLED（手动停止或完全重置）
    if (targetState === BRIDGE_STATES.DISABLED) return true;

    switch (current) {
      case BRIDGE_STATES.DISABLED:
        return [BRIDGE_STATES.ELECTING, BRIDGE_STATES.ACQUIRING_LOCK, BRIDGE_STATES.CONNECTING, BRIDGE_STATES.STANDBY, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.ELECTING:
        return [BRIDGE_STATES.CONNECTING, BRIDGE_STATES.STANDBY, BRIDGE_STATES.DISABLED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.STANDBY:
        return [BRIDGE_STATES.ELECTING, BRIDGE_STATES.CONNECTING, BRIDGE_STATES.DISABLED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.ACQUIRING_LOCK:
        return [BRIDGE_STATES.CONNECTING, BRIDGE_STATES.STANDBY, BRIDGE_STATES.DISABLED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.CONNECTING:
        return [BRIDGE_STATES.REGISTERING, BRIDGE_STATES.STANDBY, BRIDGE_STATES.BACKOFF, BRIDGE_STATES.DISPLACED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.REGISTERING:
        return [BRIDGE_STATES.REGISTERED, BRIDGE_STATES.READY, BRIDGE_STATES.STANDBY, BRIDGE_STATES.BACKOFF, BRIDGE_STATES.DISPLACED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.REGISTERED:
      case BRIDGE_STATES.READY:
        return [BRIDGE_STATES.READY, BRIDGE_STATES.STANDBY, BRIDGE_STATES.BACKOFF, BRIDGE_STATES.DISPLACED, BRIDGE_STATES.FAILED].includes(targetState);

      case BRIDGE_STATES.BACKOFF:
        return [BRIDGE_STATES.CONNECTING, BRIDGE_STATES.STANDBY, BRIDGE_STATES.FAILED, BRIDGE_STATES.DISPLACED].includes(targetState);

      case BRIDGE_STATES.DISPLACED:
      case BRIDGE_STATES.FAILED:
        return [BRIDGE_STATES.CONNECTING, BRIDGE_STATES.ACQUIRING_LOCK, BRIDGE_STATES.ELECTING, BRIDGE_STATES.STANDBY].includes(targetState);

      default:
        return false;
    }
  }

  /**
   * 执行状态跃迁
   * @param {string} targetState
   * @param {any} [context]
   * @returns {boolean} 是否跃迁成功
   */
  transition(targetState, context) {
    if (!this.canTransitionTo(targetState)) {
      console.warn(`[BridgeStateMachine] 非法状态跃迁: ${this.state} -> ${targetState}`);
      return false;
    }

    const prevState = this.state;
    this.state = targetState;
    this.history.push(targetState);
    if (this.history.length > 50) this.history.shift();

    try {
      this.onStateChange(targetState, prevState, context);
    } catch (err) {
      console.error('[BridgeStateMachine] onStateChange 监听器抛出异常:', err);
    }

    return true;
  }

  /**
   * 重置状态机为初始状态
   * @param {string} [state=BRIDGE_STATES.DISABLED]
   */
  reset(state = BRIDGE_STATES.DISABLED) {
    const prevState = this.state;
    this.state = state;
    this.onStateChange(state, prevState);
  }
}
