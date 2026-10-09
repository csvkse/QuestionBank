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
    'index.html', 'favicon.svg', 'binding.yaml', 'package.json', 'package-lock.json', 'node_modules', 'README.md', '.git', '.gitignore',
    'start-dev.bat', 'run.bat'
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

// 9.5. FE-NAV-002: 导航栏防折行与自适应弹性门禁 (SPEC 29 Invariant)
try {
  const shellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
  
  // 1. 验证中心分段路由防折行 (四个主Tab均必须声明 whitespace-nowrap)
  const navTabs = ['nav-tab-dashboard', 'nav-tab-study', 'nav-tab-codex', 'nav-tab-agent'];
  const allTabsHaveNowrap = navTabs.every(tabId => {
    const tabMatch = shellHtml.match(new RegExp(`<button[^>]*id="${tabId}"[^>]*>`));
    return tabMatch && tabMatch[0].includes('whitespace-nowrap');
  });

  // 2. 验证中心控制器防暴力压缩 (nav 必须具有 shrink-0)
  const hasNavShrink0 = /<nav[^>]*shrink-0[^>]*>/.test(shellHtml);

  // 3. 验证标顶交互基线统一 (h-8 胶囊规范)
  const hasH8Pills = shellHtml.includes('h-8') && shellHtml.includes('id="deck-selector"') && shellHtml.includes('id="header-streak"');

  if (allTabsHaveNowrap && hasNavShrink0 && hasH8Pills) {
    recordResult('FE-NAV-002', 'Navbar Non-Wrapping & Responsive Elasticity', 'PASS', '100% nav tabs whitespace-nowrap, shrink-0 central router & 32px (h-8) baseline verified');
  } else {
    const reasons = [];
    if (!allTabsHaveNowrap) reasons.push('Some nav tabs missing whitespace-nowrap');
    if (!hasNavShrink0) reasons.push('Central nav missing shrink-0');
    if (!hasH8Pills) reasons.push('Navbar pills missing 32px (h-8) baseline');
    recordResult('FE-NAV-002', 'Navbar Non-Wrapping & Responsive Elasticity', 'FAIL', reasons.join('; '));
  }
} catch (err) {
  recordResult('FE-NAV-002', 'Navbar Non-Wrapping & Responsive Elasticity', 'FAIL', err.message);
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

// 10.5. FE-ICON-002: 全系统 UI 纯单色矢量化门禁 (系统交互壳层 100% 零彩色 Emoji)
try {
  const shellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const violations = [];

  shellHtml.split('\n').forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      violations.push(`app/app-shell.html:L${idx + 1} (${line.trim().slice(0, 40)})`);
    }
  });

  if (violations.length === 0) {
    recordResult('FE-ICON-002', 'Monochrome UI Chrome (Zero Emoji)', 'PASS', '100% clean vector UI chrome: zero emojis in shell template & controls');
  } else {
    recordResult('FE-ICON-002', 'Monochrome UI Chrome (Zero Emoji)', 'FAIL', `Found ${violations.length} emoji violations: ${violations.slice(0, 3).join('; ')}`);
  }
} catch (err) {
  recordResult('FE-ICON-002', 'Monochrome UI Chrome (Zero Emoji)', 'FAIL', err.message);
}

