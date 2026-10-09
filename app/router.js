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
    const views = ['dashboard', 'arena', 'summary', 'codex', 'study', 'agent'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        el.classList.add('hidden');
        el.hidden = true;
      }
    });

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.remove('hidden');
      targetEl.hidden = false;
    }

    if (viewName === 'dashboard') {
      this.app.renderDashboard();
    } else if (viewName === 'codex') {
      this.app.renderCodex();
    } else if (viewName === 'study') {
      this.app.renderStudyHub();
    } else if (viewName === 'agent') {
      this.app.renderAiAgent();
    }

    this.updateNavTabs(viewName);
    this.scrollToTop(targetEl);
  }

  /**
   * 标签页/视图跳转自动平滑置顶滚动 (多容器与双轨帧校准)
   */
  scrollToTop(targetEl) {
    try {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      if (typeof document !== 'undefined') {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
      }
      if (targetEl && targetEl.scrollTop !== undefined) {
        targetEl.scrollTop = 0;
      }
    } catch (_) {
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    }

    // 双重调度：在下一帧 DOM 重排绘制完成后再次校准，防止异步渲染导致的滚动位置跳跃
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        try {
          if (typeof window !== 'undefined') window.scrollTo(0, 0);
          if (typeof document !== 'undefined') {
            if (document.documentElement) document.documentElement.scrollTop = 0;
            if (document.body) document.body.scrollTop = 0;
          }
          if (targetEl && targetEl.scrollTop !== undefined) targetEl.scrollTop = 0;
        } catch (_) {}
      });
    }
  }

  updateNavTabs(viewName) {
    const navTabs = ['dashboard', 'study', 'codex', 'agent'];
    navTabs.forEach(tab => {
      const btn = document.getElementById(`nav-tab-${tab}`);
      if (!btn) return;
      if (tab === viewName) {
        btn.classList.add('bg-slate-800', 'text-white', 'shadow-sm', 'ring-1', 'ring-white/10');
        btn.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-850/60');
      } else {
        btn.classList.remove('bg-slate-800', 'text-white', 'shadow-sm', 'ring-1', 'ring-white/10');
        btn.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-850/60');
      }
    });
  }
}
