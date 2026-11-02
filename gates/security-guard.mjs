/**
 * Security & Credential Governance Guard (FE-SEC-001)
 * 
 * Design Patterns Employed:
 * 1. Strategy Pattern: Modular evaluation strategies (SecretStrategy, AssignmentEntropyStrategy, RfcDomainStrategy).
 * 2. State Machine Pattern: Lexical assignment scanner to eliminate false-positive keyword hits.
 * 3. Adapter Pattern: Adapters for Git pre-commit hook, Quality Gate (run-gates.mjs), and CLI audit.
 * 
 * Zero external dependencies: Built with native Node.js ESM.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();

// ============================================================================
// 1. 标准占位符白名单与安全常数 (RFC 5737 & Standard Placeholders)
// ============================================================================

export const SAFE_PLACEHOLDERS = new Set([
  'tunnel_0123456789abcdef0123456789abcdef',
  'sk-proj-test-secret-key-1234567890',
  'sk-test-super-secret-12345',
  'lwt_live_8f3a9e',
  'your_secure_password_here',
  '<ADMIN_PASSWORD>',
  'demo_net',
  'demo_secret_token',
  'wss://easytier-peer.example.com',
  'example.com',
  'api.example.com',
  'dav.example.com',
  'proxy.example.com',
  'worker.example.com',
  'gateway.example.com.com',
  'console.example.com',
  '127.0.0.1',
  'localhost',
  '0.0.0.0'
]);

export const APPROVED_PUBLIC_CDNS_AND_DOMAINS = new Set([
  'github.com',
  'github.io',
  'raw.githubusercontent.com',
  'cloudflare.com',
  'unpkg.com',
  'jsdelivr.net',
  'cdnjs.cloudflare.com',
  'tailwindcss.com',
  'esm.sh',
  'w3.org',
  'schema.org',
  'mozilla.org',
  'openai.com',
  'anthropic.com',
  'deepseek.com',
  'openrouter.ai',
  'groq.com',
  'moonshot.cn',
  'siliconflow.cn',
  'aliyuncs.com',
  'web.dev',
  'ajv.js.org',
  'nodejs.org',
  'ietf.org',
  'datatracker.ietf.org'
]);

// 默认排除路径
export const DEFAULT_EXCLUDES = [
  'node_modules/**',
  'dist/**',
  'archive/**',
  'vendor/**',
  'docs_secret/**',
  'env/**',
  '.env*',
  'package-lock.json',
  '*.png', '*.jpg', '*.jpeg', '*.svg', '*.ico', '*.woff', '*.woff2'
];

// ============================================================================
// 2. 状态机模式：赋值语法语义分析 (Assignment Lexer State Machine)
// ============================================================================

export class AssignmentLexerStateMachine {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = 'IDLE'; // IDLE -> KEYWORD -> ASSIGN_OP -> STRING_LITERAL
    this.matchedKeyword = '';
  }

  /**
   * 分析代码行中的敏感词赋值，避免对普通单词、注释或函数调用的误报
   */
  evaluateLine(line) {
    const findings = [];
    // 快速探针：如果行内不包含赋值符与常见敏感标识符，立即跳过
    if (!line.includes('=') && !line.includes(':')) return findings;
    
    // 敏感关键字探针
    const sensitiveKeyRegex = /\b(password|passwd|secret|api[_-]?key|auth[_-]?token|network[_-]?secret|tunnel[_-]?id)\b/i;
    const keyMatch = line.match(sensitiveKeyRegex);
    if (!keyMatch) return findings;

    // 匹配字面量赋值: key = 'value' 或 key: "value"
    const assignRegex = /\b(password|passwd|secret|api[_-]?key|auth[_-]?token|network[_-]?secret|tunnel[_-]?id)\s*[:=]\s*(['"`])([^'"`\r\n]+)\2/gi;
    let match;
    while ((match = assignRegex.exec(line)) !== null) {
      const field = match[1];
      const value = match[3].trim();

      // 判断是否属于合法安全占位符
      if (this.isSafePlaceholder(field, value)) {
        continue;
      }

      // 评估是否可疑
      findings.push({
        type: 'UNSANITIZED_CREDENTIAL_ASSIGNMENT',
        field,
        value,
        details: `Field '${field}' is assigned unsanitized literal value: '${value}'`
      });
    }

    return findings;
  }

  isSafePlaceholder(field, value) {
    if (!value || value === '' || value === 'null' || value === 'undefined') return true;
    const lowerVal = value.toLowerCase();
    
    // 标准占位符判断
    for (const safe of SAFE_PLACEHOLDERS) {
      if (lowerVal === safe.toLowerCase() || lowerVal.includes(safe.toLowerCase())) {
        return true;
      }
    }

    // 常见单元测试 Mock 约定前缀
    if (
      lowerVal.startsWith('mock_') ||
      lowerVal.startsWith('test_') ||
      lowerVal.startsWith('dummy_') ||
      lowerVal.startsWith('placeholder_') ||
      lowerVal.startsWith('your_') ||
      lowerVal.startsWith('<') && lowerVal.endsWith('>') ||
      lowerVal === 'none' ||
      lowerVal === 'password' ||
      lowerVal === 'ollama' // 平台预设保留值
    ) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// 3. 策略模式：可插拔安全检测策略 (Detection Strategies)
// ============================================================================

export class HighConfidenceSecretStrategy {
  constructor() {
    this.name = 'HighConfidenceSecretStrategy';
  }

  evaluate(line, context) {
    const findings = [];

    // 1. OpenAI / 常见 LLM 真实密钥特征 (sk-[20+ chars])
    const skMatches = line.matchAll(/\b(sk-[a-zA-Z0-9_\-]{20,})\b/g);
    for (const m of skMatches) {
      const token = m[1];
      if (
        token !== 'sk-proj-test-secret-key-1234567890' &&
        token !== 'sk-test-super-secret-12345' &&
        !token.startsWith('sk-proj-test') &&
        !token.startsWith('sk-test')
      ) {
        findings.push({
          rule: 'FE-SEC-SECRET-KEY',
          severity: 'ERROR',
          message: `Suspicious API Secret Key detected: ${token.substring(0, 10)}...`,
          line: context.lineNum,
          file: context.file
        });
      }
    }

    // 2. 私钥文件头 (BEGIN PRIVATE KEY)
    if (/-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE KEY-----/.test(line)) {
      if (!line.includes('MOCK_KEY_DATA') && !context.fileContent?.includes('MOCK_KEY_DATA')) {
        findings.push({
          rule: 'FE-SEC-PRIVATE-KEY',
          severity: 'ERROR',
          message: 'Unsanitized private key header detected. Use mockPrivateKey with MOCK_KEY_DATA.',
          line: context.lineNum,
          file: context.file
        });
      }
    }

    // 3. GitHub Personal Access Token / Fine-grained Token
    if (/\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{82})\b/.test(line)) {
      findings.push({
        rule: 'FE-SEC-GITHUB-TOKEN',
        severity: 'ERROR',
        message: 'Live GitHub access token pattern detected.',
        line: context.lineNum,
        file: context.file
      });
    }

    // 4. AWS Access Key
    if (/\b(AKIA[0-9A-Z]{16})\b/.test(line)) {
      findings.push({
        rule: 'FE-SEC-AWS-KEY',
        severity: 'ERROR',
        message: 'AWS Access Key pattern detected.',
        line: context.lineNum,
        file: context.file
      });
    }

    return findings;
  }
}

export class RfcDomainStrategy {
  constructor() {
    this.name = 'RfcDomainStrategy';
  }

  evaluate(line, context) {
    const findings = [];
    // 仅在 docs/ 规范文档或主要配置文件中严格限制非 RFC 域名
    if (!context.file.startsWith('docs/') && !context.file.startsWith('app/')) {
      return findings;
    }

    const urlMatches = line.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?::\d+)?([^\s'"`<>)]*)/gi);
    for (const m of urlMatches) {
      const fullUrl = m[0];
      const host = m[1].toLowerCase();

      // 判断是否属于合法 RFC 示例域名或官方信任 CDN
      if (
        host === 'example.com' ||
        host.endsWith('.example.com') ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.test') ||
        host.endsWith('.example')
      ) {
        continue;
      }

      const isApprovedCdn = Array.from(APPROVED_PUBLIC_CDNS_AND_DOMAINS).some(domain => 
        host === domain || host.endsWith('.' + domain)
      );

      if (!isApprovedCdn) {
        // 发现非 RFC 5737 规范的外网域名
        findings.push({
          rule: 'FE-SEC-RFC5737-DOMAIN',
          severity: 'WARN',
          message: `Non-RFC 5737 example domain in public documentation/UI: ${fullUrl}. Suggest using *.example.com`,
          line: context.lineNum,
          file: context.file
        });
      }
    }

    return findings;
  }
}

export class AssignmentLexerStrategy {
  constructor() {
    this.name = 'AssignmentLexerStrategy';
    this.lexer = new AssignmentLexerStateMachine();
  }

  evaluate(line, context) {
    const findings = [];
    const violations = this.lexer.evaluateLine(line);
    for (const v of violations) {
      findings.push({
        rule: 'FE-SEC-UNSANITIZED-ASSIGNMENT',
        severity: 'ERROR',
        message: `${v.details}. Must use standard placeholder (e.g. 'your_secure_password_here' or 'sk-proj-test-secret-key-1234567890').`,
        line: context.lineNum,
        file: context.file
      });
    }
    return findings;
  }
}

// ============================================================================
// 4. 核心治理扫描引擎 (SecurityGovernanceEngine)
// ============================================================================

export class SecurityGovernanceEngine {
  constructor(options = {}) {
    this.strategies = [
      new HighConfidenceSecretStrategy(),
      new AssignmentLexerStrategy(),
      new RfcDomainStrategy()
    ];
    this.excludes = options.excludes || DEFAULT_EXCLUDES;
  }

  /**
   * 检查单个文件
   */
  scanFile(filePath, customContent = null) {
    const findings = [];
    let content = customContent;
    if (content === null) {
      if (!fs.existsSync(filePath)) return findings;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        return findings;
      }
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const context = {
        file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        lineNum,
        fileContent: content
      };

      for (const strategy of this.strategies) {
        const results = strategy.evaluate(line, context);
        if (results && results.length > 0) {
          findings.push(...results);
        }
      }
    });

    return findings;
  }

  /**
   * 全量扫描仓库
   */
  scanAllTrackedFiles() {
    const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);

    const allFindings = [];
    for (const file of trackedFiles) {
      // 排除逻辑
      if (
        file.startsWith('vendor/') ||
        file.startsWith('archive/') ||
        file.startsWith('dist/') ||
        file.startsWith('docs_secret/') ||
        file === 'package-lock.json' ||
        file === 'index.html' ||
        file.endsWith('.png') ||
        file.endsWith('.svg') ||
        file.endsWith('.ico')
      ) {
        continue;
      }

      const findings = this.scanFile(path.join(ROOT_DIR, file));
      allFindings.push(...findings);
    }
    return allFindings;
  }

  /**
   * 扫描暂存区增量代码 (Staged diff)
   */
  scanStagedChanges() {
    const findings = [];
    let diffOutput = '';
    try {
      diffOutput = execSync('git diff --cached -U0', { encoding: 'utf8' });
    } catch (err) {
      return findings;
    }

    if (!diffOutput.trim()) return findings;

    const diffLines = diffOutput.split(/\r?\n/);
    let currentFile = '';
    let currentLineNum = 0;

    for (const line of diffLines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6).trim();
        continue;
      }

      // 解析行号 @@ -1,1 +15,3 @@
      if (line.startsWith('@@')) {
        const match = line.match(/\+([0-9]+)/);
        if (match) {
          currentLineNum = parseInt(match[1], 10) - 1;
        }
        continue;
      }

      // 仅检查新增改动行 (+)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentLineNum++;
        const addedContent = line.substring(1);

        // 跳过忽略文件
        if (
          currentFile.startsWith('docs_secret/') ||
          currentFile.startsWith('vendor/') ||
          currentFile.startsWith('archive/') ||
          currentFile === 'package-lock.json'
        ) {
          continue;
        }

        const context = {
          file: currentFile,
          lineNum: currentLineNum,
          fileContent: addedContent
        };

        for (const strategy of this.strategies) {
          const results = strategy.evaluate(addedContent, context);
          if (results && results.length > 0) {
            findings.push(...results);
          }
        }
      }
    }

    return findings;
  }
}