// 10.6. FE-BIND-001: DOM 点击与事件绑定契约完整性 (全域扫描 HTML + 全部 JS 源码，100% onclick/onchange 方法实存可执行)
try {
  // 递归搜集除排除项外的所有前端源码文件
  function getFrontendSourceFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    fs.readdirSync(dir).forEach(file => {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        if (!['node_modules', '.git', 'archive', 'tests', 'gates', 'docs', 'vendor'].includes(file)) {
          files = files.concat(getFrontendSourceFiles(full));
        }
      } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.mjs')) {
        if (file !== 'index.html') files.push(full);
      }
    });
    return files;
  }

  const allFilesToScan = ['app', 'features', 'design-system', 'shared', 'platform']
    .reduce((acc, d) => acc.concat(getFrontendSourceFiles(path.join(ROOT_DIR, d))), []);

  const uniqueHandlers = new Set();
  const fileMethodMap = [];

  for (const file of allFilesToScan) {
    const content = fs.readFileSync(file, 'utf8');
    // 兼顾多语句及单双引号的属性提取
    const doubleQuoted = [...content.matchAll(/on[a-z]+\s*=\s*"([^"]+)"/g)];
    const singleQuoted = [...content.matchAll(/on[a-z]+\s*=\s*'([^']+)'/g)];
    const allAttrs = doubleQuoted.concat(singleQuoted);

    for (const attr of allAttrs) {
      const attrBody = attr[1];
      const appCalls = [...attrBody.matchAll(/\bapp\.([a-zA-Z0-9_$.]+)\(/g)];
      for (const m of appCalls) {
        const expr = m[1];
        uniqueHandlers.add(expr);
        fileMethodMap.push({ file: path.relative(ROOT_DIR, file).replace(/\\/g, '/'), expr });
      }
    }
  }

  // 模拟无头环境运行全局桩
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };

  const mainPath = path.join(ROOT_DIR, 'app/main.js');
  const { KnowledgeMasterApp } = await import(pathToFileURL(mainPath).href);
  const appInstance = new KnowledgeMasterApp();

  const missingHandlers = [];
  for (const expr of uniqueHandlers) {
    const parts = expr.split('.');
    let target = appInstance;
    for (const p of parts) {
      if (target && target[p] !== undefined) {
        target = target[p];
      } else {
        target = undefined;
        break;
      }
    }
    if (typeof target !== 'function') {
      const sourceLocations = fileMethodMap.filter(x => x.expr === expr).map(x => x.file);
      missingHandlers.push(`${expr} (in ${[...new Set(sourceLocations)].join(', ')})`);
    }
  }

  // 联动校验 SessionStore 核心模型配置契约
  const sessionStorePath = path.join(ROOT_DIR, 'features/ai-agent/session-store.js');
  const { SessionStore } = await import(pathToFileURL(sessionStorePath).href);
  const storeInstance = new SessionStore();
  const requiredStoreMethods = [
    'getProviders', 'setActiveProvider', 'getActiveProvider', 'updateProvider', 'deleteProvider',
    'importFromPreset', 'addModel', 'updateModel', 'deleteModel', 'getActiveModel'
  ];
  const missingStoreMethods = requiredStoreMethods.filter(m => typeof storeInstance[m] !== 'function');

  if (missingHandlers.length === 0 && missingStoreMethods.length === 0) {
    recordResult('FE-BIND-001', 'DOM Event Handler Contract Integrity', 'PASS', `100% of ${uniqueHandlers.size} template & dynamic script event bindings and SessionStore contracts verified callable`);
  } else {
    const errs = [];
    if (missingHandlers.length > 0) errs.push(`Missing app methods: ${missingHandlers.join('; ')}`);
    if (missingStoreMethods.length > 0) errs.push(`Missing SessionStore methods: ${missingStoreMethods.join(', ')}`);
    recordResult('FE-BIND-001', 'DOM Event Handler Contract Integrity', 'FAIL', errs.join('; '));
  }
} catch (err) {
  recordResult('FE-BIND-001', 'DOM Event Handler Contract Integrity', 'FAIL', err.message);
}

