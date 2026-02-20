/**
 * ContextBannerV4 Component
 * Displays a gradient glass card banner showing conversation context
 * (package / supplier / marketplace) above the chat area.
 * BEM prefix: messenger-v4__
 */

'use strict';

class ContextBannerV4 {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this._currentContext = null;
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
      <div class="messenger-v4__context-banner" id="v4ContextBanner" role="complementary" aria-label="Conversation context" style="display:none">
        <div class="messenger-v4__context-banner-inner">
          <div class="messenger-v4__context-banner-left">
            <span class="messenger-v4__context-banner-icon" id="v4BannerIcon" aria-hidden="true"></span>
            <div class="messenger-v4__context-banner-text">
              <span class="messenger-v4__context-banner-title" id="v4BannerTitle"></span>
              <span class="messenger-v4__context-banner-subtitle" id="v4BannerSubtitle"></span>
            </div>
          </div>
          <div class="messenger-v4__context-banner-right">
            <img class="messenger-v4__context-banner-thumb" id="v4BannerThumb" alt="" style="display:none" />
            <a class="messenger-v4__context-banner-link" id="v4BannerLink" target="_blank" rel="noopener noreferrer" aria-label="View context">View →</a>
          </div>
        </div>
      </div>`;

    this.bannerEl = this.container.querySelector('#v4ContextBanner');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Show the context banner with the given context data.
   * @param {Object} context - { type, title, subtitle, url, imageUrl }
   *   type: 'package' | 'supplier' | 'marketplace'
   */
  show(context) {
    if (!context) return;
    this._currentContext = context;

    const iconMap = { package: '📦', supplier: '🏢', marketplace: '🛒' };
    const icon = iconMap[context.type] || '💬';

    this.bannerEl.querySelector('#v4BannerIcon').textContent = icon;
    this.bannerEl.querySelector('#v4BannerTitle').textContent = context.title || '';
    this.bannerEl.querySelector('#v4BannerSubtitle').textContent = context.subtitle || '';

    // Update the "View" link — sanitise to block javascript: / data: URIs
    const link = this.bannerEl.querySelector('#v4BannerLink');
    if (context.url) {
      const safeHref = this._safeUrl(context.url);
      if (safeHref !== '#') {
        link.href = safeHref;
        link.style.display = 'inline-flex';
      } else {
        link.style.display = 'none';
      }
    } else {
      link.style.display = 'none';
    }

    // Show thumbnail if provided — only allow relative paths (same-origin)
    const thumb = this.bannerEl.querySelector('#v4BannerThumb');
    if (context.imageUrl && /^\//.test(context.imageUrl)) {
      thumb.src = context.imageUrl;
      thumb.alt = this.escape(context.title || 'Context image');
      thumb.style.display = 'block';
    } else {
      thumb.style.display = 'none';
      thumb.src = '';
    }

    // Apply type modifier class for gradient theming
    this.bannerEl.className = `messenger-v4__context-banner messenger-v4__context-banner--${this.escape(context.type || 'direct')}`;
    this.bannerEl.style.display = '';

    // Announce to screen readers
    this.bannerEl.setAttribute('aria-label', `${icon} ${context.title || ''} conversation context`);
  }

  /** Hide the context banner. */
  hide() {
    this._currentContext = null;
    if (this.bannerEl) {
      this.bannerEl.style.display = 'none';
    }
  }

  /** Returns the currently displayed context, or null. */
  getContext() {
    return this._currentContext;
  }

  escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Block javascript: / data: / vbscript: href values. Returns '#' for unsafe URLs. */
  _safeUrl(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
    return this.escape(trimmed);
  }
}

if (typeof window !== 'undefined') {
  window.ContextBannerV4 = ContextBannerV4;
}
