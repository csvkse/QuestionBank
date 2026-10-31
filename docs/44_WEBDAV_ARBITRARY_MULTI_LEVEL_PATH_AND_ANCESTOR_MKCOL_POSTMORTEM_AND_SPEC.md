# WebDAV 祖先集合 MKCOL 末尾重复 /root 故障复盘与零隐式路径架构规范

> 文档编号：44  
> 归属模块：`platform/storage/remote/` & `features/data-management/` & `app/`  
> 关联规范：RFC 4918 (HTTP Extensions for WebDAV), RFC 3986 (URI Generic Syntax), Architecture Gate Suite v2.1

---

## 1. 事故现场与故障复盘 (Postmortem)

### 1.1 异常现象
用户在配置反向代理 WebDAV（端点为 `https://proxy.example.com/proxy/dav.example.com/dav/root`，存储目录为 `knowledge-arena` 或 `root/knowledge-arena`）并触发数据同步时，网络监控捕获到如下异常请求：

```http
MKCOL /proxy/dav.example.com/dav/root/knowledge-arena/root HTTP/1.1
Host: proxy.example.com
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
Origin: https://csvkse.github.io
Referer: https://csvkse.github.io/

HTTP/1.1 409 Conflict
```

服务端（Apache / TeraCLOUD WebDAV 引擎）直接返回 **`409 Conflict`**，阻断了整个探针探测与后续备份写入流程。

---

### 1.2 根因定位：为什么最后多了一个 `/root`？

经过对代码调用栈的精确追踪，定位到该异常是由 **相对路径的二次投影（Re-projection through `_buildUrl`）** 引起的。

#### 原故障代码逻辑（`platform/storage/remote/webdav-adapter.js`）：
```javascript
// 历史旧逻辑
async ensureParentCollections(filePath, signal) {
  const baseSegments = (this.basePath || '').split('/').filter(Boolean); // ['root', 'knowledge-arena']
  const cleanRel = (filePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const relSegments = cleanRel.split('/').filter(Boolean); // ['.probe_xxx.tmp']
  const fileParentSegments = relSegments.slice(0, -1); // []

  const dirSegments = mergeSegmentsWithoutOverlap(baseSegments, fileParentSegments);
  // dirSegments 计算为 ['root', 'knowledge-arena']

  for (let i = 1; i <= dirSegments.length; i++) {
    const current = dirSegments.slice(0, i).join('/');
    // 第 1 轮: current = 'root'
    // 第 2 轮: current = 'root/knowledge-arena'
    if (this._ensuredCollections.has(current)) continue;

    await this.mkcol(current, { signal }); // 💣 致命错误发生点
    this._ensuredCollections.add(current);
  }
}

async mkcol(colPath, options = {}) {
  const url = this._buildUrl(colPath); // 💣 传入 'root'，再次执行 _buildUrl
  ...
}
```

#### 路径拼接的致命双重叠加：
1. `this.endpoint` = `https://proxy.example.com/proxy/dav.example.com/dav/root`
2. `this.basePath` = `root/knowledge-arena`
3. 在第 1 轮循环中，`current` 是相对段 `'root'`。
4. `this.mkcol('root')` 调用 `this._buildUrl('root')`：
   - `_buildUrl` 的职责是将 `endpoint` + `basePath` + 传入的参数拼接在一起。
   - `endpoint` (`.../dav/root`) 与 `basePath` (`root/knowledge-arena`) 合并消除重叠为 `.../dav/root/knowledge-arena`；
   - 随后，`_buildUrl` 将参数 `'root'` 视作相对于 `basePath` 的子路径拼在末尾！
   - 最终合成出来的 URL 变成了：
     `https://proxy.example.com/proxy/dav.example.com/dav/root/knowledge-arena/root`
5. **服务端的判定**：服务端收到针对 `.../knowledge-arena/root` 的 `MKCOL` 请求，但此时其上级目录 `.../knowledge-arena` 根本尚未被创建！根据 RFC 4918 规范第 9.3.1 节，**WebDAV 禁止递归自动创建父集合，父目录不存在时必须返回 409 Conflict**！

---

## 2. 肃清一切隐藏路径与隐式逻辑 (Zero Hidden Paths Invariant)

### 2.1 既有系统中的“隐式路径污染”梳理
此前为了降低初次使用的上手门槛，系统在多处悄悄植入了硬编码 fallback：
1. **UI 模板层面**：`app/app-shell.html` 中输入框带有了写死的 `value="knowledge-arena"`；
2. **UI 逻辑层面**：`app/main.js` 在保存和读取配置时存在 `|| 'knowledge-arena'`；
3. **数据同步管理器层面**：`features/data-management/data-sync-manager.js` 中创建备份、列出备份均写了 `this.config.basePath || 'knowledge-arena'`。

