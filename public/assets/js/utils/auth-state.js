/**
 * Centralized Auth State Manager
 * Manages authentication state and prevents unnecessary API calls
 * Only calls /api/auth/me when a token/session is present
 */

(function () {
  'use strict';

  // Auth state constants
  const AUTH_STATES = {
    LOADING: 'loading',
    AUTHENTICATED: 'authenticated',
    UNAUTHENTICATED: 'unauthenticated',
  };

  // Storage keys - these match keys used throughout the app
  const STORAGE_KEYS = {
    USER: 'user',
    ONBOARDING: 'eventflow_onboarding_new',
  };

  const SESSION_COOKIE_NAME = 'connect.sid'; // Express session cookie name

  class AuthStateManager {
    constructor() {
      this.state = AUTH_STATES.LOADING;
      this.user = null;
      this.listeners = [];
      this.initialized = false;
      this.initPromise = null;
    }

    /**
     * Initialize auth state - call this once on page load
     * @returns {Promise<Object>} User object or null
     */
    async init() {
      // Return existing promise if already initializing
      if (this.initPromise) {
        return this.initPromise;
      }

      // Return immediately if already initialized
      if (this.initialized) {
        return { state: this.state, user: this.user };
      }

      // Create initialization promise
      this.initPromise = this._initializeAuthState();

      try {
        const result = await this.initPromise;
        this.initialized = true;
        return result;
      } finally {
        this.initPromise = null;
      }
    }

    /**
     * Internal initialization logic
     * @private
     */
    async _initializeAuthState() {
      // Check if we have a session cookie
      const hasSessionCookie = this._hasSessionCookie();

      if (!hasSessionCookie) {
        // No session cookie means definitely not authenticated
        this._setState(AUTH_STATES.UNAUTHENTICATED, null);
        return { state: this.state, user: null };
      }

      // We have a session cookie, check with server
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const user = data.user || null;
          this._setState(AUTH_STATES.AUTHENTICATED, user);
          return { state: this.state, user };
        } else if (response.status === 401 || response.status === 403) {
          // Session expired or invalid - clear it
          this._clearAuthState();
          this._setState(AUTH_STATES.UNAUTHENTICATED, null);
          return { state: this.state, user: null };
        } else {
          // Other error - treat as unauthenticated
          console.warn('Auth check failed with status:', response.status);
          this._setState(AUTH_STATES.UNAUTHENTICATED, null);
          return { state: this.state, user: null };
        }
      } catch (error) {
        // Network error - treat as unauthenticated
        console.error('Auth check failed:', error);
        this._setState(AUTH_STATES.UNAUTHENTICATED, null);
        return { state: this.state, user: null };
      }
    }

    /**
     * Check if session cookie exists
     * @private
     * @returns {boolean}
     */
    _hasSessionCookie() {
      const cookies = document.cookie.split(';');
      return cookies.some(cookie => {
        const trimmed = cookie.trim();
        return (
          trimmed.startsWith(`${SESSION_COOKIE_NAME}=`) ||
          trimmed.startsWith('token=') ||
          trimmed.startsWith('auth=')
        );
      });
    }

    /**
     * Clear auth state from storage
     * @private
     */
    _clearAuthState() {
      try {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
        sessionStorage.clear();
      } catch (e) {
        // Ignore storage errors
      }
    }

    /**
     * Set auth state and notify listeners
     * @private
     */
    _setState(state, user) {
      const previousState = this.state;
      this.state = state;
      this.user = user;

      // Only notify if state actually changed
      if (previousState !== state) {
        this._notifyListeners();
      }
    }

    /**
     * Notify all listeners of state change
     * @private
     */
    _notifyListeners() {
      this.listeners.forEach(listener => {
        try {
          listener({ state: this.state, user: this.user });
        } catch (e) {
          console.error('Error in auth state listener:', e);
        }
      });
    }

    /**
     * Get current auth state
     * @returns {string} One of AUTH_STATES
     */
    getState() {
      return this.state;
    }

    /**
     * Get current user
     * @returns {Object|null}
     */
    getUser() {
      return this.user;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
      return this.state === AUTH_STATES.AUTHENTICATED && this.user !== null;
    }

    /**
     * Check if auth state is loading
     * @returns {boolean}
     */
    isLoading() {
      return this.state === AUTH_STATES.LOADING;
    }

    /**
     * Subscribe to auth state changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
      this.listeners.push(callback);

      // Return unsubscribe function
      return () => {
        this.listeners = this.listeners.filter(l => l !== callback);
      };
    }

    /**
     * Refresh auth state (e.g., after login/logout)
     * @returns {Promise<Object>}
     */
    async refresh() {
      this.initialized = false;
      this.initPromise = null;
      return this.init();
    }

    /**
     * Mark user as logged out
     */
    logout() {
      this._clearAuthState();
      this._setState(AUTH_STATES.UNAUTHENTICATED, null);
    }
  }

  // Export as singleton
  if (typeof window !== 'undefined') {
    window.AuthStateManager = new AuthStateManager();
    window.AUTH_STATES = AUTH_STATES;
  }
})();
