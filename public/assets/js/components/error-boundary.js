/**
 * Error Boundary Component - Issue 5 Fix
 * Reusable error boundary for homepage sections
 */

class ErrorBoundary {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      title: 'Something went wrong',
      message: "We couldn't load this content. Please try again.",
      showRetry: true,
      retryCallback: null,
      ...options,
    };
  }

  show(error) {
    if (!this.container) {
      return;
    }

    console.error(`[ErrorBoundary] ${this.container.id}:`, error);

    this.container.innerHTML = `
      <div class="error-boundary" role="alert" aria-live="polite">
        <div class="error-boundary-icon" aria-hidden="true">⚠️</div>
        <h3 class="error-boundary-title">${this.options.title}</h3>
        <p class="error-boundary-message">${this.options.message}</p>
        ${
          this.options.showRetry
            ? `
          <button class="error-boundary-retry cta secondary" aria-label="Retry loading content">
            Try Again
          </button>
        `
            : ''
        }
      </div>
    `;

    if (this.options.showRetry && this.options.retryCallback) {
      const retryBtn = this.container.querySelector('.error-boundary-retry');
      retryBtn?.addEventListener('click', () => {
        this.showLoading();
        this.options.retryCallback();
      });
    }
  }

  showLoading() {
    if (!this.container) {
      return;
    }
    this.container.innerHTML = '<div class="card"><p class="small">Loading...</p></div>';
  }

  hide() {
    if (!this.container) {
      return;
    }
    const errorEl = this.container.querySelector('.error-boundary');
    if (errorEl) {
      errorEl.remove();
    }
  }
}

// Make available globally
window.ErrorBoundary = ErrorBoundary;
