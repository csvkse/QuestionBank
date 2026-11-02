import test from 'node:test';
import assert from 'node:assert/strict';
import { ExponentialBackoffStrategy } from '../../platform/network/backoff-strategy.js';
import { ConnectionWatchdog } from '../../platform/network/connection-watchdog.js';
import { MonopolyCoordinator, WebLocksAdapter, BroadcastChannelAdapter } from '../../platform/network/monopoly-coordinator.js';
import { BridgeStateMachine, BRIDGE_STATES } from '../../platform/network/bridge-state-machine.js';
import { BrowserBridgeTransport, BridgeCipher } from '../../platform/network/browser-bridge-transport.js';

class MockSocket extends EventTarget {
  constructor(url, protocols) {
    super();
    this.url = url;
    this.protocols = protocols;
    this.readyState = 1;
    this.bufferedAmount = 0;
    this.sent = [];
    MockSocket.instances.push(this);
  }
  static instances = [];
  send(val) { this.sent.push(JSON.parse(val)); }
  close(code = 1000) {
    this.readyState = 3;
    this.dispatchEvent(new CloseEvent('close', { code }));
  }
  message(data) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

const tick = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. ExponentialBackoffStrategy 单元测试
// ==========================================
test('ExponentialBackoffStrategy computes exponential delays with caps and Full Jitter', () => {
  // 无抖动模式验证纯几何增长
  const deterministic = new ExponentialBackoffStrategy({
    initialDelayMs: 500,
    maxDelayMs: 4000,
    factor: 2,
    jitter: 'none',
    minDelayMs: 100
  });

  assert.equal(deterministic.computeDelay(0), 500);
  assert.equal(deterministic.computeDelay(1), 1000);
  assert.equal(deterministic.computeDelay(2), 2000);
  assert.equal(deterministic.computeDelay(3), 4000);
  assert.equal(deterministic.computeDelay(4), 4000); // 达到 maxDelayMs 封顶

  // 验证 Full Jitter 抖动区间落在 [minDelayMs, rawDelay]
  const jittered = new ExponentialBackoffStrategy({
    initialDelayMs: 1000,
    maxDelayMs: 8000,
    factor: 2,
    jitter: 'full',
    minDelayMs: 150,
    randomFn: () => 0.5
  });

  // attempt=0: raw=1000, 0.5 * 1000 = 500
  assert.equal(jittered.computeDelay(0), 500);
  // attempt=2: raw=4000, 0.5 * 4000 = 2000
  assert.equal(jittered.computeDelay(2), 2000);

  // 验证极端低随机数不突破 minDelayMs 底线
  const lowRandom = new ExponentialBackoffStrategy({
    initialDelayMs: 1000,
    minDelayMs: 200,
    jitter: 'full',
    randomFn: () => 0.01 // 1000 * 0.01 = 10 < 200
  });
  assert.equal(lowRandom.computeDelay(0), 200);

  // 验证 nextDelay 递增与 reset 重置
  assert.equal(deterministic.attempt, 0);
  const d0 = deterministic.nextDelay();
  assert.equal(d0, 500);
  assert.equal(deterministic.attempt, 1);
  deterministic.reset();
  assert.equal(deterministic.attempt, 0);
});

test('ExponentialBackoffStrategy discriminates fatal vs retryable error codes', () => {
  const strategy = new ExponentialBackoffStrategy({ maxAttempts: 3 });

  // 4002 DISPLACED 绝不重试（防止双向互踢死循环）
  assert.equal(strategy.shouldRetry({ code: 4002 }), false);
  // 4001 / 4003 鉴权失败绝不重试
  assert.equal(strategy.shouldRetry({ code: 4001 }), false);
  assert.equal(strategy.shouldRetry({ code: 4003 }), false);
  // 1000 主动关闭不重试
  assert.equal(strategy.shouldRetry({ code: 1000, userInitiated: true }), false);

  // 1006 异常断网、未知错误支持重试
  assert.equal(strategy.shouldRetry({ code: 1006 }), true);

  // 达到最大重试限制后停止重试
  strategy.attempt = 3;
  assert.equal(strategy.shouldRetry({ code: 1006 }), false);
});

// ==========================================
// 2. ConnectionWatchdog 单元测试
// ==========================================
test('ConnectionWatchdog triggers greeting timeout if no handshake packet arrives', async () => {
  let hungReason = '';
  const watchdog = new ConnectionWatchdog({
    greetingTimeoutMs: 30,
    pingIntervalMs: 50,
    pongTimeoutMs: 100
  });

  watchdog.arm({
    onSendPing: () => {},
    onHung: reason => { hungReason = reason; }
  });

  await tick(50);
  assert.ok(hungReason.includes('握手问候超时'));
  watchdog.disarm();
});

test('ConnectionWatchdog feeds on incoming data and sends heartbeat pings', async () => {
  let pingCount = 0;
  let hungCount = 0;
  const watchdog = new ConnectionWatchdog({
    greetingTimeoutMs: 200,
    pingIntervalMs: 40,
    pongTimeoutMs: 100
  });

  watchdog.arm({
    onSendPing: () => { pingCount++; },
    onHung: () => { hungCount++; }
  });

  watchdog.acknowledgeHandshake();
  await tick(60);
  assert.ok(pingCount >= 1, `Ping count should be >= 1, actual: ${pingCount}`);

  // 连续喂狗维持存活
  for (let i = 0; i < 3; i++) {
    await tick(30);
    watchdog.feed();
  }

  assert.equal(hungCount, 0, '持续喂狗状态下看门狗绝不应当误杀连接');
  watchdog.disarm();
});

test('ConnectionWatchdog detects zombie silent connection after pongTimeout', async () => {
  let hungCalled = false;
  const watchdog = new ConnectionWatchdog({
    greetingTimeoutMs: 200,
    pingIntervalMs: 30,
    pongTimeoutMs: 60
  });

  watchdog.arm({
    onSendPing: () => {},
    onHung: () => { hungCalled = true; }
  });
  watchdog.acknowledgeHandshake();

  // 停止喂狗，静默超过 70ms
  await tick(90);
  assert.equal(hungCalled, true, '无数据无 Pong 超过超时阈值，看门狗应当报警断开');
  watchdog.disarm();
});

test('ConnectionWatchdog accelerates probe upon online network event', async () => {
  let pingTriggered = false;
  const fakeWindow = new EventTarget();
  const watchdog = new ConnectionWatchdog({
    greetingTimeoutMs: 500,
    pingIntervalMs: 1000,
    pongTimeoutMs: 2000,
    windowObj: fakeWindow
  });

  watchdog.arm({
    onSendPing: () => { pingTriggered = true; },
    onHung: () => {}
  });
  watchdog.acknowledgeHandshake();

  // 模拟网络重连事件
  fakeWindow.dispatchEvent(new Event('online'));
  await tick(10);
  assert.equal(pingTriggered, true, 'online 事件触发瞬间应立即激活活性探测');
  watchdog.disarm();
});

// ==========================================
// 3. MonopolyCoordinator 单元测试
// ==========================================
test('MonopolyCoordinator isolates fine-grained rooms and enforces mutual exclusion', async () => {
  const locks = new Map();
  const mockLocksApi = {
    request(name, { ifAvailable }, callback) {
      if (locks.has(name)) {
        if (ifAvailable) {
          return Promise.resolve(callback(null));
        }
      }
      locks.set(name, true);
      const lockObj = { name };
      const cbResult = callback(lockObj);
      return Promise.resolve(cbResult).finally(() => {
        locks.delete(name);
      });
    }
  };

  const coordinatorA = new MonopolyCoordinator({ adapter: new WebLocksAdapter(mockLocksApi) });
  const coordinatorB = new MonopolyCoordinator({ adapter: new WebLocksAdapter(mockLocksApi) });

  // 相同服务器、相同房间：独占互斥
  const resA1 = await coordinatorA.acquire({ server: 'https://gw.example.com.com', room: 'math' });
  assert.equal(resA1.acquired, true);
  assert.equal(coordinatorA.isHolding(), true);

  const resB1 = await coordinatorB.acquire({ server: 'https://gw.example.com.com', room: 'math' });
  assert.equal(resB1.acquired, false, '同房间第二个实例申请必须被拒绝');
  assert.equal(coordinatorB.isHolding(), false);

  // 不同房间：细粒度隔离，允许并行
  const resB2 = await coordinatorB.acquire({ server: 'https://gw.example.com.com', room: 'physics' });
  assert.equal(resB2.acquired, true, '不同房间应当独立获锁');

  // A 释放后，B 重新申请 math 应当成功
  coordinatorA.release();
  assert.equal(coordinatorA.isHolding(), false);
  await tick(20);

  const resB3 = await coordinatorB.acquire({ server: 'https://gw.example.com.com', room: 'math' });
  assert.equal(resB3.acquired, true, '前序持有者释放后，后来者应当成功获锁');

  coordinatorB.release();
});

// ==========================================
// 4. BridgeStateMachine 单元测试
// ==========================================
test('BridgeStateMachine validates legal and illegal transitions', () => {
  const transitions = [];
  const fsm = new BridgeStateMachine({
    initialState: BRIDGE_STATES.DISABLED,
    onStateChange: (state, prev) => transitions.push(`${prev}->${state}`)
  });

  assert.equal(fsm.state, BRIDGE_STATES.DISABLED);
  assert.equal(fsm.transition(BRIDGE_STATES.ACQUIRING_LOCK), true);
  assert.equal(fsm.transition(BRIDGE_STATES.CONNECTING), true);
  assert.equal(fsm.transition(BRIDGE_STATES.REGISTERING), true);
  assert.equal(fsm.transition(BRIDGE_STATES.REGISTERED), true);
  assert.equal(fsm.transition(BRIDGE_STATES.READY), true);
  assert.equal(fsm.transition(BRIDGE_STATES.BACKOFF), true);
  assert.equal(fsm.transition(BRIDGE_STATES.CONNECTING), true);
  assert.equal(fsm.transition(BRIDGE_STATES.DISPLACED), true);

  // DISPLACED 下非法突跳 READY 应被拦截
  assert.equal(fsm.canTransitionTo(BRIDGE_STATES.READY), false);
  assert.equal(fsm.transition(BRIDGE_STATES.READY), false);

  // 任意状态重置为 DISABLED
  assert.equal(fsm.transition(BRIDGE_STATES.DISABLED), true);
  assert.equal(fsm.state, BRIDGE_STATES.DISABLED);
});

// ==========================================
// 5. BrowserBridgeTransport 联动集成测试
// ==========================================
test('BrowserBridgeTransport resets backoff count on successful handshake registration', async () => {
  MockSocket.instances = [];
  const cipher = await BridgeCipher.create('valid-token');
  const adapter = { listTools: () => [], callTool: async () => ({ content: [] }) };
  const backoff = new ExponentialBackoffStrategy({ initialDelayMs: 20, maxDelayMs: 100 });
  const bridge = new BrowserBridgeTransport({
    adapter,
    WebSocketClass: MockSocket,
    backoffStrategy: backoff
  });

  // 模拟之前有两次失败重试历史
  backoff.attempt = 2;
  await bridge.start({ server: 'https://gateway.example.com.com', room: 'test-room', token: 'valid-token' });
  const socket = MockSocket.instances.at(-1);

  // 收到对端问候
  socket.message(await cipher.encrypt({ type: 'BRIDGE_CONNECTED', role: 'host' }));
  await tick(30);

  assert.equal(bridge.state, 'REGISTERED');
  assert.equal(bridge.attempt, 0, '成功注册后连续重试计数必须复位为 0');
  bridge.stop();
});

test('BrowserBridgeTransport transitions to DISPLACED on 4002 and terminates retry', async () => {
  MockSocket.instances = [];
  const adapter = { listTools: () => [], callTool: async () => ({ content: [] }) };
  const bridge = new BrowserBridgeTransport({
    adapter,
    WebSocketClass: MockSocket
  });

  await bridge.start({ server: 'https://gateway.example.com.com', room: 'test-room', token: 'valid-token' });
  const socket = MockSocket.instances.at(-1);

  // 模拟网关返回 4002（同房间已有新连接连入）
  socket.close(4002);
  await tick(20);

  assert.equal(bridge.state, 'DISPLACED');
  assert.equal(bridge.config, null);
  // 确认没有启动新的 socket 重连
  assert.equal(MockSocket.instances.length, 1);
  bridge.stop();
});
