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
  }
}