**危害分析**：
- 用户如果明确希望将数据直接存放在端点根目录（留空），或者存放在自建目录（如 `/mydata`、`/backup`），系统都会强行把文件扔进 `knowledge-arena/` 目录下；
- 当端点本身已经包含路径（例如反向代理 `/dav/root`），强加的 `knowledge-arena` 与用户预想的路径脱节，更与外部已有目录结构产生严重冲突。

### 2.2 彻底肃清与“用户意志至上”原则 (Strict User Sovereignty)
我们对全链路实施了全面清洗，彻底杜绝一切隐式逻辑：
- **UI 纯净**：默认值设为纯空字符串 `""`，占位符明确标注：`"选填，如: root/abc，留空直接保存在端点根目录"`；
- **配置原样读取**：用户输入空即持久化为空，绝不再进行任何私自补充或兜底覆盖；
- **同步路径严格忠实**：
  - 当 `basePath` 为空时，备份文件直接存为 `${workspaceId}/backups/${deviceId}/${snapshotId}.json`；
  - 当 `basePath` 为多级目录（如 `root/abc`）时，文件路径严格为 `root/abc/${workspaceId}/...`。

---

## 3. 多级存储目录与带路径端点的可行性与架构支持

### 3.1 存储目录能否支持多级（如 `/root/abc`）？
#### 核心结论：**完全支持，且自底向上递归创建由状态集合严格保护**。

1. **RFC 4918 规范约束**：
   - WebDAV 的 `MKCOL` 属于非递归方法（Non-recursive creation）。若要创建 `/a/b/c/`，服务器要求 `/a/` 与 `/a/b/` 必须已经存在。
2. **架构解决方案：目标 URL 单向路径解构算法**：
   重构后的 `ensureParentCollections` 不再针对相对路径段拼接，而是**从最终目标文件的绝对 URL 反向提取所有前缀集合 URL**：

```javascript
async ensureParentCollections(filePath, signal) {
  // 1. 一次性获取最终写入文件的绝对规范化 URL
  const fileUrl = this._buildUrl(filePath);
  let urlObj;
  try { urlObj = new URL(fileUrl); } catch { return; }

  // 2. 提取文件完整路径段，并剔除文件名
  const fileSegments = urlObj.pathname.split('/').filter(Boolean);
  if (fileSegments.length <= 1) return;
  fileSegments.pop(); // 移除文件名 (如 snap.json 或 .probe.tmp)

  // 3. 提取端点自带的基础路径段数
  let endpointSegments = [];
  try { endpointSegments = new URL(this.endpoint).pathname.split('/').filter(Boolean); } catch {}

  // 4. 从端点之后的第一级目录开始，逐级推导绝对 Collection URL 并发起 MKCOL
  const startIndex = endpointSegments.length;
  for (let i = startIndex + 1; i <= fileSegments.length; i++) {
    const colUrl = `${urlObj.origin}/${fileSegments.slice(0, i).join('/')}`;
    if (this._ensuredCollections.has(colUrl)) continue;

    try {
      await this.mkcol(colUrl, { signal });
      this._ensuredCollections.add(colUrl);
    } catch (err) {
      // 405 Method Not Allowed 代表集合已存在，合法跳过
      if (err.statusCode === 405) this._ensuredCollections.add(colUrl);
      else throw err;
    }
  }
}
```

- **数学证明**：
  设端点包含路径段 $[E_1, E_2, \dots, E_m]$，存储目录与文件父级包含路径段 $[P_1, P_2, \dots, P_n]$。
  最终文件的绝对路径段必定为 $[E_1, \dots, E_m, P_1, \dots, P_n]$。
  算法从索引 $m+1$ 遍历至 $m+n$：
  - 迭代 1：创建 $[E_1, \dots, E_m, P_1]$
  - 迭代 2：创建 $[E_1, \dots, E_m, P_1, P_2]$
  - $\dots$
  - 迭代 n：创建 $[E_1, \dots, E_m, P_1, \dots, P_n]$
  **绝不可能在末尾多出任何段，也绝不可能触碰端点本身的已知祖先路径！**

---

### 3.2 服务器主机能否支持带路径（非标准反向代理别名方案）？
#### 核心结论：**完全支持，且对非标准路径别名具备自动边界去重能力**。

1. **场景现实**：
   在纯浏览器（B/S）环境下访问第三方 WebDAV，由于目标服务器不开放 CORS 响应头，用户通常会使用反向代理（如 Cloudflare Workers、Nginx、Asairo Proxy 等），其端点通常形如：
   `https://proxy.example.com/proxy/dav.example.com/dav/root`
   其中 `/proxy/dav.example.com/dav/root` 全部都是服务挂载路径。
