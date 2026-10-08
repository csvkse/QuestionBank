/**
 * Application View Router
 * Core: app/router.js
 */

export class AppRouter {
  constructor(app) {
    this.app = app;
    this.currentView = 'dashboard';
  }

  navigate(viewName) {
    if (this.app.timerInterval) {
      clearInterval(this.app.timerInterval);
    }
    this.currentView = viewName;
    const views = ['dashboard', 'arena', 'summary', 'codex', 'study'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add('hidden');
    });

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) targetEl.classList.remove('hidden');

    if (viewName === 'dashboard') {
      this.app.renderDashboard();
    } else if (viewName === 'codex') {
      this.app.renderCodex();
    } else if (viewName === 'study') {
      this.app.renderStudyHub();
    }

    this.updateNavTabs(viewName);
  }

  updateNavTabs(viewName) {
    const navTabs = ['dashboard', 'study', 'codex'];
    navTabs.forEach(tab => {
      const btn = document.getElementById(`nav-tab-${tab}`);
      if (!btn) return;
      if (tab === viewName) {
        btn.classList.add('bg-slate-800', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-400', 'hover:text-slate-200');
      } else {
        btn.classList.remove('bg-slate-800', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-400', 'hover:text-slate-200');
      }
    });
  }
}
