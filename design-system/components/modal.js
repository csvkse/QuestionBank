/**
 * Modal Dialog Controller
 * Core: design-system/components/modal.js
 */

export class ModalController {
  static open(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  static close(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  static toggle(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      if (el.classList.contains('hidden')) {
        this.open(elementId);
      } else {
        this.close(elementId);
      }
    }
  }
}
