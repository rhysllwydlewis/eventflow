/**
 * Pricing Page JavaScript
 * Handles authentication state and dynamic button text updates
 */

(function () {
  'use strict';

  // Check authentication and get user info
  async function checkAuthAndUpdateButtons() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Handle both wrapped ({user: ...}) and unwrapped response formats
        const user = data.user || data;

        if (user) {
          // User is logged in, update buttons based on their current plan
          updateButtonsForAuthenticatedUser(user);
        } else {
          // No user data in response
          updateButtonsForUnauthenticatedUser();
        }
      } else if (response.status === 401) {
        // User is not authenticated - this is expected, not an error
        updateButtonsForUnauthenticatedUser();
      } else {
        // Other error status
        updateButtonsForUnauthenticatedUser();
      }
    } catch (error) {
      // Network error - fail silently and show default state
      updateButtonsForUnauthenticatedUser();
    }
  }

  // Check if user's Pro plan is active (copied from server.js logic)
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

  // Update buttons for authenticated users
  function updateButtonsForAuthenticatedUser(user) {
    // Check if user has Pro plan active
    const hasActivePro = isProActive(user);

    // Update free plan button
    const freeButtons = document.querySelectorAll('a[href="/checkout.html?plan=starter"]');
    freeButtons.forEach(button => {
      if (!hasActivePro) {
        // User is on free plan (not Pro or Pro has expired)
        button.textContent = 'Current Plan';
        button.classList.remove('secondary');
        button.style.opacity = '0.6';
        button.style.cursor = 'default';
        button.style.pointerEvents = 'none';
        button.setAttribute('aria-disabled', 'true');
      }
    });

    // If user has active Pro, you could also update those buttons to show "Current Plan"
    // This would require knowing which specific pro plan they have
    // For now, we'll just handle the free plan case
  }

  // Update buttons for unauthenticated users to redirect to auth
  function updateButtonsForUnauthenticatedUser() {
    // Find all pricing CTAs and update them to redirect to auth with plan parameter
    const allPricingButtons = document.querySelectorAll('a[href*="/checkout.html?plan="]');
    allPricingButtons.forEach(button => {
      const originalHref = button.getAttribute('href');
      if (originalHref) {
        const url = new URL(originalHref, window.location.origin);
        const plan = url.searchParams.get('plan');

        if (plan) {
          // Redirect to auth with plan and redirect parameters
          const authUrl = new URL('/auth.html', window.location.origin);
          authUrl.searchParams.set('redirect', originalHref);
          authUrl.searchParams.set('plan', plan);
          button.setAttribute('href', authUrl.toString());
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
