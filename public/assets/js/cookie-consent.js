/**
 * Cookie Consent Banner - UK GDPR/PECR Compliant
 *
 * This implements a cookie consent banner compliant with UK law (GDPR & PECR).
 * It allows users to accept or reject non-essential cookies and remembers their choice.
 *
 * Essential cookies (authentication) are always allowed as they are strictly necessary
 * for the service to function.
 */

(function () {
  'use strict';

  // Cookie names
  const CONSENT_COOKIE_NAME = 'eventflow_cookie_consent';
  const CONSENT_EXPIRY_DAYS = 365; // Store consent for 1 year as per UK guidance

  /**
   * Get a cookie value by name
   */
  function getCookie(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  }

  /**
   * Set a cookie
   */
  function setCookie(name, value, days) {
    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax`;
  }

  /**
   * Check if user has already given consent
   */
  function hasConsent() {
    return getCookie(CONSENT_COOKIE_NAME) !== null;
  }

  /**
   * Save user's consent choice
   */
  function saveConsent(accepted) {
    const consentValue = accepted ? 'accepted' : 'rejected';
    setCookie(CONSENT_COOKIE_NAME, consentValue, CONSENT_EXPIRY_DAYS);

    // Dispatch event so other scripts can respond to consent changes
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent('cookieConsentChanged', {
        detail: { accepted: accepted },
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Remove the banner from the page
   */
  function removeBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.add('cookie-consent-hiding');
      setTimeout(() => {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      }, 300);
    }
  }

  /**
   * Create and show the cookie consent banner
   */
  function showCookieBanner() {
    // Don't show if consent already given
    if (hasConsent()) {
      return;
    }

    // Create banner HTML
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.className = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML =
      '<div class="cookie-consent-content">' +
      '<div class="cookie-consent-message">' +
      '<p><strong>We use cookies</strong></p>' +
      '<p>We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve user experience. By clicking "Accept", you agree to our use of cookies.</p>' +
      '<p class="cookie-consent-links">' +
      '<a href="/privacy.html" target="_blank">Privacy Policy</a> · ' +
      '<a href="/terms.html" target="_blank">Terms of Service</a>' +
      '</p>' +
      '</div>' +
      '<div class="cookie-consent-actions">' +
      '<button id="cookie-consent-accept" class="cookie-consent-btn cookie-consent-accept" aria-label="Accept cookies">Accept</button>' +
      '<button id="cookie-consent-reject" class="cookie-consent-btn cookie-consent-reject" aria-label="Reject non-essential cookies">Reject</button>' +
      '</div>' +
      '</div>';

    // Add to page
    document.body.appendChild(banner);

    // Trigger animation
    setTimeout(() => {
      banner.classList.add('cookie-consent-visible');
    }, 100);

    // Add event listeners
    document.getElementById('cookie-consent-accept').addEventListener('click', () => {
      saveConsent(true);
      removeBanner();
    });

    document.getElementById('cookie-consent-reject').addEventListener('click', () => {
      saveConsent(false);
      removeBanner();
    });
  }

  /**
   * Initialize the cookie consent banner
   */
  function init() {
    // Show banner if consent not given
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showCookieBanner);
    } else {
      showCookieBanner();
    }
  }

  // Public API
  window.CookieConsent = {
    hasConsent: hasConsent,
    getConsent: function () {
      const consent = getCookie(CONSENT_COOKIE_NAME);
      return consent === 'accepted';
    },
    show: showCookieBanner,
    init: init,
  };

  // Auto-initialize
  init();
})();
