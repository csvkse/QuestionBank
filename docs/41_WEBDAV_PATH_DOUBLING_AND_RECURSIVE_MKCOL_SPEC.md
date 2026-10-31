# WebDAV 路径重叠缺陷定位、递归父集合创建与幂等写入规范

> 文档编号：41  
> 归属模块：`platform/storage/remote/` & `features/data-management/`  
> 关联标准：RFC 4918 (WebDAV), RFC 7230 (HTTP/1.1), Architecture Gate Suite v2.1

---

## 1. 问题现象与根因全景定位

在用户通过浏览器或 CORS 代理向实际 WebDAV 端点（TeraCLOUD / InfiniCLOUD 配合 CORS 代理 `proxy.example.com/proxy/`）发起备份快照提交时，抓包呈现如下真实命令与响应异常：

```bash
curl 'https://proxy.example.com/proxy/dav.example.com/dav/root/knowledge/root/knowledge/default/backups/dev_qes5fw45/snap_1793468525200_887bb893.json' \
  -X 'PUT' \
  -H 'authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=' \
  -H 'content-type: application/json; charset=utf-8' \
  -H 'if-none-match: *' \
  ...
```

该请求在服务器端返回 `403 Forbidden` / `409 Conflict`。通过在线探针分析与协议比对，定位到两个直接阻断写入的独立技术根因：

### 1.1 根因一：路径双重嵌套缺陷 (Path Doubling Bug)

观察请求 URL 中的路径：
`/dav/root/knowledge/root/knowledge/default/backups/dev_qes5fw45/...`
其中 `root/knowledge` 出现了**两次**！

#### 产生机理分析
1. **调用方行为**（`features/data-management/data-sync-manager.js`）：
   ```javascript
   const basePath = (this.config.basePath || 'knowledge-arena').replace(/^\/+|\/+$/g, '');
   const ws = (this.config.workspaceId || 'default').replace(/^\/+|\/+$/g, '');
   const path = `${basePath}/${ws}/backups/${this.deviceId}/${snapshot.snapshotId}.json`;
   ```
   此处 `path` 已经被赋予了前缀 `root/knowledge/default/backups/...`。
2. **适配器内部行为**（`platform/storage/remote/webdav-adapter.js`）：
   ```javascript
   _buildUrl(relPath) {
     const segments = [];
     if (this.basePath) segments.push(this.basePath);
     if (cleanRel) {
       cleanRel.split('/').forEach(s => segments.push(encodeURIComponent(s)));
     }
     return `${this.endpoint}/${segments.join('/')}`;
   }
   ```
   `WebDavAdapter` 的构造函数中同时传入了 `basePath = 'root/knowledge'`。`_buildUrl` 未检查 `cleanRel` 是否已经包含 `basePath`，也未检查 `endpoint` 本身是否已经以 `basePath` 结尾，直接将 `this.basePath` 与 `cleanRel` 简单串联，导致了 `root/knowledge/root/knowledge` 的双重拼接。

### 1.2 根因二：父级集合不存在触发 409 Conflict (RFC 4918 Section 9.7.1)

在排除了路径重叠（修正为 `/dav/root/knowledge/default/backups/dev_qes5fw45/...`）后，直接执行 `PUT` 仍然返回 `409 Conflict`。

#### RFC 4918 规范约束
根据 RFC 4918 Section 9.7.1 (PUT for Collections and Resources)：
> *"A PUT that would result in the creation of a resource without an appropriately scoped parent collection MUST fail with a 409 (Conflict)."*  
> 任何试图在不存在的父集合下直接创建资源的 PUT 请求，服务端**必须**以 `409 Conflict` 拒绝。

在 TeraCLOUD 存储空间中：
- 顶层目录 `/dav/root/knowledge/` 是存在的；
- 但是二级目录 `default/`、三级目录 `default/backups/`、四级目录 `default/backups/dev_qes5fw45/` **均未被创建**；
- 原 `WebDavAdapter` 缺少父级目录的递归探测与 `MKCOL` 建立能力，直接发起 `PUT` 必然触发 409（部分反向代理会转换或伴随 403）。

经过实测验证：
```bash
curl -X MKCOL 'https://proxy.example.com/proxy/dav.example.com/dav/root/knowledge/default/' -> 201 Created
```
一旦父目录通过 `MKCOL` 建立，该层级的写入即可正常执行。

---

## 2. 业界主流方案与现有开源库调研

为确保系统的健壮性，参考并对比了国际成熟的 WebDAV 客户端与存储同步库：

