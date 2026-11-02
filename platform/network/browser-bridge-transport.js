import { ExponentialBackoffStrategy } from './backoff-strategy.js';
import { ConnectionWatchdog } from './connection-watchdog.js';
import { BridgeStateMachine, BRIDGE_STATES } from './bridge-state-machine.js';

export function bridgeConnectionUrl(server, room) {
  const url = new URL(server);
  if (url.username || url.password || url.search || url.hash || !['/', '/bridge'].includes(url.pathname)) {
    throw new Error('请填写网关根地址，不带凭据或查询参数');
  }
  if (!room || room.length > 128) throw new Error('房间名称必须为 1–128 字符');
  if (url.protocol === 'https:') url.protocol = 'wss:';
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
    throw new Error('远程桥接必须使用 HTTPS/WSS');
  }
  url.pathname = '/bridge';
  url.searchParams.set('room', room);
  url.searchParams.set('role', 'host');
  return url;
}

// Wire-compatible with ProxyByCF crypto-adapter.ts (SHA-256 token -> AES-GCM).
export class BridgeCipher {
  static async create(token) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return new BridgeCipher(await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']));
  }
  constructor(key) { this.key = key; }
  base64(bytes) {
    let value = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) value += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(value);
  }
  async encrypt(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, new TextEncoder().encode(JSON.stringify(value))));
    return { enc: 'aes-256-gcm', v: 1, iv: this.base64(iv), data: this.base64(data.subarray(0, -16)), tag: this.base64(data.subarray(-16)), t: Date.now() };
  }
  async decrypt(value) {
    if (value?.enc !== 'aes-256-gcm' || value.v !== 1) throw new Error('无效的加密消息');
    const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
    const data = decode(value.data), tag = decode(value.tag), combined = new Uint8Array(data.length + tag.length);
    combined.set(data); combined.set(tag, data.length);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(value.iv) }, this.key, combined)));
  }
}

export class BrowserBridgeTransport {
  constructor({
    adapter,
    WebSocketClass = globalThis.WebSocket,
    onState = () => {},
    onCall = () => {},
    requestTimeoutMs = 25000,
    backoffStrategy,
    watchdog
  }) {
    Object.assign(this, { adapter, WebSocketClass, onState, onCall, requestTimeoutMs });
    this.backoff = backoffStrategy || new ExponentialBackoffStrategy({ initialDelayMs: 500, maxDelayMs: 30000, factor: 2, jitter: 'full', minDelayMs: 100, maxAttempts: 5 });
    this.watchdog = watchdog || new ConnectionWatchdog({ pingIntervalMs: 15000, pongTimeoutMs: 35000, greetingTimeoutMs: 10000 });
    this.stateMachine = new BridgeStateMachine({
      initialState: BRIDGE_STATES.DISABLED,
      onStateChange: (state, prevState, context) => {
        this._state = state;
        this.onState(state, prevState, context);
      }
    });
    this._state = BRIDGE_STATES.DISABLED;
    this.generation = 0;
  }

  get state() { return this._state; }
  set state(val) { this.setState(val); }
  get attempt() { return this.backoff.attempt; }
  set attempt(val) { this.backoff.attempt = val; }

  setState(state) {
    this._state = state;
    this.stateMachine.state = state;
    this.onState(state);
  }

  async start({ server, room, token }) {
    this.stop();
    const generation = this.generation;
    const url = bridgeConnectionUrl(server, room);
    if (!token || token === 'aes-256-gcm' || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(token)) throw new Error('Token 格式无效');
    this.setState(BRIDGE_STATES.CONNECTING);
    const cipher = await BridgeCipher.create(token);
    if (generation !== this.generation) return;
    this.config = { url: url.href, token, cipher, server, room };
    this.backoff.reset();
    this.connect();
  }

