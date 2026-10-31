/**
 * Unit Test: Remote Storage Adapters & Multi-Backend Contracts
 * Path: tests/unit/remote-storage-adapter.test.mjs
 */

import {
  createRemoteAdapter,
  MemoryRemoteAdapter,
  WebDavAdapter,
  PreconditionFailedError,
  AuthenticationError,
  NotFoundError,
  NetworkError
} from '../../platform/storage/remote/index.js';

console.log('🧪 Testing remote storage adapters (multi-backend contracts & WebDAV)...');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

// 1. 工厂函数与 MemoryRemoteAdapter 契约校验
{
  const adapter = createRemoteAdapter({ provider: 'memory' });
  assert(adapter instanceof MemoryRemoteAdapter, '工厂应正确返回 MemoryRemoteAdapter 实例');

  // 1.1 探针测试
  const probe = await adapter.probe();
  assert(probe.ok && probe.conditionalReplace, '内存适配器探针应正常且支持条件替换');

  // 1.2 条件创建 (If-None-Match: *)
  const put1 = await adapter.put('backups/snap_1.json', JSON.stringify({ a: 1 }), {
    ifNoneMatch: '*'
  });
  assert(put1.etag, '创建成功应返回强 ETag');

  // 1.3 重复条件创建应触发 412
  let conflictCaught = false;
  try {
    await adapter.put('backups/snap_1.json', JSON.stringify({ a: 2 }), {
      ifNoneMatch: '*'
    });
  } catch (err) {
    if (err instanceof PreconditionFailedError) conflictCaught = true;
  }
  assert(conflictCaught, '重复创建同名资源且携带 If-None-Match:* 必须触发 PreconditionFailedError');

  // 1.4 条件更新 (If-Match)
  const put2 = await adapter.put('backups/snap_1.json', JSON.stringify({ a: 3 }), {
    ifMatch: put1.etag
  });
  assert(put2.etag && put2.etag !== put1.etag, '条件更新成功应推进 ETag');

  // 1.5 过期 ETag 覆盖应被拒绝 (防写丢失)
  let staleEtagCaught = false;
  try {
    await adapter.put('backups/snap_1.json', JSON.stringify({ a: 4 }), {
      ifMatch: put1.etag // 旧 etag
    });
  } catch (err) {
    if (err instanceof PreconditionFailedError) staleEtagCaught = true;
  }
  assert(staleEtagCaught, '基于陈旧 ETag 提交必须抛出 PreconditionFailedError');

  // 1.6 读取与目录检索
  const getRes = await adapter.get('backups/snap_1.json');
  assert(JSON.parse(getRes.bytes).a === 3, '读出内容应为最新提交版本');

  const listRes = await adapter.list('backups/');
  assert(listRes.length === 1 && listRes[0].path === 'backups/snap_1.json', '目录前缀检索应返回匹配对象');

  // 1.7 删除
  await adapter.remove('backups/snap_1.json');
  let notFound = false;
  try {
    await adapter.get('backups/snap_1.json');
  } catch (err) {
    if (err instanceof NotFoundError) notFound = true;
  }
  assert(notFound, '删除后读取应抛出 NotFoundError');
}

// 2. WebDavAdapter 路径安全、鉴权头与 XML 解析校验
{
  const dav = new WebDavAdapter({
    endpoint: 'https://dav.example.com/webdav',
    username: 'testuser',
    password: 'your_secure_password_here',
    basePath: 'arena-root'
  });

  // 2.1 路径防穿越
  let traversalCaught = false;
  try {
    dav._buildUrl('../secrets.json');
  } catch (err) {
    traversalCaught = true;
  }
  assert(traversalCaught, '包含 .. 相对路径必须抛出异常拒绝');

  // 2.2 路径编码与多余斜杠消除
  const cleanUrl = dav._buildUrl('/backups/user 1/snap.json');
  assert(cleanUrl === 'https://dav.example.com/webdav/arena-root/backups/user%201/snap.json', '路径段应正确编码且无重复斜杠');

  // 2.3 Basic 授权头
  const authHeader = dav._getAuthHeader();
  assert(authHeader.startsWith('Basic '), 'Basic 授权头格式应正确');

  // 2.4 Bearer Token 鉴权头
  const tokenDav = new WebDavAdapter({
    endpoint: 'https://dav.example.com',
    token: 'sk-proj-test-secret-key-1234567890'
  });
  assert(tokenDav._getAuthHeader() === 'Bearer sk-proj-test-secret-key-1234567890', 'Token 配置应生成 Bearer 鉴权头');

  // 2.5 RFC 4918 WebDAV 207 Multi-Status XML 零依赖解析验证
  const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/arena-root/backups/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/arena-root/backups/snap_2026.json</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontentlength>4096</D:getcontentlength>
        <D:getetag>"etag-abc-123"</D:getetag>
        <D:getlastmodified>Sun, 01 Nov 2026 00:00:00 GMT</D:getlastmodified>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

  const parsedItems = dav._parseMultistatusXml(mockXml);
  assert(parsedItems.length === 2, 'XML 应解析出 2 个条目');
  assert(parsedItems[0].isDirectory === true, '第 1 项应为 collection (目录)');
  assert(parsedItems[1].isDirectory === false, '第 2 项应为普通文件');
  assert(parsedItems[1].etag === '"etag-abc-123"', 'ETag 应完整提取');
  assert(parsedItems[1].size === 4096, '文件字节大小应解析准确');
  assert(parsedItems[1].path === 'backups/snap_2026.json', '路径归一化应去除 basePath 前缀');
}

// 3. WebDavAdapter 请求异常映射校验 (401 / 404 / 412 / CORS)
{
  const dav = new WebDavAdapter({ endpoint: 'https://dav.example.com' });

  // 替换全局 fetch 为模拟器
  const originalFetch = globalThis.fetch;
  try {
    // 3.1 模拟 401 鉴权失败
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });
    let authFailed = false;
    try {
      await dav.get('file.json');
    } catch (e) {
      if (e instanceof AuthenticationError) authFailed = true;
    }
    assert(authFailed, 'HTTP 401 必须映射为 AuthenticationError');

    // 3.2 模拟 412 CAS 冲突
    globalThis.fetch = async () => new Response('Precondition Failed', {
      status: 412,
      headers: { 'ETag': '"server-etag-999"' }
    });
    let casConflict = false;
    let conflictEtag = null;
    try {
      await dav.put('state.json', '{}', { ifMatch: '"my-old-etag"' });
    } catch (e) {
      if (e instanceof PreconditionFailedError) {
        casConflict = true;
        conflictEtag = e.serverEtag;
      }
    }
    assert(casConflict && conflictEtag === '"server-etag-999"', 'HTTP 412 必须映射为 PreconditionFailedError 并携带远端最新 ETag');

    // 3.3 模拟 404
    globalThis.fetch = async () => new Response('Not Found', { status: 404 });
    let notFound = false;
    try {
      await dav.get('nonexistent.json');
    } catch (e) {
      if (e instanceof NotFoundError) notFound = true;
    }
    assert(notFound, 'HTTP 404 必须映射为 NotFoundError');

    // 3.4 模拟网络断开 / CORS 阻断
    globalThis.fetch = async () => {
      const err = new TypeError('Failed to fetch (CORS header missing)');
      throw err;
    };
    let networkBlocked = false;
    try {
      await dav.get('file.json');
    } catch (e) {
      if (e instanceof NetworkError) networkBlocked = true;
    }
    assert(networkBlocked, 'TypeError 网络/CORS 阻断必须映射为 NetworkError');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('✅ remote-storage-adapter.test.mjs PASSED!');
