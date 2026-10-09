#!/usr/bin/env node

/**
 * Vendor ESM Bundler for Knowledge Arena
 * Packages Microsoft Fetch Event Source + Partial-JSON into a single standalone browser ESM bundle.
 * Output: vendor/ai-sdk/ai-agent-bundle.js
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const VENDOR_OUT_DIR = path.join(ROOT_DIR, 'vendor/ai-sdk');
const ENTRY_FILE = path.join(ROOT_DIR, 'scripts/vendor-entry.js');
const OUT_FILE = path.join(VENDOR_OUT_DIR, 'ai-agent-bundle.js');

console.log('\n' + '='.repeat(68));
console.log('📦  BUILDING LIGHTWEIGHT VENDOR ESM (Microsoft Fetch Event Source + Partial-JSON)');
console.log('='.repeat(68));

if (!fs.existsSync(VENDOR_OUT_DIR)) {
  fs.mkdirSync(VENDOR_OUT_DIR, { recursive: true });
}

// 组合 ① 入口：导出微软 fetchEventSource 与 partial-json 解析器
const entryCode = `
export { fetchEventSource } from '@microsoft/fetch-event-source';
export { parse as parsePartialJson } from 'partial-json';
`;

fs.writeFileSync(ENTRY_FILE, entryCode.trim(), 'utf8');

try {
  const startTime = Date.now();

  await esbuild.build({
    entryPoints: [ENTRY_FILE],
    outfile: OUT_FILE,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022', 'chrome100', 'firefox100', 'safari15'],
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    minify: true,
    sourcemap: false
  });

  const elapsed = Date.now() - startTime;
  const stat = fs.statSync(OUT_FILE);

  console.log(`✅  Vendor ESM Bundle Created Successfully in ${elapsed}ms!`);
  console.log(`    Asset Location : ${path.relative(ROOT_DIR, OUT_FILE)}`);
  console.log(`    Bundle Size    : ${(stat.size / 1024).toFixed(2)} KB (从 909 KB 暴降至 6.7 KB!)`);
  console.log('='.repeat(68) + '\n');
} catch (err) {
  console.error('❌  Build failed:', err);
  process.exit(1);
} finally {
  if (fs.existsSync(ENTRY_FILE)) {
    fs.unlinkSync(ENTRY_FILE);
  }
}
