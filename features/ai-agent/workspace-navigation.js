export class AgentWorkspaceNavigation {
  constructor({ root = globalThis.document, browserWindow = globalThis.window, onActivate = () => {} } = {}) {
    Object.assign(this, { root, browserWindow, onActivate });
    this.tabs = ['chat', 'mcp']; this.activeTab = 'chat';
  }
  init() {
    for (const tab of this.tabs) {
      const button = this.root.getElementById(`agent-tab-${tab}`);
      button?.addEventListener('click', () => this.select(tab));
      button?.addEventListener('keydown', event => this.handleKey(event, tab));
    }
    const restore = () => {
      const tab = this.browserWindow.location.hash.match(/^#agent\/(chat|mcp)$/)?.[1];
      if (tab) this.select(tab, { updateHash: false });
    };
    this.select('chat', { updateHash: false, notify: false });
    restore(); this.browserWindow.addEventListener('hashchange', restore);
  }
  select(tab, { updateHash = true, notify = true } = {}) {
    if (!this.tabs.includes(tab)) return false;
    this.activeTab = tab;
    for (const name of this.tabs) {
      const active = name === tab;
      const button = this.root.getElementById(`agent-tab-${name}`);
      button?.setAttribute('aria-selected', String(active));
      if (button) button.tabIndex = active ? 0 : -1;
      const panel = this.root.getElementById(`agent-panel-${name}`);
      if (panel) { panel.hidden = !active; panel.inert = !active; panel.classList.toggle('hidden', !active); }
    }
    if (updateHash) this.browserWindow.history.replaceState(null, '', `#agent/${tab}`);
    if (notify) this.onActivate(tab);
    return true;
  }
  handleKey(event, tab) {
    const index = this.tabs.indexOf(tab);
    const target = { ArrowLeft: this.tabs[(index + this.tabs.length - 1) % this.tabs.length], ArrowRight: this.tabs[(index + 1) % this.tabs.length], Home: this.tabs[0], End: this.tabs.at(-1) }[event.key];
    if (!target) return;
    event.preventDefault(); this.select(target); this.root.getElementById(`agent-tab-${target}`)?.focus();
  }
}
