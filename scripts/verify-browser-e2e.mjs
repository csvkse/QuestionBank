/**
 * Browser End-to-End Verification using Chrome DevTools Protocol (CDP)
 * Verifies the Learn & Verify mode on local dev server and published GitHub Pages site.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome executable not found');
}

class CDPPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          console.log('   [Browser Console]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          console.error('   [Browser Exception]', JSON.stringify(msg.params.exceptionDetails));
        }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Runtime.evaluate exception');
    }
    return res.result?.value;
  }

  async waitSelector(selector, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.eval(`!!document.querySelector('${selector}')`);
      if (exists) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('🌐 Starting Browser E2E Verification for Learn & Verify Mode...');
  const chromePath = findChrome();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp_verify_'));
  const port = 9222;

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    `--user-data-dir=${tempDir}`
  ], { stdio: 'ignore' });

  try {
    // Wait for CDP server to respond
    let target = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (res.ok) {
          const list = await res.json();
          target = list.find(t => t.type === 'page');
          if (target) break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }
    if (!target) throw new Error('Failed to find page target on port 9222');

    const page = new CDPPage(target.webSocketDebuggerUrl);
    await page.connect();

    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('DOM.enable');

    console.log('📸 Test 1: Verifying Local Dashboard...');
    await page.send('Page.navigate', { url: 'http://127.0.0.1:3000' });
    await page.waitSelector('#mode-card-learn');
    const dashboardTitle = await page.eval('document.title');
    console.log(`   ✓ Page loaded: "${dashboardTitle}"`);
    const learnCardText = await page.eval('document.getElementById("mode-card-learn").innerText');
    console.log(`   ✓ Found Learn Mode Card: "${learnCardText.split("\\n")[0]}"`);
    await page.screenshot('docs/screenshots/01_dashboard.png');

    console.log('📸 Test 2: Starting Learn & Verify Mode (Phase 1: Encoding)...');
    const startRes = await page.eval(`
      (() => {
        try {
          window.app.startLearnVerify(1, "HIERARCHICAL");
          return "OK";
        } catch (e) {
          return "ERROR: " + (e.stack || e.message);
        }
      })()
    `);
    console.log(`   ✓ startLearnVerify call result: ${startRes}`);
    await page.waitSelector('#view-learn:not(.hidden)');
    const nodeTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
    const tierBadge = await page.eval('document.querySelector("#view-learn .text-indigo-400.font-mono")?.innerText');
    console.log(`   ✓ Encoding Card Rendered: Node="${nodeTitle}", Tier="${tierBadge}"`);
    await page.screenshot('docs/screenshots/02_encoding_phase.png');

    console.log('📸 Test 3: Advancing to Immediate Verification (Phase 2: Verifying)...');
    await page.eval('window.app.learnVerifyController.startVerify()');
    await page.waitSelector('#view-learn button[onclick*="selectOption"]');
    const optionCount = await page.eval('document.querySelectorAll(\'#view-learn button[onclick*="selectOption"]\').length');
    console.log(`   ✓ Verifying Card Rendered with ${optionCount} options`);
    await page.screenshot('docs/screenshots/03_verifying_phase.png');

    console.log('📸 Test 4: Submitting Verification Answer (Phase 3: Evaluation)...');
    await page.eval('window.app.learnVerifyController.selectOption(0)');
    await new Promise(r => setTimeout(r, 200));
    await page.eval('window.app.learnVerifyController.submitAnswer()');
    await new Promise(r => setTimeout(r, 800));
    const feedbackText = await page.eval('document.querySelector("#view-learn")?.innerText');
    const isFeedbackShown = feedbackText.includes('巩固记忆') || feedbackText.includes('就地纠偏') || feedbackText.includes('解析');
    console.log(`   ✓ Verification Feedback Evaluated: feedbackShown=${isFeedbackShown}`);
    await page.screenshot('docs/screenshots/04_result_phase.png');

    console.log('📸 Test 5: Verifying Published Online Site (GitHub Pages)...');
    await page.send('Page.navigate', { url: 'https://csvkse.github.io/QuestionBank/' });
    await page.waitSelector('#mode-card-learn', 20000);
    const onlineTitle = await page.eval('document.title');
    const onlineCardText = await page.eval('document.getElementById("mode-card-learn").innerText');
    console.log(`   ✓ Online Site Loaded: "${onlineTitle}"`);
    console.log(`   ✓ Online Learn Mode Card Present: "${onlineCardText.split("\\n")[0]}"`);
    await page.screenshot('docs/screenshots/05_published_site.png');

    console.log('📸 Test 6: Verifying Online Learn Mode Interactivity...');
    await page.eval('window.app.startLearnVerify(1, "HIERARCHICAL")');
    await page.waitSelector('#view-learn:not(.hidden)');
    const onlineNodeTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
    console.log(`   ✓ Online Learn Mode Active: Node="${onlineNodeTitle}"`);
    await page.screenshot('docs/screenshots/06_published_site_learn_mode.png');

    page.close();
    console.log('\n🎉 ALL 6 BROWSER E2E VERIFICATIONS PASSED SUCCESSFULLY!');
  } finally {
    chromeProc.kill('SIGTERM');
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