| 开源库 / 工具 | 递归创建目录实现 | 目录已存在处理 (405) | 性能开销控制 (缓存策略) |
| :--- | :--- | :--- | :--- |
| **`webdav-client` (npm `webdav`)** | `createDirectory(path, { recursive: true })`：自顶向下逐层分割并发送 `MKCOL` | 捕获 HTTP 405 Method Not Allowed 并视作成功（RFC 规定已存在集合 MKCOL 应返回 405） | 无内置缓存，每次写流由调用方自行保证或多次请求 |
| **`rclone` (Go WebDAV backend)** | `mkdir(dir)`：按 `/` 分割路径，逐级递增检测并执行 `MKCOL` | 允许 405、200、201、301 等状态码，将 405 视为幂等成功 | **内存目录集合缓存**：使用 `Set<string>` 缓存已确保创建的目录，生命周期内不再发出重复的 `MKCOL` |
| **`Cyberduck / Mountain Duck`** | 预检目录层级，批量并发或流水线化建立层级 | 识别 405 / 409 重新触发父级创建 | 会话级目录树结构缓存，离线/重连时重置 |
| **`Litmus` (WebDAV Compliance Suite)** | 标准测试集包含 `put_conflict`（验证缺少父目录必须 409）与 `mkcol_existing`（验证已存在目录必须 405） | 严格验证 405 响应 | 测试基准 |

### 核心结论
1. **RFC 4918 明确规范**：对已有目录发送 `MKCOL`，标准服务应返回 `405 Method Not Allowed`，客户端应明确将其视为“目录已就绪”而非致命错误。
2. **性能与网络预算**：不能在每一次快照上传时都无脑对 4 层父目录各发一次 `MKCOL`。必须借鉴 `rclone` 的**目录状态缓存模式**，采用内存 `Set` 记录已确保的目录，仅在初次写入新设备/新工作区时执行 `MKCOL`。

---

## 3. 架构设计与设计模式演进

### 3.1 模式一：路径归一化策略 (Path Canonicalization Strategy)

在适配器层建立纯函数式的路径归一化合同，彻底防御调用方、配置项或端点 URL 之间的任何重复包含：

```text
  [Endpoint URL: .../dav/root/knowledge] + [basePath: root/knowledge] + [path: root/knowledge/ws/...]
                                       │
                                       ▼
                       【_buildUrl 归一化策略】
                                       │
  1. 解析 endpoint.pathname，若 pathname 已以 basePath 结尾，则 basePath 记为已提供。
  2. 检查 cleanRel 是否已以 basePath/ 开头或等于 basePath，若是则剥离 leading basePath。
  3. 仅在 endpoint 尚未包含 basePath 时将其插入第一段。
  4. 对 cleanRel 剩余有效段逐段 encodeURIComponent 拼接。
                                       │
                                       ▼
  [标准结果: https://.../dav/root/knowledge/ws/backups/dev_xxx/snap_xxx.json]
```

### 3.2 模式二：父集合递归确保状态机 (Parent Collection State Machine)

为满足 RFC 4918 约束并兼顾低网络开销，在 `WebDavAdapter` 引入状态缓存与幂等创建器：

```mermaid
stateDiagram-v2
    [*] --> CheckCache: put(path, bytes)
    CheckCache --> DirectPut: 父路径已在 _ensuredCollections
    CheckCache --> SplitAncestors: 父路径不在缓存
    
    state SplitAncestors {
        [*] --> LoopSegments
        LoopSegments --> NextSegment: seg 已在缓存
        LoopSegments --> SendMKCOL: seg 不在缓存
        SendMKCOL --> MarkCached: 响应 201 Created / 405 Method Not Allowed / 200 OK
        SendMKCOL --> Error409: 响应 409 (上层缺失)
        Error409 --> LoopSegments: 递归处理上级
        MarkCached --> NextSegment
        NextSegment --> [*]: 所有祖先集合就绪
    }
    
    SplitAncestors --> DirectPut: 祖先目录全部确立
    DirectPut --> PutSuccess: 200 / 201 / 204
    DirectPut --> PutRetryOn409: 意外 409 Conflict
    PutRetryOn409 --> ResetCacheAndRetry: 清理缓存重试一次
    ResetCacheAndRetry --> PutSuccess
    PutSuccess --> [*]
```

---

## 4. 详细代码实现规格

### 4.1 `WebDavAdapter` 核心改造点

#### 1. 实例初始化增加集合缓存
```javascript
export class WebDavAdapter extends RemoteObjectStore {
  constructor(config = {}) {
    super(config);
    // ...
    this._ensuredCollections = new Set();
  }
}
```

