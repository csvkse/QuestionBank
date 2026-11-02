/**
 * Unit Test: Security & Credential Governance Guard (FE-SEC-001)
 * Path: tests/unit/security-guard.test.mjs
 */

import assert from 'node:assert/strict';
import {
  SecurityGovernanceEngine,
  AssignmentLexerStateMachine,
  HighConfidenceSecretStrategy,
  RfcDomainStrategy,
  SAFE_PLACEHOLDERS
} from '../../gates/security-guard.mjs';

console.log('🧪 Testing Security Governance Guard & Strategies (FE-SEC-001)...');

// 1. 测试标准占位符识别与白名单
{
  assert(SAFE_PLACEHOLDERS.has('your_secure_password_here'), '必须包含标准安全密码占位符');
  assert(SAFE_PLACEHOLDERS.has('sk-proj-test-secret-key-1234567890'), '必须包含标准 API Key 占位符');
  assert(SAFE_PLACEHOLDERS.has('tunnel_0123456789abcdef0123456789abcdef'), '必须包含标准 Tunnel ID 占位符');
  assert(SAFE_PLACEHOLDERS.has('example.com'), '必须包含 RFC 5737 标准示例域名');
}

// 2. 状态机词法分析器 (AssignmentLexerStateMachine) 测试
{
  const sm = new AssignmentLexerStateMachine();

  // 2.1 普通代码行（包含 password 单词但非字面量赋值）应完全放行
  const normalLine1 = "function togglePasswordVisibility() { isVisible = !isVisible; }";
  const normalLine2 = "<input type='password' placeholder='Enter password' />";
  const normalLine3 = "// Check user password length here";
  assert.equal(sm.evaluateLine(normalLine1).length, 0, '普通函数定义不应产生误报');
  assert.equal(sm.evaluateLine(normalLine2).length, 0, 'HTML input 属性不应产生误报');
  assert.equal(sm.evaluateLine(normalLine3).length, 0, '注释中的 password 单词不应产生误报');

  // 2.2 使用合规标准占位符的赋值行应完全放行
  const compliantLine1 = "const password = 'your_secure_password_here';";
  const compliantLine2 = "const apiKey = 'sk-proj-test-secret-key-1234567890';";
  const compliantLine3 = "const adminPwd = '<ADMIN_PASSWORD>';";
  const compliantLine4 = "const token = '';";
  assert.equal(sm.evaluateLine(compliantLine1).length, 0, '合规密码占位符必须通过');
  assert.equal(sm.evaluateLine(compliantLine2).length, 0, '合规 API Key 占位符必须通过');
  assert.equal(sm.evaluateLine(compliantLine3).length, 0, '合规管理员占位符必须通过');
  assert.equal(sm.evaluateLine(compliantLine4).length, 0, '空凭据必须通过');

  // 2.3 未脱敏的硬编码凭据赋值必须被拦截
  const targetField = ['pass', 'word'].join('');
  const violatingLine1 = `const ${targetField} = '` + ['real', 'Password', '999'].join('') + "';";
  const violations1 = sm.evaluateLine(violatingLine1);
  assert.equal(violations1.length, 1, '未脱敏真实密码赋值必须拦截');
  assert.equal(violations1[0].field, 'password');

  const netSecretField = ['network', '_', 'secret'].join('');
  const violatingLine2 = `const ${netSecretField} = '` + ['unmasked', 'token'].join('_') + "';";
  const violations2 = sm.evaluateLine(violatingLine2);
  assert.equal(violations2.length, 1, '未脱敏 EasyTier 组网密钥必须拦截');
}

// 3. 高可信凭据特征策略 (HighConfidenceSecretStrategy) 测试
{
  const strategy = new HighConfidenceSecretStrategy();

  // 3.1 标准占位符 API Key 应放行
  const safeKeyLine = "const key = 'sk-proj-test-secret-key-1234567890';";
  const safeRes = strategy.evaluate(safeKeyLine, { file: 'tests/mock.js', lineNum: 10 });
  assert.equal(safeRes.length, 0, '标准占位符 API Key 应放行');

  // 3.2 真实 OpenAI Key 模式应精准告警
  const liveToken = ['sk-live', 'abcd1234efgh5678ijkl9012mnop3456'].join('-');
  const liveKeyLine = `const key = '${liveToken}';`;
  const liveRes = strategy.evaluate(liveKeyLine, { file: 'app/service.js', lineNum: 20 });
  assert.equal(liveRes.length, 1, '未脱敏真实 API Key 必须被策略拦截');
  assert.equal(liveRes[0].rule, 'FE-SEC-SECRET-KEY');

  // 3.3 私钥夹具 (包含 MOCK_KEY_DATA 放行，未脱敏私钥拦截)
  const mockKeyLine = "const mockPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\\nMOCK_KEY_DATA\\n-----END OPENSSH PRIVATE KEY-----';";
  const mockRes = strategy.evaluate(mockKeyLine, { file: 'tests/fixture.js', lineNum: 1 });
  assert.equal(mockRes.length, 0, '包含 MOCK_KEY_DATA 的测试私钥夹具必须放行');

  const realKeyHeader = "-----BEGIN " + "RSA PRIVATE KEY-----";
  const realKeyRes = strategy.evaluate(realKeyHeader, { file: 'features/auth.js', lineNum: 1, fileContent: realKeyHeader });
  assert.equal(realKeyRes.length, 1, '未脱敏私钥头必须被拦截');
}

// 4. RFC 5737 域名规范策略 (RfcDomainStrategy) 测试
{
  const rfcStrategy = new RfcDomainStrategy();

  // 4.1 docs/ 下的 RFC 示例域名放行
  const validDocLine = "curl -X POST https://api.example.com/v1/recommend";
  const validDocRes = rfcStrategy.evaluate(validDocLine, { file: 'docs/api.md', lineNum: 5 });
  assert.equal(validDocRes.length, 0, 'RFC 5737 示例域名必须放行');

  // 4.2 docs/ 下的官方 CDN 与技术官网放行
  const cdnDocLine = "<script src='https://cdn.tailwindcss.com'></script>";
  const cdnDocRes = rfcStrategy.evaluate(cdnDocLine, { file: 'docs/preview.html', lineNum: 8 });
  assert.equal(cdnDocRes.length, 0, '官方合法 CDN 必须放行');

  // 4.3 docs/ 下出现非 RFC 真实服务域名告警
  const invalidDocLine = "const endpoint = 'https://api.my-real-server.xyz/v1';";
  const invalidDocRes = rfcStrategy.evaluate(invalidDocLine, { file: 'docs/deploy.md', lineNum: 12 });
  assert.equal(invalidDocRes.length, 1, '非 RFC 5737 外网真实域名必须发出 WARN 告警');
  assert.equal(invalidDocRes[0].rule, 'FE-SEC-RFC5737-DOMAIN');
}

// 5. 核心治理扫描引擎 (SecurityGovernanceEngine) 综合测试
{
  const engine = new SecurityGovernanceEngine();
  const testContent = `
    const standardKey = 'sk-proj-test-secret-key-1234567890';
    const standardPwd = 'your_secure_password_here';
    const safeUrl = 'https://example.com/dav/';
  `;
  const findings = engine.scanFile('docs/compliant_test.md', testContent);
  assert.equal(findings.length, 0, '完全符合规范的文档和代码行应零告警');
}

console.log('✅ security-guard.test.mjs PASSED!');
