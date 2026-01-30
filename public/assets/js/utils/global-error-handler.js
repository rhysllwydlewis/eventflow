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
  function showUserError(error) {
    // Check if Toast component is available
    if (window.Toast && typeof window.Toast.error === 'function') {
      window.Toast.error(
        isDevelopment
          ? `Error: ${error.message}`
          : 'Something went wrong. Please refresh the page or contact support.',
        'Error'
      );
    } else {
      // Fallback to alert if Toast not available
      alert(
        isDevelopment
          ? `Error: ${error.message}\n\nCheck console for details.`
          : 'Something went wrong. Please refresh the page or contact support.'
      );
    }
  }

  /**
   * Handle global JavaScript errors
   */
  window.addEventListener('error', event => {
    logError(event.error || new Error(event.message), {
      type: 'global_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    showUserError(event.error || new Error(event.message));

    // Prevent default browser error handling
    event.preventDefault();
  });

  /**
   * Handle unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', event => {
    const error =
      event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    logError(error, {
      type: 'unhandled_promise_rejection',
      promise: event.promise,
    });

    showUserError(error);

    // Prevent default browser error handling
    event.preventDefault();
  });

  /**
   * Expose manual error reporting
   */
  window.reportError = function (error, context) {
    logError(error, { ...context, type: 'manual_report' });
  };

  console.log('✅ Global error handler initialized');
})();
