/**
 * Loading Spinner Component
 * Provides consistent loading UI across the application
 *
 * Usage:
 *   const spinner = new LoadingSpinner();
 *   spinner.show(document.getElementById('container'), 'Loading data...');
 *   // ... async operation ...
 *   spinner.hide(document.getElementById('container'));
 */

class LoadingSpinner {
  constructor(options = {}) {
    this.size = options.size || 'medium'; // small, medium, large
    this.overlay = options.overlay !== false; // default true
  }

  /**
   * Show loading spinner in container
   * @param {HTMLElement} container - Container element
   * @param {string} message - Optional loading message
   */
  show(container, message = 'Loading...') {
    if (!container) {
      console.warn('LoadingSpinner: No container provided');
      return;
    }

    // Remove existing spinner if present
    this.hide(container);

    const spinnerHTML = `
      <div class="ef-loading-overlay" data-loading-spinner>
        <div class="ef-loading-spinner ef-loading-spinner-${this.size}">
          <div class="ef-spinner-icon"></div>
          ${message ? `<p class="ef-loading-message">${this.escapeHtml(message)}</p>` : ''}
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', spinnerHTML);
    container.classList.add('ef-loading-active');
  }

  /**
   * Hide loading spinner from container
   * @param {HTMLElement} container - Container element
   */
  hide(container) {
    if (!container) return;

    const spinner = container.querySelector('[data-loading-spinner]');
    if (spinner) {
      spinner.remove();
    }
    container.classList.remove('ef-loading-active');
  }

  /**
   * Show loading spinner on entire page
   * @param {string} message - Optional loading message
   */
  showFullPage(message = 'Loading...') {
    this.show(document.body, message);
  }

  /**
   * Hide full page loading spinner
   */
  hideFullPage() {
    this.hide(document.body);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Expose globally
window.LoadingSpinner = LoadingSpinner;

// Create default instance for convenience
window.loading = new LoadingSpinner();
