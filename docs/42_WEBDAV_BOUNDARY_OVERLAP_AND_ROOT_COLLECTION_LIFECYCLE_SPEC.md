# WebDAV 边界段重叠消除与根集合生命周期保障规范

> 文档编号：42  
> 归属模块：`platform/storage/remote/webdav-adapter.js` & `features/data-management/`  
> 关联标准：RFC 4918 (WebDAV), RFC 3986 (URI Generic Syntax), Apache mod_dav Architecture

---

## 1. 真实故障现场深入复盘

在用户通过浏览器或 CORS 代理向 WebDAV 发起连接探针测试时，抓包记录如下真实请求与异常响应：

```http
PUT https://proxy.example.com/proxy/dav.example.com/dav/dav/knowledge-arena/.probe_1793469329883_xz38r3.tmp HTTP/1.1
Host: proxy.example.com
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
Content-Type: application/json; charset=utf-8
If-None-Match: *
Origin: https://app.example.com

HTTP/1.1 403 Forbidden
Content-Type: text/html; charset=iso-8859-1

<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>403 Forbidden</title>
</head><body>
<h1>Forbidden</h1>
<p>You don't have permission to access this resource.</p>
</body></html>
```

### 1.1 现象分析与服务器特征识别
响应体为标准的 **Apache HTTP Server 默认错误页面**。通过在线探针测试 TeraCLOUD（InfiniCLOUD）底层服务行为可知：
1. **服务架构**：底层为 Apache 2.4 + `mod_dav` 模块，WebDAV 映射根目录为 `<Location /dav>`。
2. **非法多级路由 `/dav/dav/` 的拦截**：
   当请求路径为 `/dav/dav/knowledge-arena/...` 时，Apache 将其解析为相对于根目录 `/dav/` 下的子目录 `dav/`。由于物理磁盘中不存在此虚构的二级 `dav` 目录且未配置符号链接映射，Apache 核心安全层直接返回 `403 Forbidden`（或 404）。
3. **未建集合单层 `/dav/knowledge-arena/` 的拦截**：
   实测表明，即使消除重复的 `dav`，直接向不存在的 `/dav/knowledge-arena/.probe_xxx.tmp` 发起 `PUT`，Apache 同样会返回 `403 Forbidden`！只有在先执行 `MKCOL /dav/knowledge-arena/` 返回 `201 Created` 后，后续向该目录下的 `PUT` 才能成功返回 `201 Created`。

---

## 2. 两大本质技术缺陷归因

### 2.1 缺陷 A：边界分段重叠拼接缺陷 (Boundary Segment Overlap)

* **产生场景**：
  TeraCLOUD 官方配置手册注明其 WebDAV 连接端点与数据集路径为 `/dav`。因此，常见用户配置习惯包括：
  - 端点填写带 `/dav` 的地址：`https://proxy.example.com/proxy/dav.example.com/dav`
  - 基础路径填写带 `dav` 的路径：`dav/knowledge-arena` 或 `/dav/knowledge-arena`
* **原代码局限性**：
  原 `_buildUrl()` 仅做了简单的末尾与开头子串完全匹配判断（`endpointPath.endsWith('/' + base)`），但当 `endpoint` 的末尾段（`dav`）与 `basePath` 的起始段（`dav`）发生局部重叠时，原逻辑无法识别分段级重叠，直接将两者以 `/` 拼接，产生 `/dav/dav/`。

### 2.2 缺陷 B：根集合生命周期遗漏 (Root Collection Lifecycle Blindspot)

* **产生场景**：
  用户在界面点击“测试连接”时，`WebDavAdapter.probe()` 会在根路径创建探针文件：
  `probeFilename = '.probe_1793469329883_xz38r3.tmp'`
  此时探针文件的直接父目录就是 `this.basePath`（例如 `knowledge-arena`）。
* **原代码局限性**：
  原 `ensureParentCollections(filePath)` 的逻辑为：
  ```javascript
  let clean = filePath.replace(...);
  if (clean.startsWith(this.basePath)) clean = clean.slice(this.basePath.length);
  const parts = clean.split('/').filter(Boolean);
  if (parts.length <= 1) return; // 移除文件名后 parts 为空，直接退出！
  ```
  该逻辑默认假定了 `this.basePath`（应用根集合）已经存在于服务器上，**只负责创建 `basePath` 之下的子目录**！
  对于全新的 WebDAV 账户，服务器上根本不存在 `knowledge-arena` 目录。当探针运行时，`ensureParentCollections` 误判为“无需创建任何目录”，导致未执行 `MKCOL` 就直接发起 `PUT`，被服务端无情返回 `403 Forbidden`。

---

