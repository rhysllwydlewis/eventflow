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
        const user = data.user;

        if (user) {
          // User is logged in, update buttons based on their current plan
          updateButtonsForAuthenticatedUser(user);
        }
      }
      // If not logged in, buttons remain as default
    } catch (error) {
      console.error('Error checking authentication:', error);
      // Fail silently - buttons will show default state
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
    if (!expiryTime || isNaN(expiryTime)) {
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
