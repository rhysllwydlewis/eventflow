/**
 * Pricing Page JavaScript
 * Handles authentication state and dynamic button text updates.
 * Owns all pricing CTA click handling (single authoritative handler).
 */

(function () {
  'use strict';

  // Check authentication and get user info
  async function checkAuthAndUpdateButtons() {
    try {
      let user = null;

      // Prefer the centralised auth state manager to avoid duplicate API calls
      if (window.AuthStateManager) {
        const authState = await window.AuthStateManager.init();
        user = authState && authState.user;
      } else {
        const response = await fetch('/api/v1/auth/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          // Handle both wrapped ({user: ...}) and unwrapped response formats
          user = data.user || data;
        }
      }

      if (user) {
        // User is logged in – update button labels and attach checkout handlers
        updateButtonsForAuthenticatedUser(user);
        attachCheckoutHandlers(user);
      } else {
        // User is not authenticated – rewrite CTAs to go via auth first
        updateButtonsForUnauthenticatedUser();
      }
    } catch (error) {
      // Network error - fail silently and show default state
      updateButtonsForUnauthenticatedUser();
    }
  }

  // Check if user's Pro plan is active (mirrors server.js logic)
  function isProActive(user) {
    if (!user || !user.isPro) {
      return false;
    }
    if (!user.proExpiresAt) {
      return !!user.isPro;
    }
    const expiryTime = Date.parse(user.proExpiresAt);
    if (isNaN(expiryTime)) {
      return !!user.isPro;
    }
    return expiryTime > Date.now();
  }

  // Update button labels for authenticated users
  function updateButtonsForAuthenticatedUser(user) {
    const hasActivePro = isProActive(user);

    // Mark the free plan button as the current plan when user has no active Pro
    const freeButtons = document.querySelectorAll(
      'a[href="/checkout?plan=free"], a[href="/checkout?plan=starter"]'
    );
    freeButtons.forEach(button => {
      if (!hasActivePro) {
        button.textContent = 'Current Plan';
        button.classList.remove('secondary');
        button.style.opacity = '0.6';
        button.style.cursor = 'default';
        button.style.pointerEvents = 'none';
        button.setAttribute('aria-disabled', 'true');
      }
    });
  }

  // Attach direct checkout click handlers for authenticated users.
  // This replaces the (now-removed) inline script in pricing.html.
  function attachCheckoutHandlers(user) {
    const returnUrl =
      user && user.role === 'customer'
        ? window.location.origin + '/dashboard-customer.html'
        : window.location.origin + '/dashboard-supplier.html';

    const pricingButtons = document.querySelectorAll('.pricing-cta');
    pricingButtons.forEach(button => {
      // Skip buttons that are already disabled (e.g. "Current Plan")
      if (button.getAttribute('aria-disabled') === 'true') {
        return;
      }

      button.setAttribute('data-original-text', button.textContent);

      button.addEventListener('click', async function (e) {
        const href = this.getAttribute('href');
        const planMatch = href && href.match(/plan=(\w+)/);

        if (!planMatch) {
          // No plan in href – allow default navigation
          return;
        }

        e.preventDefault();
        const planId = planMatch[1];

        try {
          this.disabled = true;
          this.textContent = 'Processing...';

          const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
          if (!csrfResponse.ok) {
            throw new Error('Failed to get CSRF token');
          }
          const csrfData = await csrfResponse.json();
          const csrfToken = csrfData.token || csrfData.csrfToken;

          const response = await fetch('/api/v2/subscriptions/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({
              planId: planId,
              returnUrl: returnUrl,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.error || errorData.message || 'Failed to create checkout session'
            );
          }

          const data = await response.json();
          if (data.url || data.checkoutUrl) {
            window.location.href = data.url || data.checkoutUrl;
          } else {
            throw new Error('No checkout URL returned');
          }
        } catch (error) {
          console.error('Checkout error:', error);
          if (window.showNotification) {
            window.showNotification(
              error.message || 'Failed to start checkout. Please try again.',
              'error'
            );
          } else {
            alert(error.message || 'Failed to start checkout. Please try again.');
          }
          this.disabled = false;
          this.textContent = this.getAttribute('data-original-text') || 'Upgrade';
        }
      });
    });
  }

  // Rewrite CTAs for unauthenticated users to go via the auth page first.
  // Uses canonical (extensionless) paths in the redirect parameter.
  function updateButtonsForUnauthenticatedUser() {
    const allPricingButtons = document.querySelectorAll('a[href*="/checkout?plan="]');
    allPricingButtons.forEach(button => {
      const originalHref = button.getAttribute('href');
      if (originalHref) {
        const url = new URL(originalHref, window.location.origin);
        const plan = url.searchParams.get('plan');

        if (plan) {
          // Use canonical extensionless redirect path so auth page can send user
          // back to pricing (not auth) after login, avoiding the loop.
          button.setAttribute(
            'href',
            `/auth?redirect=${encodeURIComponent('/pricing?plan=' + plan)}`
          );
        }
      }
    });
  }

  // Initialize
  function init() {
    checkAuthAndUpdateButtons();
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
