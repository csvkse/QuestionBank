import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentWorkspaceNavigation } from '../../features/ai-agent/workspace-navigation.js';
import { KnowledgeMasterApp } from '../../app/main.js';

test('workspace tabs and hash restore selection without reconstructing panels', () => {
  const ids = new Map();
  for (const tab of ['chat','mcp']) for (const kind of ['tab','panel']) {
    ids.set(`agent-${kind}-${tab}`, { hidden:false, attrs:{}, classList:{toggle(){}}, setAttribute(k,v){this.attrs[k]=v;}, addEventListener(){}, focus(){this.focused=true;} });
  }
  const root = {getElementById:id=>ids.get(id)};
  const browserWindow = {location:{hash:'#agent/mcp'},history:{replaceState(_a,_b,hash){browserWindow.location.hash=hash;}},addEventListener(){}};
  const visible=[]; const nav = new AgentWorkspaceNavigation({root,browserWindow,onActivate:tab=>visible.push(tab)});
  nav.init(); const chat=ids.get('agent-panel-chat');
  assert.equal(nav.activeTab,'mcp'); assert.equal(chat.hidden,true);
  nav.select('chat'); assert.equal(chat.hidden,false); assert.equal(ids.get('agent-panel-chat'),chat);
  assert.equal(ids.get('agent-tab-chat').attrs['aria-selected'],'true');
  assert.equal(browserWindow.location.hash,'#agent/chat');
  nav.handleKey({key:'End',preventDefault(){}},'chat'); assert.equal(nav.activeTab,'mcp');
  assert.equal(ids.get('agent-tab-mcp').focused,true);
  assert.deepEqual(visible,['mcp','chat','mcp']);
  assert.equal(nav.select('unknown'),false);
});

test('requesting an AI deck guide explicitly opens chat after visiting MCP', () => {
  const originalTimeout=globalThis.setTimeout;
  let selected='mcp';
  globalThis.setTimeout=()=>0;
  try {
    KnowledgeMasterApp.prototype.requestAiDeckGuide.call({getAllDecks:()=>[],router:{navigate(){}},agentWorkspace:{select(tab){selected=tab;}}},'custom');
    assert.equal(selected,'chat');
  } finally { globalThis.setTimeout=originalTimeout; }
});