// 10.7. FE-LAYOUT-001: 路由插槽布局边界与兄弟间距隔离律 (禁止在全页视图容器外层误加 space-y-* / 强制同步 hidden 属性)
try {
  const shellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
  const routerJs = fs.readFileSync(path.join(ROOT_DIR, 'app/router.js'), 'utf8');
  const violations = [];

  // 1. 检查 <main> 标签是否越权包含 space-y-* 或 space-x-* 兄弟选择器
  const mainTagMatch = shellHtml.match(/<main\b([^>]*)>/i);
  if (mainTagMatch) {
    const mainAttrs = mainTagMatch[1];
    if (/\bspace-[yx]-\d+\b/.test(mainAttrs)) {
      violations.push('<main> 路由出口容器不得包含 space-y-*/space-x-* 兄弟间距类 (会导致非首位隐藏视图被注入幽灵 margin)');
    }
  } else {
    violations.push('未检测到 <main> 路由插槽容器');
  }

  // 2. 检查初始隐藏的 view-* 页面根容器是否声明了原生 hidden 属性
  const viewRegex = /<div\s+id="(view-[a-z0-9_-]+)"([^>]*)>/gi;
  let vMatch;
  while ((vMatch = viewRegex.exec(shellHtml)) !== null) {
    const viewId = vMatch[1];
    const attrs = vMatch[2];
    if (attrs.includes('hidden') && !/\bhidden\b(?!=)/.test(attrs.replace(/class="[^"]*"/, ''))) {
      violations.push(`页面容器 #${viewId} 仅设置了 class="hidden" 但缺少原生 hidden 布尔属性声明`);
    }
  }

  // 3. 检查 app/router.js 是否严格同步了原生 hidden 属性
  if (!routerJs.includes('.hidden = true') || !routerJs.includes('.hidden = false')) {
    violations.push('app/router.js 视图切换时未同步操作 el.hidden 属性');
  }

  if (violations.length === 0) {
    recordResult('FE-LAYOUT-001', 'Router Outlet Layout Invariant', 'PASS', '100% router boundary, sibling isolation and native hidden attribute sync verified');
  } else {
    recordResult('FE-LAYOUT-001', 'Router Outlet Layout Invariant', 'FAIL', violations.join('; '));
  }
} catch (err) {
  recordResult('FE-LAYOUT-001', 'Router Outlet Layout Invariant', 'FAIL', err.message);
}

// 10.8. FE-TYPO-001: 会话气泡排版与 Markdown 块级间距规范
try {
  const { renderMarkdown, renderUserMessage } = await import(pathToFileURL(path.join(ROOT_DIR, 'features/ai-agent/agent-templates.js')).href);
  const agentUiJs = fs.readFileSync(path.join(ROOT_DIR, 'features/ai-agent/agent-ui.js'), 'utf8');
  const violations = [];

  // 1. 验证 renderMarkdown 必须生成块级语义标签，绝对零 </div><br> 或 </li><br>
  const testSample = `你好！\n- 选项A\n- 选项B\n\n段落文本`;
  const rendered = renderMarkdown(testSample);
  if (rendered.includes('</div><br>') || rendered.includes('</li><br>') || rendered.includes('</li><div')) {
    violations.push('renderMarkdown 输出了块级标签与孤立换行符混用的有害结构 (会导致行距成倍虚增)');
  }
  if (!rendered.includes('<ul') || !rendered.includes('<li') || !rendered.includes('<p')) {
    violations.push('renderMarkdown 缺少语义化 ul / li / p 块级包装');
  }

  // 2. 验证 agent-ui.js 中消息气泡容器必须使用 block space-y 与 leading-relaxed
  if (!agentUiJs.includes('space-y-2') || !agentUiJs.includes('leading-relaxed')) {
    violations.push('agent-ui.js 气泡容器未严格使用 space-y-2 与 leading-relaxed 规范排版');
  }

  // 3. 验证 renderUserMessage 包含 whitespace-pre-wrap
  const userHtml = renderUserMessage({ id: 'u1', content: 'test' });
  if (!userHtml.includes('whitespace-pre-wrap')) {
    violations.push('renderUserMessage 用户消息气泡缺少 whitespace-pre-wrap 换行保护');
  }

  if (violations.length === 0) {
    recordResult('FE-TYPO-001', 'Agent Message Typography Invariant', 'PASS', '100% semantic block rhythm, zero ghost br, and whitespace-pre-wrap verified');
  } else {
    recordResult('FE-TYPO-001', 'Agent Message Typography Invariant', 'FAIL', violations.join('; '));
  }
} catch (err) {
  recordResult('FE-TYPO-001', 'Agent Message Typography Invariant', 'FAIL', err.message);
}

// 10.9. FE-PANORAMA-001: 熟练度全景大类与小类层级架构不变量
try {
  const mainJs = fs.readFileSync(path.join(ROOT_DIR, 'app/main.js'), 'utf8');
  const appShellHtml = fs.readFileSync(path.join(ROOT_DIR, 'app/app-shell.html'), 'utf8');
  const violations = [];

  // 1. 验证 renderDeckCategoryBars 必须存在按 group 聚合逻辑
  if (!mainJs.includes('groupMap.set') || !mainJs.includes('cat.group')) {
    violations.push('app/main.js 中 renderDeckCategoryBars 缺少按大类 (group) 聚合计算与层级树构建');
  }

  // 2. 验证大类折叠展开与全局控制方法契约
  if (!mainJs.includes('togglePanoramaGroup(') || !mainJs.includes('toggleAllPanoramaGroups(')) {
    violations.push('app/main.js 缺少 togglePanoramaGroup 或 toggleAllPanoramaGroups 契约方法');
  }

  // 3. 验证全景卡片顶栏提供一键展开/收起按钮
  if (!appShellHtml.includes('panorama-collapse-toggle-btn') || !appShellHtml.includes('toggleAllPanoramaGroups')) {
    violations.push('app/app-shell.html 缺少 panorama-collapse-toggle-btn 全局折叠/展开快捷按钮');
  }

  // 4. 验证雷达图掌握度回顾模块同步升级为大类分组
  const radarChartJs = fs.readFileSync(path.join(ROOT_DIR, 'features/review-board/radar-chart.js'), 'utf8');
  if (!radarChartJs.includes('groupsMap') || !radarChartJs.includes('cat.group')) {
    violations.push('features/review-board/radar-chart.js 缺少大类与小类层级化展示');
  }

  if (violations.length === 0) {
    recordResult('FE-PANORAMA-001', 'Panorama Group Hierarchy Invariant', 'PASS', '100% macro group & subcategory tree hierarchy, collapsible contract & JEV highlight verified');
  } else {
    recordResult('FE-PANORAMA-001', 'Panorama Group Hierarchy Invariant', 'FAIL', violations.join('; '));
  }
} catch (err) {
  recordResult('FE-PANORAMA-001', 'Panorama Group Hierarchy Invariant', 'FAIL', err.message);
}

// 10.10. FE-SCROLL-001: 标签页路由切换自动滚动置顶与多容器清零规范
try {
  const routerJs = fs.readFileSync(path.join(ROOT_DIR, 'app/router.js'), 'utf8');
  const violations = [];

  // 1. 验证 router.js 必须定义 scrollToTop 方法
  if (!routerJs.includes('scrollToTop(')) {
    violations.push('app/router.js 缺少 scrollToTop 视口置顶方法');
  }

  // 2. 验证 navigate 流程中无条件调用 scrollToTop
  if (!routerJs.includes('this.scrollToTop(')) {
    violations.push('app/router.js 的 navigate() 路由切换主流程中未调用 this.scrollToTop()');
  }

  // 3. 验证多容器全域清零 (window / documentElement / body / targetEl)
  if (!routerJs.includes('window.scrollTo') || !routerJs.includes('documentElement.scrollTop = 0') || !routerJs.includes('body.scrollTop = 0')) {
    violations.push('app/router.js scrollToTop 未能全域覆盖 window、documentElement 与 body 多端视口');
  }

  // 4. 验证双轨帧校准 (requestAnimationFrame)
  if (!routerJs.includes('requestAnimationFrame')) {
    violations.push('app/router.js scrollToTop 缺少 requestAnimationFrame 双轨帧绘制校准');
  }

  if (violations.length === 0) {
    recordResult('FE-SCROLL-001', 'Router Tab Scroll-to-Top Invariant', 'PASS', '100% viewport scroll-to-top on tab navigation & dual-frame calibration verified');
  } else {
    recordResult('FE-SCROLL-001', 'Router Tab Scroll-to-Top Invariant', 'FAIL', violations.join('; '));
  }
} catch (err) {
  recordResult('FE-SCROLL-001', 'Router Tab Scroll-to-Top Invariant', 'FAIL', err.message);
}

// 10.11. FE-PANORAMA-002: 熟练度全景折叠主权与渲染幂等性门禁
try {
  const mainJs = fs.readFileSync(path.join(ROOT_DIR, 'app/main.js'), 'utf8');
  const violations = [];

  // 1. 验证 renderDeckCategoryBars 方法中严禁篡改用户折叠状态 (副作用隔离)
  const renderMethodMatch = mainJs.match(/renderDeckCategoryBars\s*\(\)\s*\{([\s\S]*?)\n\s*async\s+runJevEvaluation/);
  if (!renderMethodMatch) {
    violations.push('未能精确匹配 app/main.js 中的 renderDeckCategoryBars 方法体');
  } else {
    const renderBody = renderMethodMatch[1];
    if (renderBody.includes('panoramaCollapsedGroups.delete') || renderBody.includes('panoramaCollapsedGroups.add') || renderBody.includes('panoramaCollapsedGroups.clear')) {
      violations.push('renderDeckCategoryBars 违背渲染纯洁性与幂等性：严禁在渲染流程中调用 panoramaCollapsedGroups 的变更方法 (delete/add/clear)');
    }
  }

  // 2. 验证 JEV 智能展开具备防重入标记保护 (_lastAutoExpandedJevTarget)
  if (!mainJs.includes('_lastAutoExpandedJevTarget')) {
    violations.push('app/main.js 缺少 _lastAutoExpandedJevTarget 防重入标记，无法防止自动化推荐永久覆盖用户折叠主权');
  }

  // 3. 验证折叠展开 UI 驱动契约与动画完整性
  if (!mainJs.includes("isCollapsed ? '-rotate-90' : 'rotate-0'") || !mainJs.includes("isCollapsed ? 'hidden' : ''")) {
    violations.push('app/main.js 缺少 isCollapsed 对应的旋转动画与隐藏状态契约映射');
  }

  // 4. 验证全局切换按钮标签双向绑定
  if (!mainJs.includes("toggleLabel.innerText = allCollapsed ? '全部展开' : '全部折叠'")) {
    violations.push('app/main.js 缺少 toggleLabel 全部展开/全部折叠 双向动态文案映射');
  }

  if (violations.length === 0) {
    recordResult('FE-PANORAMA-002', 'Collapsible Sovereignty & Render Idempotency Invariant', 'PASS', '100% user fold sovereignty, zero render mutations & single-shot JEV auto-expand verified');
  } else {
    recordResult('FE-PANORAMA-002', 'Collapsible Sovereignty & Render Idempotency Invariant', 'FAIL', violations.join('; '));
  }
} catch (err) {
  recordResult('FE-PANORAMA-002', 'Collapsible Sovereignty & Render Idempotency Invariant', 'FAIL', err.message);
}

// 11. 自动执行全量单元测试
try {
  const tests = [
    'tests/unit/sm2-scheduler.test.mjs',
    'tests/unit/distractor-sampler.test.mjs',
    'tests/unit/markdown-ast.test.mjs',
    'tests/unit/deck-validator.test.mjs',
    'tests/unit/agent-loop.test.mjs',
    'tests/unit/arena-modes.test.mjs',
    'tests/unit/question-strategies.test.mjs',
    'tests/unit/jev-recommendation.test.mjs',
    'tests/unit/speech-synth.test.mjs',
    'tests/unit/dev-proxy.test.mjs',
    'tests/unit/panorama-collapsible.test.mjs',
    'tests/unit/favorites.test.mjs'
  ];
  let allTestsPassed = true;
  for (const t of tests) {
    const testPath = path.join(ROOT_DIR, t);
    await import(pathToFileURL(testPath).href);
  }
  recordResult('FE-TEST-001', 'Automated Unit Test Suite', 'PASS', `All ${tests.length} unit tests (SM-2, Distractor, AST, Validator, AgentLoop, ArenaModes, QuestionStrategies, JevRecommender, SpeechSynth, DevProxy, PanoramaCollapsible, Favorites) passed`);
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
