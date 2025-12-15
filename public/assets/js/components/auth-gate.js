/**
 * AuthGate Utility
 * Provides authentication state checks and utilities for UI components
 */

class AuthGate {
  constructor() {
    this.user = null;
    this.loadUser();
  }

  /**
   * Load user from localStorage
   */
  loadUser() {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        this.user = JSON.parse(userData);
      }
    } catch (e) {
      /* Ignore errors */
    }
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.user !== null && this.user.id !== undefined;
  }

  /**
   * Get current user
   * @returns {Object|null}
   */
  getUser() {
    return this.user;
  }

  /**
   * Get user role
   * @returns {string|null}
   */
  getUserRole() {
    return this.user ? this.user.role : null;
  }

  /**
   * Redirect to login page
   * @param {string} returnUrl - Optional return URL after login
   */
  redirectToLogin(returnUrl) {
    const url = returnUrl ? `/auth.html?return=${encodeURIComponent(returnUrl)}` : '/auth.html';
    window.location.href = url;
  }

  /**
   * Show authentication required message
   * @param {string} message - Custom message to display
   * @returns {HTMLElement}
   */
  createAuthPrompt(message = 'Please create an account or log in to continue') {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'auth-prompt';
    promptDiv.innerHTML = `
      <div class="auth-prompt-content">
        <p>${message}</p>
        <div class="auth-prompt-actions">
          <button class="cta" onclick="window.location.href='/auth.html?mode=register'">
            Create Account
          </button>
          <button class="cta secondary" onclick="window.location.href='/auth.html'">
            Log In
          </button>
        </div>
      </div>
    `;
    return promptDiv;
  }

  /**
   * Store pending action to be executed after login
   * @param {string} key - Action identifier
   * @param {any} data - Action data
   */
  storePendingAction(key, data) {
    try {
      sessionStorage.setItem(`pending_${key}`, JSON.stringify(data));
    } catch (e) {
      /* Ignore errors */
    }
  }

  /**
   * Retrieve and clear pending action
   * @param {string} key - Action identifier
   * @returns {any|null}
   */
  getPendingAction(key) {
    try {
      const data = sessionStorage.getItem(`pending_${key}`);
      if (data) {
        sessionStorage.removeItem(`pending_${key}`);
        return JSON.parse(data);
      }
    } catch (e) {
      /* Ignore errors */
    }
    return null;
  }
}

// Export as singleton
if (typeof window !== 'undefined') {
  window.AuthGate = window.AuthGate || new AuthGate();
}