#### 2. 防重叠 `_buildUrl(relPath)`
```javascript
_buildUrl(relPath) {
  if (!this.endpoint) throw new RemoteStorageError('WebDAV endpoint not configured');
  let cleanRel = (relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleanRel.includes('..')) throw new RemoteStorageError('Relative path traversal (..) forbidden');

  let endpointPath = '';
  try {
    const u = new URL(this.endpoint);
    endpointPath = u.pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    endpointPath = '';
  }

  const base = this.basePath;
  const endpointEndsWithBase = Boolean(base && (endpointPath === base || endpointPath.endsWith('/' + base)));

  // 若 relPath 已以 basePath 开头，安全剥离
  if (base && (cleanRel === base || cleanRel.startsWith(base + '/'))) {
    cleanRel = cleanRel.slice(base.length).replace(/^\/+/, '');
  }

  const segments = [];
  if (base && !endpointEndsWithBase) {
    segments.push(base);
  }

  if (cleanRel) {
    cleanRel.split('/').forEach(s => {
      const t = s.trim();
      if (t && t !== '.') segments.push(encodeURIComponent(t));
    });
  }

  return `${this.endpoint}/${segments.join('/')}`;
}
```

#### 3. 新增 `mkcol(colPath, signal)`
```javascript
async mkcol(colPath, signal) {
  const url = this._buildUrl(colPath);
  const headers = new Headers();
  const auth = this._getAuthHeader();
  if (auth) headers.set('Authorization', auth);

  let response;
  try {
    response = await fetch(url, { method: 'MKCOL', headers, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new NetworkError(`Network / CORS request failed on MKCOL: ${err.message}`, { cause: err });
  }

  // 201 Created: 新建成功; 405 Method Not Allowed / 200 / 204: 目录已存在，视作成功
  if (response.status === 201 || response.status === 405 || response.status === 200 || response.status === 204) {
    return { created: response.status === 201, exists: true };
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError(`WebDAV authentication rejected on MKCOL (${response.status})`, { statusCode: response.status });
  }

  const text = await response.text().catch(() => '');
  throw new RemoteStorageError(`WebDAV MKCOL HTTP ${response.status}: ${text || response.statusText}`, { statusCode: response.status });
}
```

#### 4. 新增 `ensureParentCollections(filePath, signal)`
```javascript
async ensureParentCollections(filePath, signal) {
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 1) return; // 顶层无父目录
  parts.pop(); // 移除文件名

  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (this._ensuredCollections.has(current)) continue;

    try {
      await this.mkcol(current, signal);
      this._ensuredCollections.add(current);
    } catch (err) {
      if (err.statusCode === 405) {
        this._ensuredCollections.add(current);
      } else {
        throw err;
      }
    }
  }
}
```

#### 5. 改造 `put(path, bytes, options)`
```javascript
async put(path, bytes, options = {}) {
  // 写入前自动确保父级集合已存在
  await this.ensureParentCollections(path, options.signal);

  const headers = { 'Content-Type': options.contentType || 'application/json; charset=utf-8' };
  if (options.ifMatch) headers['If-Match'] = options.ifMatch;
  if (options.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch;

  const body = typeof bytes === 'string' ? bytes : JSON.stringify(bytes);
  let res;
  try {
    res = await this._request('PUT', path, { body, headers, signal: options.signal });
  } catch (err) {
    // 遇到 409 Conflict 异常时，清空祖先目录缓存并重试一次
    if (err.statusCode === 409) {
      this._ensuredCollections.clear();
      await this.ensureParentCollections(path, options.signal);
      res = await this._request('PUT', path, { body, headers, signal: options.signal });
    } else {
      throw err;
    }
  }
  return { etag: res.headers.get('etag') || res.headers.get('ETag') || null };
}
```

---

## 5. 质量门禁与回归验证策略

1. **单测覆盖 (`tests/unit/remote-storage-adapter.test.mjs`)**:
   - 验证 `_buildUrl` 路径防双重嵌套（当 `relPath` 已包含 `basePath`、当 `endpoint` 已包含 `basePath`、当普通相对路径时的各种组合）。
   - 验证 `ensureParentCollections` 逐级发起 `MKCOL` 并兼容 201 和 405 状态码。
   - 验证 `_ensuredCollections` 缓存命中，后续写入不会重复发送 `MKCOL`。
2. **全系统架构门禁 (`gates/run-gates.mjs`)**:
   - 验证 `platform/storage/remote/webdav-adapter.js` 总行数严格受控于 `300` 行以内（满足 `FE-QUALITY-001`）。
   - 保证 21 项门禁全绿，无任何架构降级。
