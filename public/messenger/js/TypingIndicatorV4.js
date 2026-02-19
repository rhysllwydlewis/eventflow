/**
 * TypingIndicatorV4 Component
 * Shows a bouncing-dots "someone is typing…" bubble.
 * Auto-hides after 3 seconds if not refreshed.
 * BEM prefix: messenger-v4__
 */

'use strict';

class TypingIndicatorV4 {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this._autoHideTimer = null;
    this._visible = false;
    this.init();
  }

  init() {
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  render() {
    this.container.innerHTML = `
      <div class="messenger-v4__typing-indicator" id="v4TypingIndicator" aria-live="polite" aria-atomic="true" style="display:none">
        <div class="messenger-v4__typing-bubble" role="status">
          <span class="messenger-v4__typing-dot" aria-hidden="true"></span>
          <span class="messenger-v4__typing-dot" aria-hidden="true"></span>
          <span class="messenger-v4__typing-dot" aria-hidden="true"></span>
        </div>
        <span class="messenger-v4__typing-label" id="v4TypingLabel"></span>
      </div>`;

    this.indicatorEl = this.container.querySelector('#v4TypingIndicator');
    this.labelEl = this.container.querySelector('#v4TypingLabel');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Show the typing indicator for a named user.
   * Resets the 3-second auto-hide timer each time it's called.
   * @param {string} name - Display name of the typing user
   */
  show(name) {
    if (!this.indicatorEl) return;

    clearTimeout(this._autoHideTimer);

    const label = name ? `${name} is typing…` : 'Someone is typing…';
    this.labelEl.textContent = label;
    this.indicatorEl.setAttribute('aria-label', label);
    this.indicatorEl.style.display = 'flex';
    this._visible = true;

    // Auto-hide after 3 s in case we miss the stop-typing event
    this._autoHideTimer = setTimeout(() => this.hide(), 3000);
  }

  /** Hide the typing indicator immediately. */
  hide() {
    clearTimeout(this._autoHideTimer);
    if (this.indicatorEl) {
      this.indicatorEl.style.display = 'none';
    }
    this._visible = false;
  }

  /** Whether the indicator is currently visible. */
  isVisible() {
    return this._visible;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

if (typeof window !== 'undefined') {
  window.TypingIndicatorV4 = TypingIndicatorV4;
}
