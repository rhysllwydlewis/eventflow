/**
 * Debounce and Throttle Utility Functions
 * Performance optimization for event handlers
 */

/**
 * Debounce function
 * Delays execution until after wait time has elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300, immediate = false) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

/**
 * Throttle function
 * Ensures function is called at most once per specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;
  let lastFunc;
  let lastRan;

  return function executedFunction(...args) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        },
        Math.max(limit - (Date.now() - lastRan), 0)
      );
    }
  };
}

/**
 * Request Animation Frame throttle
 * Throttles function to run once per animation frame
 * @param {Function} func - Function to throttle
 * @returns {Function} - Throttled function
 */
function rafThrottle(func) {
  let rafId = null;

  return function executedFunction(...args) {
    const context = this;

    if (rafId !== null) {
      return;
    }

    rafId = requestAnimationFrame(() => {
      func.apply(context, args);
      rafId = null;
    });
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debounce, throttle, rafThrottle };
}

// Make available globally
if (typeof window !== 'undefined') {
  window.debounce = debounce;
  window.throttle = throttle;
  window.rafThrottle = rafThrottle;
}
