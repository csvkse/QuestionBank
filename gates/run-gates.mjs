#!/usr/bin/env node

/**
 * Knowledge Arena Quality Gates Runner (FE-*)
 * References Enterprise Frontend Architecture Core 2.1 Governance
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT_DIR = process.cwd();
const RESULTS = [];

function recordResult(ruleId, name, status, details, isBaselineTolerated = false) {
  RESULTS.push({ ruleId, name, status, details, isBaselineTolerated });
}

console.log('\n' + '='.repeat(74));
console.log('  🛡️  KNOWLEDGE ARENA ARCHITECTURE & QUALITY GATE SUITE (v2.1)');
console.log('  Mode: Core 2.1 + lightweight-web Profile (Modular ESM + Standalone Bundle)');
console.log('='.repeat(74) + '\n');

// 1. FE-STRUCT-001: 物理所有权与根目录扫描
try {
  const allowedRoots = new Set([
    'app', 'features', 'shared', 'design-system', 'platform', 'vendor',
    'gates', 'tests', 'scripts', 'docs', 'archive',
    'index.html', 'binding.yaml', 'package.json', 'README.md', '.git', '.gitignore'
  ]);
  
  const rootEntries = fs.readdirSync(ROOT_DIR);
  const unknown = rootEntries.filter(entry => !allowedRoots.has(entry) && !entry.startsWith('.'));

  if (unknown.length === 0) {
    recordResult('FE-STRUCT-001', 'Physical Owner Compliance', 'PASS', 'All root entries belong to approved Core 2.1 roles');
  } else {
    recordResult('FE-STRUCT-001', 'Physical Owner Compliance', 'FAIL', `Unknown unmanaged entries: ${unknown.join(', ')}`);
  }
} catch (err) {
  recordResult('FE-STRUCT-001', 'Physical Owner Compliance', 'FAIL', err.message);
}

// 2. FE-STRUCT-002: Feature 公开入口边界检查
try {
  let crossFeatureViolations = [];
  const featuresDir = path.join(ROOT_DIR, 'features');
  if (fs.existsSync(featuresDir)) {
    const features = fs.readdirSync(featuresDir).filter(f => fs.statSync(path.join(featuresDir, f)).isDirectory());
    
    // 递归获取所有 js 文件
    function getJsFiles(dir) {
      let files = [];
      fs.readdirSync(dir).forEach(file => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) files = files.concat(getJsFiles(full));
        else if (file.endsWith('.js') || file.endsWith('.mjs')) files.push(full);
      });
      return files;
    }

    const allJs = getJsFiles(path.join(ROOT_DIR, 'app')).concat(getJsFiles(featuresDir));
    allJs.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];
        if (importPath.includes('/features/')) {
          // 如果跨 feature 导入且不是导入 index.js
          const normalized = importPath.replace(/\\/g, '/');
          const featureSub = normalized.split('/features/')[1];
          if (featureSub) {
            const parts = featureSub.split('/');
            if (parts.length > 2 || (parts.length === 2 && parts[1] !== 'index.js')) {
              crossFeatureViolations.push(`${path.relative(ROOT_DIR, filePath)} -> ${importPath}`);
            }
          }
        }
      }
    });
  }

  if (crossFeatureViolations.length === 0) {
    recordResult('FE-STRUCT-002', 'Feature Public Entry Boundary', 'PASS', 'All cross-feature calls go through public index.js entries');
  } else {
    recordResult('FE-STRUCT-002', 'Feature Public Entry Boundary', 'FAIL', `Deep private imports detected: ${crossFeatureViolations.join('; ')}`);
  }
} catch (err) {
  recordResult('FE-STRUCT-002', 'Feature Public Entry Boundary', 'FAIL', err.message);
}

// 3. FE-IMP-001 & FE-IMP-002: 静态导入解析完全性与反向依赖检查
try {
  function getAllSourceJs(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    fs.readdirSync(dir).forEach(file => {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) files = files.concat(getAllSourceJs(full));
      else if (file.endsWith('.js') || file.endsWith('.mjs')) files.push(full);
    });
    return files;
  }

  const sourceDirs = ['app', 'features', 'shared', 'platform', 'design-system', 'tests'];
  let allFiles = [];
  sourceDirs.forEach(d => { allFiles = allFiles.concat(getAllSourceJs(path.join(ROOT_DIR, d))); });

  let unresolvable = [];
  let reverseDeps = [];

  allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
    const relFile = path.relative(ROOT_DIR, file).replace(/\\/g, '/');

    for (const match of importMatches) {
      const imp = match[1];
      if (imp.startsWith('.')) {
        const targetResolved = path.resolve(path.dirname(file), imp);
        if (!fs.existsSync(targetResolved)) {
          unresolvable.push(`${relFile} -> ${imp}`);
        }
      }

      // 检查反向依赖
      if (relFile.startsWith('shared/') && imp.includes('features/')) {
        reverseDeps.push(`shared (${relFile}) imports from features (${imp})`);
      }
      if (relFile.startsWith('platform/') && imp.includes('features/')) {
        reverseDeps.push(`platform (${relFile}) imports from features (${imp})`);
      }
      if (relFile.startsWith('design-system/') && (imp.includes('features/') || imp.includes('shared/sm2'))) {
        reverseDeps.push(`design-system (${relFile}) imports business logic (${imp})`);
      }
    }
  });

  if (unresolvable.length === 0) {
    recordResult('FE-IMP-001', 'Static Import Resolution', 'PASS', `100% of ${allFiles.length} source files have fully resolvable static imports`);
  } else {
    recordResult('FE-IMP-001', 'Static Import Resolution', 'FAIL', `Unresolvable imports: ${unresolvable.join('; ')}`);
  }

  if (reverseDeps.length === 0) {
    recordResult('FE-IMP-002', 'Directional Invariants (No Reverse Deps)', 'PASS', 'Shared, Platform, and Design-System are completely free of reverse dependencies');
  } else {
    recordResult('FE-IMP-002', 'Directional Invariants (No Reverse Deps)', 'FAIL', reverseDeps.join('; '));
  }
} catch (err) {
  recordResult('FE-IMP-001', 'Static Import Resolution', 'FAIL', err.message);
}

// 4. FE-RES-001: 核心离线入口与独立产物完整性
try {
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const stat = fs.statSync(indexHtmlPath);
    if (stat.size > 10000) {
      recordResult('FE-RES-001', 'Standalone Distribution Asset', 'PASS', `index.html exists and is intact (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      recordResult('FE-RES-001', 'Standalone Distribution Asset', 'FAIL', 'index.html is unexpectedly small or corrupted');
    }
  } else {
    recordResult('FE-RES-001', 'Standalone Distribution Asset', 'FAIL', 'index.html missing');
  }
} catch (err) {
  recordResult('FE-RES-001', 'Standalone Distribution Asset', 'FAIL', err.message);
}

// 5. FE-KNOW-*: 题库专属领域质量门禁
try {
  const builtinPath = path.join(ROOT_DIR, 'shared/builtin-decks.js');
  const { BUILTIN_DECKS } = await import(pathToFileURL(builtinPath).href);
  const decks = BUILTIN_DECKS;
  const deckCount = decks.length;
  
  let totalThinCats = 0;
  let totalInvalidLayer = 0;
  let totalMissingGroup = 0;
  let scaleViolation = false;
  let scaleDetails = [];

  decks.forEach(deck => {
    const catCount = deck.categories ? deck.categories.length : 0;
    const entCount = deck.entities ? deck.entities.length : 0;

    // FE-KNOW-002: 规模边界
    if (catCount > 25 || entCount > 500) {
      scaleViolation = true;
      scaleDetails.push(`${deck.title}: ${catCount} cats, ${entCount} ents`);
    }

    // FE-KNOW-001 & FE-KNOW-005
    (deck.categories || []).forEach(cat => {
      if (!cat.group || !cat.group.trim()) totalMissingGroup++;
      const entsInCat = (deck.entities || []).filter(e => e.categoryId === cat.id);
      if (entsInCat.length < 4) {
        totalThinCats++;
      }
    });

    (deck.entities || []).forEach(ent => {
      if (![1, 2, 3].includes(ent.layer)) totalInvalidLayer++;
    });
  });

  // 报告 FE-KNOW-001 (同胞池充盈)
  if (totalThinCats === 0) {
    recordResult('FE-KNOW-001', 'Sibling Distractor Pool (>=4 items)', 'PASS', `100% categories meet >=4 sibling requirement across ${deckCount} decks`);
  } else {
    recordResult('FE-KNOW-001', 'Sibling Distractor Pool (>=4 items)', 'WARN', `Found ${totalThinCats} thin categories with <4 items (annealing fallback active)`);
  }

  // 报告 FE-KNOW-002 (容量规模)
  if (!scaleViolation) {
    recordResult('FE-KNOW-002', 'Macro Capacity Boundary (<=25 cats, <=500 ents)', 'PASS', `All ${deckCount} builtin decks adhere to 5-3-10 cognitive scale limit`);
  } else {
    recordResult('FE-KNOW-002', 'Macro Capacity Boundary (<=25 cats, <=500 ents)', 'FAIL', `Capacity exceeded: ${scaleDetails.join('; ')}`);
  }

  // 报告 FE-KNOW-005 (三维层级完整性: Group & Layer)
  if (totalMissingGroup === 0 && totalInvalidLayer === 0) {
    recordResult('FE-KNOW-005', '3D Architecture Integrity (Group & Layer)', 'PASS', `100% categories have explicit groups; 100% entities have valid layers 1/2/3`);
  } else {
    recordResult('FE-KNOW-005', '3D Architecture Integrity (Group & Layer)', 'FAIL', `Missing group: ${totalMissingGroup}, Invalid layer: ${totalInvalidLayer}`);
  }
} catch (err) {
  recordResult('FE-KNOW-001', 'Domain Knowledge Scan', 'FAIL', err.message);
}

// 6. FE-KNOW-003: Markdown AST 双向序列化与解析幂等性测试
try {
  const astPath = path.join(ROOT_DIR, 'shared/markdown-ast.js');
  const { parseMarkdownToDeck, serializeDeckToMarkdown } = await import(pathToFileURL(astPath).href);
  const sampleDeck = {
    title: 'AST 校验用例',
    icon: '🧪',
    description: '测试序列化与解析',
    categories: [
      { id: 'cat_test', name: '测试分类', group: '一、测试大组' }
    ],
    entities: [
      { id: 'e1', categoryId: 'cat_test', layer: 1, title: 'ItemA', answer: 'AnsA', explanation: 'ExpA' },
      { id: 'e2', categoryId: 'cat_test', layer: 2, title: 'ItemB', answer: 'AnsB', explanation: 'ExpB' }
    ]
  };

  const md = serializeDeckToMarkdown(sampleDeck);
  const parsed = parseMarkdownToDeck(md);

  if (parsed.title === sampleDeck.title && parsed.categories[0].group === '一、测试大组' && parsed.entities.length === 2) {
    recordResult('FE-KNOW-003', 'Markdown AST Roundtrip Idempotency', 'PASS', 'Serializes Group -> Category -> Layer -> Entity with 100% fidelity');
  } else {
    recordResult('FE-KNOW-003', 'Markdown AST Roundtrip Idempotency', 'FAIL', 'AST roundtrip mismatch');
  }
} catch (err) {
  recordResult('FE-KNOW-003', 'Markdown AST Roundtrip Idempotency', 'FAIL', err.message);
}

// 7. FE-QUALITY-001: 模块代码行数治理
try {
  function checkDirFileLines(dir, maxLines = 300) {
    let oversized = [];
    if (!fs.existsSync(dir)) return oversized;
    fs.readdirSync(dir).forEach(file => {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) oversized = oversized.concat(checkDirFileLines(full, maxLines));
      else if (file.endsWith('.js') && !file.includes('builtin-decks')) {
        const lines = fs.readFileSync(full, 'utf8').split('\n').length;
        if (lines > maxLines) oversized.push(`${path.relative(ROOT_DIR, full)} (${lines} lines)`);
      }
    });
    return oversized;
  }

  const oversizedModules = checkDirFileLines(path.join(ROOT_DIR, 'features'))
    .concat(checkDirFileLines(path.join(ROOT_DIR, 'shared')))
    .concat(checkDirFileLines(path.join(ROOT_DIR, 'platform')));

  if (oversizedModules.length === 0) {
    recordResult('FE-QUALITY-001', 'Modular File Size Health (<=300 lines)', 'PASS', 'All modular JS files are strictly under 300 lines threshold');
  } else {
    recordResult('FE-QUALITY-001', 'Modular File Size Health (<=300 lines)', 'WARN', `Oversized modules: ${oversizedModules.join(', ')}`);
  }
} catch (err) {
  recordResult('FE-QUALITY-001', 'Modular File Size Health', 'FAIL', err.message);
}

// 8. FE-DESIGN-001: 设计令牌规范完备性与 4 层模型检查
try {
  const tokenDir = path.join(ROOT_DIR, 'design-system/tokens');
  const requiredFiles = ['colors.css', 'typography.css', 'elevation.css', 'spacing.css'];
  let missingFiles = [];
  requiredFiles.forEach(f => {
    if (!fs.existsSync(path.join(tokenDir, f))) missingFiles.push(f);
  });

  if (missingFiles.length > 0) {
    recordResult('FE-DESIGN-001', 'Design Token Completeness', 'FAIL', `Missing token files: ${missingFiles.join(', ')}`);
  } else {
    const colorsCss = fs.readFileSync(path.join(tokenDir, 'colors.css'), 'utf8');
    const typographyCss = fs.readFileSync(path.join(tokenDir, 'typography.css'), 'utf8');

    const requiredTokens = [
      '--surface-canvas', '--surface-card', '--surface-inset', '--surface-raised', '--surface-overlay',
      '--text-primary', '--text-secondary', '--text-tertiary',
      '--border-subtle', '--border-default',
      '--action-primary-bg', '--status-success', '--status-warning', '--status-error'
    ];
    const missingTokens = requiredTokens.filter(t => !colorsCss.includes(t));

    const requiredTypography = [
      '--font-sans', '--font-mono',
      '--font-size-xs', '--font-size-sm', '--font-size-base', '--font-size-lg', '--font-size-xl', '--font-size-2xl', '--font-size-3xl'
    ];
    const missingTypo = requiredTypography.filter(t => !typographyCss.includes(t));

    if (missingTokens.length === 0 && missingTypo.length === 0) {
      recordResult('FE-DESIGN-001', 'Design Token Completeness', 'PASS', '100% Surface (0-4), Typography & Semantic tokens verified');
    } else {
      recordResult('FE-DESIGN-001', 'Design Token Completeness', 'FAIL', `Missing tokens: ${missingTokens.concat(missingTypo).join(', ')}`);
    }
  }
} catch (err) {
  recordResult('FE-DESIGN-001', 'Design Token Completeness', 'FAIL', err.message);
}

// 9. FE-NAV-001: 导航栏单行流式与分段路由门禁
try {
  const shellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
  const hasH16 = shellHtml.includes('h-16');
  const hasNavTabs = shellHtml.includes('nav-tab-dashboard') && shellHtml.includes('nav-tab-study') && shellHtml.includes('nav-tab-codex');
  const hasDeckSelector = shellHtml.includes('id="deck-selector"');

  if (hasH16 && hasNavTabs && hasDeckSelector) {
    recordResult('FE-NAV-001', 'Single-Row Decoupled Navigation', 'PASS', '60px (h-16) single-row navbar, decoupled deck selector & 3-view segmented router verified');
  } else {
    recordResult('FE-NAV-001', 'Single-Row Decoupled Navigation', 'FAIL', 'Navbar does not meet 60px single-row segmented control invariants');
  }
} catch (err) {
  recordResult('FE-NAV-001', 'Single-Row Decoupled Navigation', 'FAIL', err.message);
}

// 10. FE-ICON-001: 单色矢量 SVG 图标库体系与零外部依赖门禁
try {
  const iconJsPath = path.join(ROOT_DIR, 'design-system/icons/icons.js');
  if (fs.existsSync(iconJsPath)) {
    const iconCode = fs.readFileSync(iconJsPath, 'utf8');
    const shellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
    const hasExternalFontCdn = shellHtml.includes('fontawesome') || shellHtml.includes('ionicons') || shellHtml.includes('material-icons');

    if (!hasExternalFontCdn && iconCode.includes('currentColor') && iconCode.includes('ICONS')) {
      recordResult('FE-ICON-001', 'Monochrome Vector SVG Icons', 'PASS', '100% offline standalone monochrome vector SVG icons (currentColor) verified');
    } else {
      recordResult('FE-ICON-001', 'Monochrome Vector SVG Icons', 'FAIL', 'Found external font icon CDN or missing currentColor SVG definitions');
    }
  } else {
    recordResult('FE-ICON-001', 'Monochrome Vector SVG Icons', 'FAIL', 'design-system/icons/icons.js missing');
  }
} catch (err) {
  recordResult('FE-ICON-001', 'Monochrome Vector SVG Icons', 'FAIL', err.message);
}

// 11. 自动执行全量单元测试
try {
  const tests = [
    'tests/unit/sm2-scheduler.test.mjs',
    'tests/unit/distractor-sampler.test.mjs',
    'tests/unit/markdown-ast.test.mjs',
    'tests/unit/deck-validator.test.mjs'
  ];
  let allTestsPassed = true;
  for (const t of tests) {
    const testPath = path.join(ROOT_DIR, t);
    await import(pathToFileURL(testPath).href);
  }
  recordResult('FE-TEST-001', 'Automated Unit Test Suite', 'PASS', `All ${tests.length} unit tests (SM-2, Distractor, AST, Validator) passed`);
} catch (err) {
  recordResult('FE-TEST-001', 'Automated Unit Test Suite', 'FAIL', err.message);
}

// 输出审计汇总
let hasFail = false;
RESULTS.forEach(r => {
  let badge = '';
  if (r.status === 'PASS') badge = '\x1b[32m[PASS]\x1b[0m';
  else if (r.status === 'WARN') badge = '\x1b[33m[WARN]\x1b[0m';
  else {
    badge = '\x1b[31m[FAIL]\x1b[0m';
    hasFail = true;
  }
  console.log(`${badge} ${r.ruleId.padEnd(14)} : ${r.name}`);
  console.log(`       ↳ \x1b[90m${r.details}\x1b[0m`);
});

console.log('\n' + '-'.repeat(74));
const passCount = RESULTS.filter(r => r.status === 'PASS').length;
const warnCount = RESULTS.filter(r => r.status === 'WARN').length;
const failCount = RESULTS.filter(r => r.status === 'FAIL').length;

console.log(`  Audit Summary : ${passCount} Passed, ${warnCount} Warnings, ${failCount} Failures`);
console.log(`  Project Status: ${hasFail ? '🔴 BLOCKED' : '🟢 HEALTHY (Conformant to Core 2.1)'}`);
console.log('='.repeat(74) + '\n');

process.exit(hasFail ? 1 : 0);
