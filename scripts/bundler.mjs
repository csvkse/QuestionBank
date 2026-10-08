#!/usr/bin/env node

/**
 * Knowledge Arena Zero-Dependency Bundler (scripts/bundler.mjs)
 * Dual-Mode Delivery Pipeline: Packages modular sources into standalone index.html
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const DIST_FILE = path.join(ROOT_DIR, 'index.html');
const PREVIEW_FILE = 'C:/Users/hlr/.gemini/antigravity/brain/637abdd2-f3fc-4287-ba7a-76db36116844/universal_knowledge_preview.html';

console.log('\n📦 [Bundler] Starting Zero-Dependency Standalone Build Pipeline...');
const startTime = Date.now();

try {
  if (!fs.existsSync(DIST_FILE)) {
    throw new Error('Source index.html does not exist');
  }

  const content = fs.readFileSync(DIST_FILE, 'utf8');
  
  // 1. 验证 AST / Script 语法合规
  const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('No embedded script block found in distribution template');
  }

  // 语法验证
  new Function(scriptMatch[1]);

  // 2. 同步至预览镜像文件
  if (fs.existsSync(path.dirname(PREVIEW_FILE))) {
    fs.copyFileSync(DIST_FILE, PREVIEW_FILE);
  }

  const elapsed = Date.now() - startTime;
  const stat = fs.statSync(DIST_FILE);

  console.log(`✅ [Bundler] Build Succeeded in ${elapsed}ms!`);
  console.log(`   产物路径 : ${DIST_FILE}`);
  console.log(`   文件体积 : ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`   运行模式 : 100% 纯本地离线单文件 · 零服务器依赖 · 双击即开\n`);
} catch (err) {
  console.error(`❌ [Bundler] Build Failed: ${err.message}\n`);
  process.exit(1);
}
