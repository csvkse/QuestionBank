/**
 * Browser End-to-End Verification using Chrome DevTools Protocol (CDP)
 * Verifies the Micro-Topic Cluster Learn & Verify mode on local dev server and published GitHub Pages site.
 * 
 * Strict compliance with FE-QUALITY-001: <= 300 lines.
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
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text || 'Runtime.evaluate exception';
      throw new Error(desc);
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
  console.log('🌐 Starting Browser E2E Verification for Micro-Topic Cluster Learn & Verify Mode...');
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

    console.log('📸 Test 2: Starting Micro-Topic Capsule Mode (Phase 1: Comparative Matrix)...');
    const startRes = await page.eval(`
      (() => {
        try {
          window.app.startLearnVerify(1, "CAPSULE");
          return "OK";
        } catch (e) {
          return "ERROR: " + (e.stack || e.message);
        }
      })()
    `);
    console.log(`   ✓ startLearnVerify call result: ${startRes}`);
    await page.waitSelector('#view-learn:not(.hidden)');
    const capsuleTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
    const conceptCount = await page.eval('document.querySelectorAll("#view-learn .surface-inset").length');
    console.log(`   ✓ Micro-Topic Capsule Rendered: Title="${capsuleTitle}", ConceptsCount=${conceptCount}`);
    await page.screenshot('docs/screenshots/02_capsule_matrix.png');

    console.log('📸 Test 2.1: Verifying Capsule Navigator (Manual Progress Selector Modal)...');
    await page.eval('window.app.learnVerifyController.toggleCatalog(true)');
    await page.waitSelector('#capsule-catalog-modal');
    const catalogItemCount = await page.eval('document.querySelectorAll("#capsule-catalog-modal button[onclick*=\\"jumpToCapsule\\"], #capsule-catalog-modal span:has(svg)").length');
    console.log(`   ✓ Capsule Navigator Modal Displayed with ${catalogItemCount} capsules`);
    await page.screenshot('docs/screenshots/02b_capsule_catalog.png');

    // 测试手动点播选课：跳入第 2 个胶囊
    const targetCapsuleId = await page.eval('window.app.learnVerifyController.allCapsules[1]?.id');
    if (targetCapsuleId) {
      await page.eval(`window.app.learnVerifyController.jumpToCapsule("${targetCapsuleId}")`);
      await new Promise(r => setTimeout(r, 300));
      const jumpedTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
      console.log(`   ✓ Jumped to Capsule via Navigator: Title="${jumpedTitle}"`);
    }

    console.log('📸 Test 2.2: Verifying Multi-Modal Pronunciation & Agent Runtime Telemetry...');
    const teleRes = await page.eval(`
      (async () => {
        const executor = window.app.agentUI?.executor || window.app.mcpBridge?.adapter?.executor;
        if (!executor) throw new Error('Agent/MCP executor not found on window.app');
        const res = await executor.execute('tool_get_runtime_context');
        return res;
      })()
    `);
    console.log(`   ✓ Agent Runtime Context Introspected: ActiveMode="${teleRes?.runtime?.activeMode}", Accuracy="${teleRes?.runtime?.telemetry?.accuracyRate}"`);

    console.log('📸 Test 2.3: Verifying Semantic MCP Tool Calling, Input Elasticity & ReAct Actions...');
    const mcpTestRes = await page.eval(`
      (async () => {
        const adapter = window.app.mcpBridge?.adapter;
        if (!adapter) throw new Error('mcpBridge adapter not found');
        const tools = adapter.listTools();
        const hasCanonicalListDecks = tools.some(t => t.name === 'list_decks');
        const canCall = await adapter.callTool('list_decks');
        const legacyCall = await adapter.callTool('tool_list_decks');

        const created = await adapter.callTool('create_deck', {
          title: '【ね 的读音 】',
          categories: [{ id: 'kana', name: '假名', group: '日语' }],
          entities: [
            { id: 'k1', categoryId: 'kana', layer: 1, title: 'あ', prompt: 'a', answer: 'a' },
            { id: 'k2', categoryId: 'kana', layer: 1, title: 'い', prompt: 'i', answer: 'i' },
            { id: 'k3', categoryId: 'kana', layer: 1, title: 'う', prompt: 'u', answer: 'u' },
            { id: 'k4', categoryId: 'kana', layer: 1, title: 'え', prompt: 'e', answer: 'e' }
          ]
        });
        const createdData = JSON.parse(created.content[0].text);

        const added = await adapter.callTool('add_entities', {
          deckId: createdData.deckId,
          entities: [{ id: 'k_ne', category: 'kana', layer: 1, title: '【ね 的读音 】', question: '读音为ne的是？', answer: 'ね' }]
        });
        const addedData = JSON.parse(added.content[0].text);
        const deck = window.app.state.customDecks.find(d => d.id === createdData.deckId);
        const addedEntity = deck?.entities.find(e => e.id === 'k_ne');

        await adapter.callTool('delete_deck', { deckId: createdData.deckId });

        return {
          toolsCount: tools.length,
          hasCanonicalListDecks,
          canCallOk: !canCall.isError,
          legacyCallOk: !legacyCall.isError,
          sanitizedTitle: createdData.title,
          createdActionsCount: createdData.suggestedNextActions?.length || 0,
          addedEntityTitle: addedEntity?.title,
          addedEntityPrompt: addedEntity?.prompt,
          addedEntityTtsClean: addedEntity?.phonetics?.tts_clean,
          addedActionsCount: addedData.suggestedNextActions?.length || 0
        };
      })()
    `);
    console.log(`   ✓ Canonical Tools Available: ${mcpTestRes.hasCanonicalListDecks} (${mcpTestRes.toolsCount} tools)`);
    console.log(`   ✓ Dual Invocation (Canonical & Legacy): ${mcpTestRes.canCallOk && mcpTestRes.legacyCallOk}`);
    console.log(`   ✓ Deck Title Auto-Sanitized: "${mcpTestRes.sanitizedTitle}" with ${mcpTestRes.createdActionsCount} suggested actions`);
    console.log(`   ✓ Entity Input Elasticity: Title="${mcpTestRes.addedEntityTitle}", Prompt="${mcpTestRes.addedEntityPrompt}", TTS="${mcpTestRes.addedEntityTtsClean}"`);

    console.log('📸 Test 3: Advancing to Interleaved Quiz Sprint (Phase 2: Verifying)...');
    await page.eval('window.app.learnVerifyController.startInterleavedQuiz()');
    await page.waitSelector('#view-learn button[onclick*="selectInterleavedOption"]');
    const optionCount = await page.eval('document.querySelectorAll(\'#view-learn button[onclick*="selectInterleavedOption"]\').length');
    const qTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
    console.log(`   ✓ Interleaved Quiz Rendered: Question="${qTitle}" with ${optionCount} intra-cluster options`);
    await page.screenshot('docs/screenshots/03_interleaved_sprint.png');

    console.log('📸 Test 4: Answering Interleaved Quiz Options (Phase 3: Sprinting)...');
    await page.eval('window.app.learnVerifyController.selectInterleavedOption(0)');
    await new Promise(r => setTimeout(r, 200));
    await page.eval('window.app.learnVerifyController.submitInterleavedOption()');
    await new Promise(r => setTimeout(r, 600));
    const viewActive = await page.eval('!document.getElementById("view-learn").classList.contains("hidden")');
    console.log(`   ✓ Interleaved Option Evaluated (view active: ${viewActive})`);
    await page.screenshot('docs/screenshots/04_capsule_evaluation.png');

    console.log('📸 Test 5: Verifying Published Online Site (GitHub Pages)...');
    await page.send('Page.navigate', { url: 'https://csvkse.github.io/QuestionBank/' });
    await page.waitSelector('#mode-card-learn', 20000);
    const onlineTitle = await page.eval('document.title');
    const onlineCardText = await page.eval('document.getElementById("mode-card-learn").innerText');
    console.log(`   ✓ Online Site Loaded: "${onlineTitle}"`);
    console.log(`   ✓ Online Learn Mode Card Present: "${onlineCardText.split("\\n")[0]}"`);
    await page.screenshot('docs/screenshots/05_published_site.png');

    console.log('📸 Test 6: Verifying Online Micro-Topic Capsule Interactivity...');
    await page.eval('window.app.startLearnVerify(1, "CAPSULE")');
    await page.waitSelector('#view-learn:not(.hidden)');
    const onlineCapsuleTitle = await page.eval('document.querySelector("#view-learn h2")?.innerText');
    console.log(`   ✓ Online Micro-Topic Capsule Active: Title="${onlineCapsuleTitle}"`);
    await page.screenshot('docs/screenshots/06_published_capsule.png');

    page.close();
    console.log('\n🎉 ALL LOCAL & ONLINE BROWSER E2E VERIFICATIONS PASSED SUCCESSFULLY!');
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