// ============================================================================
// 5. 适配器模式：不同场景运行适配器 (Adapters)
// ============================================================================

/**
 * 适配器 1: Git pre-commit Hook 拦截适配器
 */
export function runGitHookAdapter() {
  console.log('🔍 [Pre-Commit Hook] Auditing staged changes for credential safety...');
  const engine = new SecurityGovernanceEngine();
  const findings = engine.scanStagedChanges();

  const errors = findings.filter(f => f.severity === 'ERROR');
  const warnings = findings.filter(f => f.severity === 'WARN');

  if (warnings.length > 0) {
    console.warn(`\n⚠️  [WARN] ${warnings.length} non-RFC / non-standard items detected:`);
    warnings.forEach(w => {
      console.warn(`   • [${w.rule}] ${w.file}:${w.line} -> ${w.message}`);
    });
  }

  if (errors.length > 0) {
    console.error(`\n❌ [BLOCKED] Git commit rejected! Found ${errors.length} unsanitized credential violations:`);
    errors.forEach(e => {
      console.error(`   • [${e.rule}] ${e.file}:${e.line} -> ${e.message}`);
    });
    console.error('\n💡 Please desensitize using standard placeholders from AGENTS.md or move sensitive diagnostic data to docs_secret/ (untracked).');
    process.exit(1);
  }

  console.log('✅ [Pre-Commit Hook] Credential audit passed. No unsanitized secrets detected.');
  process.exit(0);
}

