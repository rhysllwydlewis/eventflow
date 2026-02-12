/**
 * Loading State Component - Issue 6 Fix
 * Unified loading skeleton for consistent UX
 */

class LoadingState {
  static createSkeleton(type = 'card', count = 3) {
    const skeletons = {
      card: `
        <div class="skeleton-card">
          <div class="skeleton-image"></div>
          <div class="skeleton-content">
            <div class="skeleton-text skeleton-title"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text skeleton-short"></div>
          </div>
        </div>
      `,
      list: `
        <div class="skeleton-list-item">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-content">
            <div class="skeleton-text skeleton-title"></div>
            <div class="skeleton-text"></div>
          </div>
        </div>
      `,
    };

    return Array(count)
      .fill(0)
      .map(() => skeletons[type] || skeletons.card)
      .join('');
  }

  static show(containerId, type = 'card', count = 3) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const skeletonHtml = this.createSkeleton(type, count);
    container.innerHTML = `<div class="skeleton-container">${skeletonHtml}</div>`;
  }

  static hide(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const skeleton = container.querySelector('.skeleton-container');
    if (skeleton) {
      skeleton.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => skeleton.remove(), 200);
    }
  }
}

// Make available globally
window.LoadingState = LoadingState;