## 3. 业界主流方案调研与算法设计

### 3.1 路径拼接的最长边界重叠消除算法 (Maximal Boundary Overlap Reduction)

在 POSIX 文件系统路径规范及成熟的 WebDAV 客户端（如 `rclone`、`Nextcloud Desktop Client`、`Apache Commons VFS`）中，当合并两个 URI 分段序列 $[A_1, A_2, \dots, A_n]$ 与 $[B_1, B_2, \dots, B_m]$ 时，标准做法是检测并合并其最大公共重叠后缀-前缀：

$$\max_{1 \le k \le \min(n, m)} \{ k \mid [A_{n-k+1}, \dots, A_n] = [B_1, \dots, B_k] \}$$

#### 算法实现：
```javascript
function mergeSegmentsWithoutOverlap(a, b) {
  const max = Math.min(a.length, b.length);
  for (let k = max; k > 0; k--) {
    let match = true;
    for (let i = 0; i < k; i++) {
      if (a[a.length - k + i] !== b[i]) { match = false; break; }
    }
    if (match) return [...a, ...b.slice(k)];
  }
  return [...a, ...b];
}
```

* **数学完备性**：
  - `['proxy', 'dav.example.com', 'dav']` + `['dav', 'knowledge-arena']` $\to$ 重叠段 `['dav']`，合并为 `['proxy', 'dav.example.com', 'dav', 'knowledge-arena']`（消除 `/dav/dav/`）。
  - `['webdav', 'arena-root']` + `['arena-root', 'backups']` $\to$ 重叠段 `['arena-root']`，合并为 `['webdav', 'arena-root', 'backups']`。
  - `['dav']` + `['knowledge-arena']` $\to$ 无重叠，正常拼接为 `['dav', 'knowledge-arena']`。

### 3.2 根集合到叶子集合的完整生命周期确保

根据 RFC 4918 规范，向一个 URL 发起 `PUT` 之前，从根集合到目标文件上一级目录的完整集合链条必须全部存在：

```text
  [Endpoint] -> [Base Collection (e.g. knowledge-arena)] -> [Workspace (default)] -> [backups] -> [deviceId] -> file.json
      ▲                               ▲                               ▲                  ▲             ▲
  (已有挂载)                      (必须确保)                      (必须确保)         (必须确保)    (必须确保)
```

1. **集合链提取**：
   合并 `basePath` 的分段序列与 `filePath`（排除文件名）的分段序列，得到完整的待确保集合链 `dirSegments`。
2. **逐级幂等创建与 405 容错**：
   自顶向下逐级检查内存缓存 `_ensuredCollections`：
   - 未缓存者，发送 `MKCOL`；
   - 响应 `201 Created`（新创）、`405 Method Not Allowed`（RFC 规定目录已存在时返回 405）、`200/204`，均视为就绪并存入缓存；
   - 响应 `401/403` 时抛出鉴权失败；其他错误正常抛出。

---

## 4. 具体代码落地实现

### 4.1 核心改造：`platform/storage/remote/webdav-adapter.js`

1. **重叠消除合并器**：引入 `mergeSegmentsWithoutOverlap`。
2. **三段式归一化构建 `_buildUrl(relPath)`**：
   将 `endpointSegments`、`baseSegments`、`relSegments` 逐级经由重叠消除器合并，再做 URL 编码并拼装完整请求地址。
3. **全层级集合确保 `ensureParentCollections(filePath, signal)`**：
   即使 `filePath` 仅为 `.probe_xxx.tmp`，也能准确识别出必须确保 `basePath`（如 `knowledge-arena`）的存在，先执行 `MKCOL` 建立根集合，杜绝 Apache 403/409。
4. **统一列表路径归一化 `_normalizeListedPath(href)`**：
   准确剔除 `endpoint` 与 `basePath` 组合而成的实际服务器根路径，保证返回相对路径在所有场景下严格一致。

---

## 5. 质量门禁与防回归测试

1. **单测覆盖（`tests/unit/remote-storage-adapter.test.mjs`）**：
   * 验证 `mergeSegmentsWithoutOverlap` 在各类边界组合（包含、重叠、相交、独立）下的严格数学正确性。
   * 验证在端点带有 `/dav` 且基础路径带有 `dav/` 时，生成的 URL 绝无重复 `/dav/dav/`。
   * 验证写入根级文件（如探针 `.probe_xxx.tmp`）时，自动触发针对 `basePath` 的 `MKCOL` 创建。
2. **门禁指标**：
   * 满足 `FE-QUALITY-001`：`platform/storage/remote/webdav-adapter.js` 控制在 300 行以内。
   * 全系统 21 项架构门禁无任何降级。
