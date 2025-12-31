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

  // Update buttons for authenticated users
  function updateButtonsForAuthenticatedUser(user) {
    // Check if user has the free plan (no subscription or isPro is false)
    const hasFreeP = !user.isPro || user.isPro === false;

    // Update free plan button
    const freeButtons = document.querySelectorAll('a[href="/checkout.html?plan=starter"]');
    freeButtons.forEach(button => {
      if (hasFreeP) {
        // User has free plan
        button.textContent = 'Current Plan';
        button.classList.remove('secondary');
        button.classList.add('disabled');
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        button.style.pointerEvents = 'none';
      }
    });

    // Check if user is a supplier and has Pro/Pro Plus
    if (user.role === 'supplier' && user.isPro) {
      // Could also check subscription details to determine exact plan
      // For now, just indicate they have a pro plan
      // You could add more specific checks here if you store plan details
    }
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
