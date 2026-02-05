/**
 * Global Error Handler
 * Catches all unhandled errors and promise rejections
 * Logs to console/Sentry and shows user-friendly messages
 */

(function () {
  'use strict';

  const isDevelopment =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Track errors to prevent flooding
  const recentErrors = new Set();
  const ERROR_COOLDOWN = 5000; // 5 seconds

  /**
   * Log error to console and external service
   */
  function logError(error, context = {}) {
    const errorKey = `${error.message}-${error.stack?.substring(0, 50)}`;

    // Prevent duplicate error notifications
    if (recentErrors.has(errorKey)) {
      return;
    }

    recentErrors.add(errorKey);
    setTimeout(() => recentErrors.delete(errorKey), ERROR_COOLDOWN);

    // Console logging
    console.error('🚨 Global Error Caught:', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    // Send to Sentry if configured
    if (window.Sentry && window.Sentry.captureException) {
      window.Sentry.captureException(error, {
        tags: context,
        level: 'error',
      });
    }
  }

  /**
   * Show user-friendly error message
   */
  function showUserError(message) {
    const errorMessage =
      typeof message === 'string' ? message : message?.message || 'An unexpected error occurred';

    const displayMessage = isDevelopment
      ? errorMessage
      : 'Something went wrong. Please refresh the page or contact support.';

    // Use EventFlowNotifications if available (PR #431)
    if (
      window.EventFlowNotifications &&
      typeof window.EventFlowNotifications.error === 'function'
    ) {
      window.EventFlowNotifications.error(displayMessage);
    } else if (window.Toast && typeof window.Toast.error === 'function') {
      // Fallback to old Toast system
      window.Toast.error(displayMessage, 'Error');
    } else {
      // Final fallback to console.warn (no alerts in production)
      console.warn('⚠️ Error notification:', displayMessage);
    }
  }

  /**
   * Setup global fetch interceptor for automatic error handling
   */
  function setupFetchInterceptor() {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(this, args);

        // Handle successful responses
        if (response.ok) {
          return response;
        }

        // Handle API errors (4xx, 5xx)
        const clonedResponse = response.clone();
        let errorMessage = `Request failed with status ${response.status}`;

        try {
          const data = await clonedResponse.json();
          errorMessage = data.error || data.message || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use default error message
          console.debug('Could not parse error response as JSON:', parseError);
        }

        // Log the error
        logError(new Error(errorMessage), {
          type: 'api_error',
          status: response.status,
          url: args[0],
        });

        // Show user notification
        if (
          window.EventFlowNotifications &&
          typeof window.EventFlowNotifications.error === 'function'
        ) {
          window.EventFlowNotifications.error(errorMessage);
        }

        // Return original response so calling code can still handle it
        return response;
      } catch (error) {
        // Handle network errors
        logError(error, {
          type: 'network_error',
          url: args[0],
        });

        // Show user notification for network errors
        const networkMessage = 'Network error. Please check your connection and try again.';
        if (
          window.EventFlowNotifications &&
          typeof window.EventFlowNotifications.error === 'function'
        ) {
          window.EventFlowNotifications.error(networkMessage);
        }

        // Re-throw so calling code knows it failed
        throw error;
      }
    };

    console.log('✅ Fetch interceptor initialized');
  }

  /**
   * Handle global JavaScript errors
   */
  window.addEventListener('error', event => {
    const error = event.error || new Error(event.message);
    const errorMessage = error.message || 'Unknown error';

    // Ignore benign errors
    if (errorMessage.includes('ResizeObserver loop limit exceeded')) {
      return;
    }

    logError(error, {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    // Show user notification
    showUserError('An unexpected error occurred');

    // Prevent default browser error handling (only in production for better UX)
    // In development, preserve full debugging capabilities
    if (!isDevelopment) {
      event.preventDefault();
    }
  });

  /**
   * Handle unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', event => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const errorMessage = error.message || 'Unknown error';

    // Ignore benign errors
    if (errorMessage.includes('ResizeObserver loop limit exceeded')) {
      return;
    }

    logError(error, {
      type: 'unhandled_promise_rejection',
      promise: event.promise,
    });

    // Show user notification
    showUserError('An unexpected error occurred');

    // Prevent default browser error handling (only in production for better UX)
    // In development, preserve full debugging capabilities
    if (!isDevelopment) {
      event.preventDefault();
    }
  });

  /**
   * Expose manual error reporting
   */
  window.reportError = function (error, context) {
    logError(error, { ...context, type: 'manual_report' });
  };

  // Initialize fetch interceptor
  setupFetchInterceptor();

  console.log('✅ Global error handler initialized');
})();
