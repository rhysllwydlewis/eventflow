/**
 * P3-13: Password Toggle
 * Add show/hide password functionality to password inputs
 */

(function () {
  'use strict';

  /**
   * Initialize password toggles
   */
  function initPasswordToggles() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');

    if (passwordInputs.length === 0) {
      return;
    }

    passwordInputs.forEach(input => {
      // Skip if already has toggle
      if (input.parentElement.classList.contains('password-input-wrapper')) {
        return;
      }

      addPasswordToggle(input);
    });
  }

  /**
   * Add toggle button to password input
   */
  function addPasswordToggle(input) {
    // Wrap input if not already wrapped
    if (!input.parentElement.classList.contains('password-input-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'password-input-wrapper';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    const wrapper = input.parentElement;

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle-btn';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.innerHTML = '<span class="icon-eye" aria-hidden="true">👁️</span>';

    // Add click handler
    toggle.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      // Update icon
      toggle.innerHTML = isPassword
        ? '<span class="icon-eye-slash" aria-hidden="true">🙈</span>'
        : '<span class="icon-eye" aria-hidden="true">👁️</span>';

      // Update aria-label
      toggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      // Keep focus on input
      input.focus();
    });

    wrapper.appendChild(toggle);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordToggles);
  } else {
    initPasswordToggles();
  }

  // Export for use in other scripts
  if (typeof window !== 'undefined') {
    window.PasswordToggle = {
      init: initPasswordToggles,
      add: addPasswordToggle,
    };
  }
})();
