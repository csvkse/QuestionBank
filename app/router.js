/**
 * Application View Router
 * Core: app/router.js
 */

export class AppRouter {
  constructor(app) {
    this.app = app;
    this.currentView = 'study';
  }

  navigate(viewId) {
    this.currentView = viewId;
    const views = ['view-arena', 'view-review', 'view-study', 'view-stats'];
    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.classList.add('hidden');
    });

    const targetEl = document.getElementById(`view-${viewId}`);
    if (targetEl) targetEl.classList.remove('hidden');

    // 更新导航高亮
    const navBtns = document.querySelectorAll('.nav-tab-btn');
    navBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
        btn.classList.remove('text-slate-400', 'hover:text-white', 'bg-transparent');
      } else {
        btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-600/30');
        btn.classList.add('text-slate-400', 'hover:text-white', 'bg-transparent');
      }
    });

    // 触发对应视图的数据渲染
    if (viewId === 'study') this.app.renderStudyHub();
    else if (viewId === 'review') this.app.renderReviewBoard();
    else if (viewId === 'stats') this.app.renderStats();
  }
}