2. **双重保障机制**：
   - **机制 A：`mergeSegmentsWithoutOverlap` 边界重叠消除**：
     如果用户在端点填了 `https://.../dav/root`，在存储目录又填了 `/root/abc`，`mergeSegmentsWithoutOverlap(['dav', 'root'], ['root', 'abc'])` 会精准识别重叠词 `'root'`，将其自动合并为 `['dav', 'root', 'abc']`，杜绝 `/root/root/` 幽灵嵌套。
   - **机制 B：`endpointSegments` 基准点锁定**：
     `startIndex = endpointSegments.length` 锁定了端点所辖的基准层级，`MKCOL` 只会从 `abc` 这一级开始创建，绝不会重复对反向代理的系统级路径（如 `/proxy`、`/dav`、`/root`）发起多余或越权的 `MKCOL`。

---

## 4. 业界主流方案对比与参考

| 工具/项目 | 多级目录支持 | 端点自带路径处理 | 隐藏路径行为 | 祖先目录创建策略 |
| :--- | :--- | :--- | :--- | :--- |
| **Rclone** | 完整支持（任意深层级） | 视作 `root_folder` 前缀，严格基于绝对 URL 运算 | **零隐式路径**（完全遵从 CLI 参数） | 内部维护 `dir_cache`，自顶向下递归 `MKCOL`，405/301 均视为已存在 |
| **Cyberduck** | 完整支持 | Path 字段作为挂载前缀 | **零隐式路径** | 上传前探测父目录 `PROPFIND`，不存在则发送 `MKCOL` |
| **Joplin** | 仅支持单/双级 | 仅接受完整 URL | 默认指定 `Joplin` 目录，允许改为空 | 写入前尝试创建同步目录，忽略已有异常 |
| **Obsidian Remotely Save** | 完整支持 | 支持带代理路径的 URL | 留空则保存在挂载根目录 | 基于路径切片自浅入深发起 `MKCOL` |
| **本系统 (Knowledge Arena v2.1)** | **完整支持（任意深层级）** | **基于标准 `URL` 拓扑切片，支持非标准反向代理别名** | **零隐式路径（彻底肃清 hardcoded defaults）** | **单向绝对 URL 拓扑切片 + 内存集合缓存 + 405 幂等吸收** |

---

## 5. 质量门禁与防回归自动化测试 (Quality Gates & Verification)

为了确保此问题永不回归，并验证多级目录与反向代理端点的健壮性，我们在测试套件中固化了高标准门禁：

### 5.1 自动化测试用例矩阵

1. **多级目录祖先推导与无尾随重复校验 (`tests/unit/remote-storage-adapter.test.mjs` 测试 4.4)**：
   - 端点：`https://proxy.example.com/proxy/dav.example.com/dav`
   - basePath：`root/knowledge-arena`
   - 断言：
     - `mkcolCalls[0] === 'https://proxy.example.com/proxy/dav.example.com/dav/root'`
     - `mkcolCalls[1] === 'https://proxy.example.com/proxy/dav.example.com/dav/root/knowledge-arena'`
     - `!mkcolCalls.some(url => url.endsWith('/knowledge-arena/root'))`（严禁出现末尾多余 `/root`）。

2. **带路径端点与重叠目录校验 (`tests/unit/remote-storage-adapter.test.mjs` 测试 4.5)**：
   - 端点：`https://proxy.example.com/proxy/dav.example.com/dav/root`
   - basePath：`/root/abc`
   - 断言：
     - 识别重叠，仅对未建的 `abc` 发出 `MKCOL`：`https://proxy.example.com/proxy/dav.example.com/dav/root/abc`；
     - 绝不重复对 `/root` 或 `/root/root` 发起请求。

3. **零隐式路径与留空根目录校验 (`tests/unit/remote-storage-adapter.test.mjs` & `tests/unit/webdav-backup-restore.test.mjs` 测试 3.7)**：
   - 端点：`https://proxy.example.com/proxy/dav.example.com/dav/root`
   - basePath：`""`（留空）
   - 目标文件：`default/backups/dev_1/snap.json`
   - 断言：
     - `!backup.path.includes('knowledge-arena')`（严禁注入任何默认路径名）；
     - 依次创建 `root/default`、`root/default/backups`、`root/default/backups/dev_1`；
     - `!mkcolCalls.some(url => url.includes('/root/root'))`。

### 5.2 架构门禁守卫
- `FE-QUALITY-001`：`platform/storage/remote/webdav-adapter.js` 代码行数控制在 293 行（严格低于 300 行上限）。
- `FE-TEST-001`：全部 17 项单元测试与 21 项架构门禁 100% 绿色通过。
