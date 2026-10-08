#!/usr/bin/env node

/**
 * Knowledge Arena Zero-Dependency Standalone Bundler
 * Compiles Core 2.1 modular source files into standalone index.html
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const PREVIEW_FILE = 'C:/Users/hlr/.gemini/antigravity/brain/637abdd2-f3fc-4287-ba7a-76db36116844/universal_knowledge_preview.html';

console.log('\n' + '='.repeat(68));
console.log('📦  KNOWLEDGE ARENA STANDALONE ZERO-DEP BUNDLER (v2.1)');
console.log('='.repeat(68));
const startTime = Date.now();

try {
  // 1. 读取 app-shell.html
  const shellPath = path.join(ROOT_DIR, 'app/app-shell.html');
  if (!fs.existsSync(shellPath)) {
    throw new Error('app/app-shell.html not found');
  }
  let shellHtml = fs.readFileSync(shellPath, 'utf8');

  // 2. 依次读取模块文件 (拓扑依赖序)
  const modules = [
    'shared/builtin-decks.js',
    'shared/sm2-scheduler.js',
    'shared/distractor-sampler.js',
    'shared/markdown-ast.js',
    'shared/deck-validator.js',
    'platform/audio/web-audio-synth.js',
    'platform/storage/local-storage-adapter.js',
    'platform/exporter/file-exporter.js',
    'design-system/components/modal.js',
    'design-system/components/pill.js',
    'features/arena/combo-effect.js',
    'features/arena/quiz-runner.js',
    'features/study-hub/matrix-console.js',
    'features/study-hub/tree-renderer.js',
    'features/deck-studio/visual-editor.js',
    'features/deck-studio/markdown-editor.js',
    'features/deck-manager/deck-crud.js',
    'features/review-board/timeline-board.js',
    'features/review-board/radar-chart.js',
    'app/router.js',
    'app/main.js'
  ];

  let bundleJs = '/**\n * Bundled Standalone Runtime for Knowledge Arena\n * Generated automatically by scripts/bundler.mjs\n */\n\n(function() {\n  "use strict";\n\n';

  modules.forEach(modPath => {
    const fullPath = path.join(ROOT_DIR, modPath);
    let code = fs.readFileSync(fullPath, 'utf8');

    // 剥离 import 语句
    code = code.replace(/^\s*import\s+.*?;?\s*$/gm, '');
    code = code.replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"].*?['"];?\s*$/gm, '');

    // 转换 export 声明
    code = code.replace(/^\s*export\s+const\s+/gm, 'const ');
    code = code.replace(/^\s*export\s+let\s+/gm, 'let ');
    code = code.replace(/^\s*export\s+function\s+/gm, 'function ');
    code = code.replace(/^\s*export\s+class\s+/gm, 'class ');
    code = code.replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '');
    code = code.replace(/^\s*export\s+default\s+/gm, 'const defaultExport = ');

    bundleJs += `  // --- Module: ${modPath} ---\n`;
    bundleJs += code.trim() + '\n\n';
  });

  // 注入启动引导
  bundleJs += `
  // --- Bootstrap Entry ---
  const app = new KnowledgeMasterApp();
  window.app = app;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    app.init();
  } else {
    window.addEventListener('DOMContentLoaded', () => app.init());
  }
})();
`;

  // 3. 语法验证
  new Function(bundleJs);

  // 4. 合成最终单文件
  const scriptTag = `  <!-- 核心逻辑脚本 (由工程化打包器自动化编译) -->\n  <script>\n${bundleJs}  </script>\n`;
  const finalHtml = shellHtml.replace('<!-- INJECT_SCRIPTS -->', scriptTag);

  const outputPath = path.join(ROOT_DIR, 'index.html');
  fs.writeFileSync(outputPath, finalHtml, 'utf8');

  // 5. 同步至预览镜像
  if (fs.existsSync(path.dirname(PREVIEW_FILE))) {
    fs.writeFileSync(PREVIEW_FILE, finalHtml, 'utf8');
  }

  const elapsed = Date.now() - startTime;
  const stat = fs.statSync(outputPath);

  console.log(`✅  Bundle Compiled Successfully in ${elapsed}ms!`);
  console.log(`    Output Asset : ${outputPath}`);
  console.log(`    Bundle Size  : ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`    Modules Count: ${modules.length} modules packaged`);
  console.log('='.repeat(68) + '\n');
} catch (err) {
  console.error('\n❌  Bundle Compilation FAILED:', err.message);
  process.exit(1);
}
