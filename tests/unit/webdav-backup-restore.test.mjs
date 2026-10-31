/**
 * Unit Test: WebDAV Backup Creation, Validation & Safe Restoration
 * Path: tests/unit/webdav-backup-restore.test.mjs
 */

import {
  createV3Snapshot,
  computeHash,
  canonicalizeJson,
  validateBackup,
  DataSyncManager
} from '../../features/data-management/index.js';

console.log('🧪 Testing WebDAV v3 backup creation, validation, and safe restoration...');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[AssertionFailed] ${message}`);
  }
}

function createMockAppStorage() {
  const store = {
    profile: {
      version: 2,
      lastActiveAt: 1730419200000,
      deckStates: {
        deck_verbs: { totalAttempts: 50, streak: 8, cards: { ent_1: { attempts: 5 } } }
      }
    },
    customDecks: [
      {
        id: 'deck_custom_1',
        title: '我的考研词汇',
        categories: [{ id: 'cat_1', name: '核心' }],
        entities: [{ id: 'e1', title: 'ephemeral', answer: '短暂的' }]
      }
    ],
    activeDeckId: 'deck_custom_1',
    maskState: true,
    deckVersions: { deck_custom_1: [{ versionId: 'v1', versionName: '初版' }] },
    recycleBin: []
  };

  return {
    store,
    loadProfile() { return JSON.parse(JSON.stringify(store.profile)); },
    saveProfile(p) { store.profile = JSON.parse(JSON.stringify(p)); },
    loadCustomDecks() { return JSON.parse(JSON.stringify(store.customDecks)); },
    saveCustomDecks(d) { store.customDecks = JSON.parse(JSON.stringify(d)); },
    loadActiveDeckId() { return store.activeDeckId; },
    saveActiveDeckId(id) { store.activeDeckId = id; },
    loadMaskState() { return store.maskState; },
    saveMaskState(m) { store.maskState = m; },
    loadDeckVersions() { return JSON.parse(JSON.stringify(store.deckVersions)); },
    saveDeckVersions(v) { store.deckVersions = JSON.parse(JSON.stringify(v)); },
    loadRecycleBin() { return JSON.parse(JSON.stringify(store.recycleBin)); },
    saveRecycleBin(r) { store.recycleBin = JSON.parse(JSON.stringify(r)); }
  };
}

// 1. v3 备份快照构建与敏感信息隔离边界
{
  const localState = {
    profile: { version: 2, deckStates: {} },
    customDecks: [{ id: 'd1', title: '测试库', entities: [] }],
    activeDeckId: 'd1',
    maskState: false,
    aiConfig: { apiKey: 'sk-proj-test-secret-key-1234567890', customEndpoint: 'https://api.example.com' }, // 敏感凭据
    webdavPassword: 'your_secure_password_here'
  };

  const snapshot = await createV3Snapshot({
    workspaceId: 'ws_test',
    deviceId: 'dev_mock_001',
    localRevision: 10,
    state: localState
  });

  assert(snapshot.schemaVersion === 3, '快照 schemaVersion 必须为 3');
  assert(snapshot.snapshotId.startsWith('snap_'), '快照 ID 应符合前缀规范');
  assert(snapshot.contentHash, '必须生成确定性内容哈希');
  assert(snapshot.payload.profile, 'payload 应包含 profile');
  assert(snapshot.payload.customDecks.length === 1, 'payload 应包含自定义题库');

  // 关键安全边界校验：绝不能泄露 aiConfig 与密码
  assert(snapshot.payload.aiConfig === undefined, 'v3 远端快照载荷中严禁包含 aiConfig 凭据');
  assert(snapshot.payload.webdavPassword === undefined, 'v3 远端快照载荷中严禁包含 webdavPassword');
  assert(!JSON.stringify(snapshot).includes('sk-proj-test-secret-key-1234567890'), '序列化后的快照绝无 API 密钥字串');
}

// 2. 备份快照校验器校验 (合法、篡改、防原型污染、v2 兼容)
{
  const validSnapshot = await createV3Snapshot({
    workspaceId: 'default',
    state: {
      profile: { deckStates: { d1: { cards: { c1: {} } } } },
      customDecks: [{ id: 'd1', title: '合法题库', entities: [{ id: 'e1' }] }]
    }
  });

  // 2.1 正常 v3 校验通过
  const resValid = await validateBackup(validSnapshot);
  assert(resValid.valid === true, '合法 v3 快照应校验通过');
  assert(resValid.summary.customDeckCount === 1, '摘要题库数统计应准确');
  assert(resValid.summary.totalEntities === 1, '摘要考点数统计应准确');

  // 2.2 内容被篡改时，哈希校验应拦截
  const tamperedSnapshot = JSON.parse(JSON.stringify(validSnapshot));
  tamperedSnapshot.payload.customDecks[0].title = '被篡改的标题';
  const resTampered = await validateBackup(tamperedSnapshot);
  assert(resTampered.valid === false, '内容被篡改但哈希未变的快照必须被拦截');
  assert(resTampered.error.includes('哈希不匹配'), '应明确提示完整性校验失败');

  // 2.3 防原型污染注入
  const polluted = JSON.parse(JSON.stringify(validSnapshot));
  polluted.payload['__proto__'] = { admin: true };
  const resPolluted = await validateBackup(polluted);
  assert(resPolluted.valid === false, '带有 __proto__ 恶意属性的载荷必须被拦截拒绝');

  // 2.4 兼容旧版 v2 本地备份
  const legacyV2 = {
    version: 2,
    exportedAt: '2026-10-30T00:00:00.000Z',
    profile: { deckStates: {} },
    customDecks: [{ id: 'd_v2', title: 'v2 历史库', entities: [] }],
    activeDeckId: 'd_v2'
  };
  const resV2 = await validateBackup(legacyV2);
  assert(resV2.valid === true && resV2.version === 2, '历史 v2 格式应兼容通过');
}

// 3. DataSyncManager 备份上传、远端列表拉取与带安全回滚点的恢复
{
  const mockStorage = createMockAppStorage();
  const syncManager = new DataSyncManager({ storage: mockStorage });

  // 配置为内存远端存储 (模拟 WebDAV 目标)
  syncManager.saveConfig({
    provider: 'memory',
    basePath: 'test-arena',
    workspaceId: 'team_a'
  });

  // 3.1 连通性探测
  const probe = await syncManager.testConnection();
  assert(probe.ok, '远端连通性探测应成功');

  // 3.2 创建远端备份
  const backupRes = await syncManager.createBackup(() => ({
    profile: mockStorage.loadProfile(),
    customDecks: mockStorage.loadCustomDecks(),
    activeDeckId: mockStorage.loadActiveDeckId(),
    maskState: mockStorage.loadMaskState()
  }), { localRevision: 5 });

  assert(backupRes.success, '备份上传应报告成功');
  assert(backupRes.path.includes('test-arena/team_a/backups/'), '备份存储路径层级应符合设计规范');

  // 3.3 拉取远端备份列表
  const backupList = await syncManager.listBackups();
  assert(backupList.length === 1, '应成功拉取到 1 个远端快照');
  assert(backupList[0].path === backupRes.path, '拉取的快照路径应与上传一致');

  // 3.4 模拟本地数据被更改或损坏
  mockStorage.saveCustomDecks([]);
  mockStorage.saveProfile({ version: 2, deckStates: {} });
  assert(mockStorage.loadCustomDecks().length === 0, '模拟本地数据清空');

  // 3.5 执行远端快照恢复
  const restoreRes = await syncManager.restoreBackup(backupRes.path, mockStorage);
  assert(restoreRes.success, '从远端快照恢复应成功');
  assert(restoreRes.summary.customDeckCount === 1, '恢复后应还原自定义题库');
  assert(mockStorage.loadCustomDecks()[0].title === '我的考研词汇', '题库内容应完整恢复');

  // 3.6 验证本地安全回滚点 (Rollback Safety Point)
  const rollbackPoint = syncManager.getRollbackSafetyPoint();
  assert(rollbackPoint !== null, '恢复前必须自动生成本地回滚安全点');
  assert(rollbackPoint.customDecks.length === 0, '安全回滚点应记录恢复前的本地状态');

  // 3.7 遵守用户输入：basePath 留空时严禁注入任何默认路径 (如 knowledge-arena)
  syncManager.saveConfig({
    provider: 'memory',
    basePath: '',
    workspaceId: 'team_b'
  });
  const backupEmpty = await syncManager.createBackup(() => ({
    profile: { version: 2, deckStates: {} },
    customDecks: [{ id: 'd_empty', title: '无隐藏路径库', entities: [] }]
  }));
  assert(backupEmpty.success, '留空 basePath 上传应成功');
  assert(!backupEmpty.path.includes('knowledge-arena'), 'basePath 留空时严禁包含任何隐藏的 knowledge-arena 路径');
  assert(backupEmpty.path.startsWith('team_b/backups/'), 'basePath 留空时路径必须直接始于工作区/backups');
  const emptyList = await syncManager.listBackups();
  assert(emptyList.some(b => b.path === backupEmpty.path), 'basePath 留空时列表应能准确匹配');
}

console.log('✅ webdav-backup-restore.test.mjs PASSED!');