/**
 * 适配器 2: Quality Gate 门禁适配器 (用于集成进 run-gates.mjs)
 */
export function evaluateQualityGate() {
  const engine = new SecurityGovernanceEngine();
  const findings = engine.scanAllTrackedFiles();
  const allErrors = findings.filter(f => f.severity === 'ERROR');
  const warnings = findings.filter(f => f.severity === 'WARN');

  // 读取 baseline.json 历史容忍债务
  let toleratedList = [];
  try {
    const baselinePath = path.join(ROOT_DIR, 'gates', 'baseline.json');
    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
      toleratedList = baseline.toleratedDebts?.['FE-SEC-001'] || [];
    }
  } catch (e) {}

  const activeErrors = [];
  const toleratedErrors = [];

  for (const err of allErrors) {
    const key = `${err.file}:${err.line}`;
    if (toleratedList.includes(key)) {
      toleratedErrors.push(err);
    } else {
      activeErrors.push(err);
    }
  }

  const passed = activeErrors.length === 0;

  return {
    passed,
    activeErrors,
    toleratedErrors,
    warnings,
    summary: passed
      ? (toleratedErrors.length > 0
          ? `PASS: Zero new credential leaks (${toleratedErrors.length} legacy debts tolerated in baseline for scheduled history rewrite)`
          : 'PASS: 100% compliant with Credential Governance & Desensitization Spec')
      : `FAIL: ${activeErrors.length} new unsanitized credential violations detected!`
  };
}

// 若直接通过 node gates/security-guard.mjs 调用
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('gates/security-guard.mjs')) {
  const arg = process.argv[2];
  if (arg === '--hook') {
    runGitHookAdapter();
  } else if (arg === '--gate') {
    const res = evaluateQualityGate();
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.passed ? 0 : 1);
  } else {
    console.log('Knowledge Arena Security Governance Guard');
    console.log('Usage:');
    console.log('  node gates/security-guard.mjs --hook    (Run as Git pre-commit hook)');
    console.log('  node gates/security-guard.mjs --gate    (Run as Quality Gate check)');
  }
}
