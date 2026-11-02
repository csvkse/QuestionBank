/**
 * Unit Test: Remote Storage Adapters & Multi-Backend Contracts
 * Path: tests/unit/remote-storage-adapter.test.mjs
 */

import {
  createRemoteAdapter,
  MemoryRemoteAdapter,
  WebDavAdapter,
  mergeSegmentsWithoutOverlap,
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

  // 2.2b 路径防重复嵌套与端点重叠消除
  const dupUrl = dav._buildUrl('arena-root/backups/user/snap.json');
  assert(dupUrl === 'https://dav.example.com/webdav/arena-root/backups/user/snap.json', '当 relPath 携带 basePath 时不应双重拼接');

  const nestedDav = new WebDavAdapter({
    endpoint: 'https://dav.example.com/webdav/arena-root',
    basePath: 'arena-root'
  });
  const endpointDupUrl = nestedDav._buildUrl('arena-root/backups/user/snap.json');
  assert(endpointDupUrl === 'https://dav.example.com/webdav/arena-root/backups/user/snap.json', '当 endpoint 已包含 basePath 时不应重复追加');

  // 2.2c 边界重叠消除 (如 endpoint /dav 与 basePath dav/ 重叠消除，严禁出现 /dav/dav/)
  const overlapDav = new WebDavAdapter({
    endpoint: 'https://proxy.example.com/proxy/dav.example.com/dav',
    basePath: 'dav/knowledge-arena'
  });
  const probeUrl = overlapDav._buildUrl('.probe_1793469329883_xz38r3.tmp');
  assert(
    probeUrl === 'https://proxy.example.com/proxy/dav.example.com/dav/knowledge-arena/.probe_1793469329883_xz38r3.tmp',
    '端点尾部与基础路径头部重叠的 dav 必须自动消除，严禁出现 /dav/dav/'
  );

  // 2.2d 数学重叠消除算法契约
  assert(mergeSegmentsWithoutOverlap(['dav'], ['dav', 'arena']).join('/') === 'dav/arena', '单段重叠应消除');
  assert(mergeSegmentsWithoutOverlap(['a', 'b', 'c'], ['b', 'c', 'd']).join('/') === 'a/b/c/d', '多段重叠应按最大公共子列消除');
  assert(mergeSegmentsWithoutOverlap(['a'], ['b']).join('/') === 'a/b', '无重叠应正常拼接');

  // 2.2e 多级目录支持校验 (如 /root/abc)
  const multiLevelDav = new WebDavAdapter({
    endpoint: 'https://dav.example.com/webdav',
    basePath: '/root/abc/'
  });
  const multiUrl = multiLevelDav._buildUrl('default/backups/snap.json');
  assert(
    multiUrl === 'https://dav.example.com/webdav/root/abc/default/backups/snap.json',
    '多级 basePath (/root/abc/) 应正确规范化并无缝拼接'
  );
  const normalizedMulti = multiLevelDav._normalizeListedPath('/webdav/root/abc/default/backups/snap.json');
  assert(normalizedMulti === 'default/backups/snap.json', '从多级 basePath 下拉取的路径应正确剥离 /root/abc');

  // 2.2f 反向代理非标别名路径与协议自动补全校验
  const aliasDav = new WebDavAdapter({
    endpoint: 'gateway.example.com:8443/custom/proxy-alias/v1',
    basePath: '/root/abc'
  });
  assert(aliasDav.endpoint.startsWith('https://'), '缺失协议的主机地址应自动补全 https://');
  const aliasUrl = aliasDav._buildUrl('default/snap.json');
  assert(
    aliasUrl === 'https://gateway.example.com:8443/custom/proxy-alias/v1/root/abc/default/snap.json',
    '反向代理带端口与复杂非标别名路径时应完整保留并正确与多级目录拼接'
  );

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

// 4. WebDavAdapter 递归 MKCOL 父集合创建与缓存契约验证
{
  const dav = new WebDavAdapter({
    endpoint: 'https://dav.example.com/webdav',
    basePath: 'arena-root'
  });

  const mkcolCalls = [];
  const putCalls = [];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      const method = options.method || 'GET';
      if (method === 'MKCOL') {
        mkcolCalls.push(url);
        if (url.replace(/\/+$/, '').endsWith('/arena-root')) {
          return new Response('Created', { status: 201 });
        }
        if (url.replace(/\/+$/, '').endsWith('/default/backups')) {
          return new Response('Method Not Allowed', { status: 405 });
        }
        return new Response('Created', { status: 201 });
      }
      if (method === 'PUT') {
        putCalls.push(url);
        return new Response('', { status: 201, headers: { 'ETag': '"put-etag-1"' } });
      }
      return new Response('OK', { status: 200 });
    };

    // 4.1 写入根级探针文件：必须自动确保根集合 arena-root 存在
    const probeRes = await dav.put('.probe_root.tmp', { probe: true });
    assert(probeRes.etag === '"put-etag-1"', '根级探针写入应成功');
    assert(mkcolCalls.length === 1, '应确保根集合 arena-root 存在 (1 次 MKCOL)');
    assert(mkcolCalls[0].replace(/\/+$/, '').endsWith('/arena-root'), '根集合 MKCOL 路径正确');

    // 4.2 首次写入多层深路径：自动逐级执行未缓存的各层 MKCOL
    mkcolCalls.length = 0;
    putCalls.length = 0;
    const res1 = await dav.put('default/backups/dev_001/snap.json', { ok: true });
    assert(res1.etag === '"put-etag-1"', '首次写入应成功');
    assert(mkcolCalls.length === 3, '应按序创建 default, default/backups, default/backups/dev_001 共 3 级子目录 (根级已缓存)');
    assert(mkcolCalls[0].replace(/\/+$/, '').endsWith('/arena-root/default'), '第 1 级子目录 MKCOL 路径正确');
    assert(mkcolCalls[1].replace(/\/+$/, '').endsWith('/arena-root/default/backups'), '第 2 级子目录 MKCOL 路径正确');
    assert(mkcolCalls[2].replace(/\/+$/, '').endsWith('/arena-root/default/backups/dev_001'), '第 3 级子目录 MKCOL 路径正确');
    assert(putCalls.length === 1 && putCalls[0].endsWith('/snap.json'), '最终 PUT 请求路径正确');

    // 4.3 再次写入同级目录文件：应命中 _ensuredCollections 缓存，不再发出任何 MKCOL
    mkcolCalls.length = 0;
    putCalls.length = 0;
    const res2 = await dav.put('default/backups/dev_001/snap_2.json', { ok: true });
    assert(res2.etag === '"put-etag-1"', '二次写入应成功');
    assert(mkcolCalls.length === 0, '目录已缓存时严禁发出多余 MKCOL 请求');
    assert(putCalls.length === 1, '仅发出 1 次 PUT 请求');

    // 4.4 针对多级路径 (如 root/knowledge-arena) 祖先推导：严禁在尾部多出重复 root
    const multiDav = new WebDavAdapter({
      endpoint: 'https://proxy.example.com/proxy/dav.example.com/dav',
      basePath: 'root/knowledge-arena'
    });
    mkcolCalls.length = 0;
    putCalls.length = 0;
    await multiDav.put('.probe_nested.tmp', { probe: true });
    assert(mkcolCalls.length === 2, '多级 basePath 探针应依次创建 root 与 root/knowledge-arena');
    assert(mkcolCalls[0].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root', '第 1 级 MKCOL 为 /dav/root');
    assert(mkcolCalls[1].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root/knowledge-arena', '第 2 级 MKCOL 为 /dav/root/knowledge-arena');
    assert(!mkcolCalls.some(url => url.endsWith('/knowledge-arena/root')), '严禁在末尾出现多余的 /root');

    // 4.5 针对带路径端点 (如 /dav/root) 与重叠/空 basePath (如 /root/abc 或 空)：严禁多余 MKCOL 或路径重叠
    const aliasDav = new WebDavAdapter({
      endpoint: 'https://proxy.example.com/proxy/dav.example.com/dav/root',
      basePath: '/root/abc'
    });
    mkcolCalls.length = 0;
    await aliasDav.put('.probe_alias.tmp', { probe: true });
    assert(mkcolCalls.length === 1, '端点已含 root 时仅创建子目录 abc');
    assert(mkcolCalls[0].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root/abc', 'MKCOL 目标为 /dav/root/abc');

    const emptyDav = new WebDavAdapter({
      endpoint: 'https://proxy.example.com/proxy/dav.example.com/dav/root',
      basePath: ''
    });
    mkcolCalls.length = 0;
    await emptyDav.put('default/backups/dev_1/snap.json', { probe: true });
    assert(mkcolCalls.length === 3, '留空 basePath 时根据嵌套文件逐级创建目录');
    assert(mkcolCalls[0].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root/default');
    assert(mkcolCalls[1].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root/default/backups');
    assert(mkcolCalls[2].replace(/\/+$/, '') === 'https://proxy.example.com/proxy/dav.example.com/dav/root/default/backups/dev_1');
    assert(!mkcolCalls.some(url => url.includes('/root/root')), '严禁出现 /root/root 重复');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log('✅ remote-storage-adapter.test.mjs PASSED!');