  connect() {
    const generation = ++this.generation;
    const { url, token, cipher } = this.config;
    this.setState(BRIDGE_STATES.CONNECTING);
    let socket;
    try {
      socket = this.socket = new this.WebSocketClass(url, ['aes-256-gcm', token]);
    } catch {
      this.setState(BRIDGE_STATES.FAILED);
      this.config = null;
      return;
    }

    let queued = 0, chain = Promise.resolve();
    const current = () => generation === this.generation && this.socket === socket;

    const send = async message => {
      const encoded = JSON.stringify(await cipher.encrypt(message));
      if (!current()) return;
      if (encoded.length > 1024 * 1024 || socket.bufferedAmount > 2 * 1024 * 1024 || socket.readyState !== 1) throw new Error('桥接连接不可写');
      socket.send(encoded);
    };

    this.watchdog.arm({
      onSendPing: async () => { if (current()) await send({ type: 'ping' }); },
      onHung: () => { if (current()) socket.close(); },
      onGreetingTimeout: () => { if (current()) socket.close(); }
    });
    this.clearConnectionTimers = () => { this.watchdog.disarm(); };

    socket.addEventListener('message', event => {
      if (!current()) return;
      if (typeof event.data !== 'string' || event.data.length > 1024 * 1024 || queued >= 8) { socket.close(); return; }
      const receivedAt = Date.now();
      queued++;
      chain = chain.then(async () => {
        if (!current()) return;
        const message = await cipher.decrypt(JSON.parse(event.data));
        if (!current()) return;
        this.watchdog.feed(); // 任何合法解密消息均证明信道存活
        if (message.type === 'BRIDGE_CONNECTED') {
          if (message.role !== 'host') throw new Error('Host 角色不匹配');
          this.watchdog.acknowledgeHandshake();
          this.setState(BRIDGE_STATES.REGISTERING);
          await send({ type: 'tools/register', tools: this.adapter.listTools() });
          if (current()) {
            this.setState(BRIDGE_STATES.REGISTERED);
            this.backoff.reset();
          }
          return;
        }
        if (message.type === 'pong') { this.watchdog.feed(); return; }
        if (message.jsonrpc !== '2.0' || !['string', 'number'].includes(typeof message.id)) return;
        if (![BRIDGE_STATES.REGISTERED, BRIDGE_STATES.READY].includes(this.state)) return;

        if (message.method === 'tools/list') {
          await send({ jsonrpc: '2.0', id: message.id, result: { tools: this.adapter.listTools() } });
        } else if (message.method === 'tools/call') {
          if (Date.now() - receivedAt >= this.requestTimeoutMs) {
            await send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'Request expired before execution' } });
            return;
          }
          if (typeof message.params?.name !== 'string') {
            await send({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: 'Invalid tool parameters' } });
            return;
          }
          this.setState(BRIDGE_STATES.READY);
          const result = await this.adapter.callTool(message.params.name, message.params.arguments ?? {}, { operationId: message.params._meta?.operationId });
          if (current()) this.onCall(message.params.name, result.isError ? '失败' : '完成');
          await send({ jsonrpc: '2.0', id: message.id, result });
        } else {
          await send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Only tools/list and tools/call are supported' } });
        }
      }).catch(() => { if (current()) socket.close(); }).finally(() => queued--);
    });

    socket.addEventListener('error', () => {});
    socket.addEventListener('close', event => {
      this.watchdog.disarm();
      if (!current()) return;
      if (event.code === 4002) { this.setState(BRIDGE_STATES.DISPLACED); this.config = null; return; }
      if (!this.backoff.shouldRetry(event)) { this.setState(BRIDGE_STATES.FAILED); this.config = null; return; }
      this.setState(BRIDGE_STATES.BACKOFF);
      const delay = this.backoff.nextDelay();
      this.retryTimer = setTimeout(() => { if (current() && this.config) this.connect(); }, delay);
    });
  }

  stop() {
    ++this.generation;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.watchdog.disarm();
    this.clearConnectionTimers?.();
    const socket = this.socket;
    this.socket = null;
    this.config = null;
    socket?.close();
    this.setState(BRIDGE_STATES.DISABLED);
  }
}
