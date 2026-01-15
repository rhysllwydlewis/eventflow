/**
 * Count-Up Animation Utility
 * Animates numbers from 0 to target value with easing
 */

/**
 * Ease out cubic function
 * @param {number} t - Progress (0 to 1)
 * @returns {number} Eased value
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animate a number from start to end
 * @param {HTMLElement} element - Element to animate
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} duration - Duration in milliseconds
 * @param {Function} formatter - Optional formatter function
 */
export function animateNumber(
  element,
  start,
  end,
  duration = 1500,
  formatter = n => Math.round(n).toLocaleString()
) {
  const startTime = performance.now();
  const range = end - start;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    const current = start + range * easedProgress;

    element.textContent = formatter(current);

    // Add pulse animation on completion
    if (progress === 1) {
      element.classList.add('animating');
      setTimeout(() => {
        element.classList.remove('animating');
      }, 600);
    } else {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Initialize count-up animation for elements with data-target attribute
 * Uses Intersection Observer to trigger when element becomes visible
 * @param {string} selector - CSS selector for elements to animate
 * @param {object} options - Options for the animation
 */
export function initCountUp(selector = '[data-target]', options = {}) {
  const { duration = 1500, threshold = 0.5, rootMargin = '0px', formatter = null } = options;

  const elements = document.querySelectorAll(selector);

  // Create intersection observer
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.animated) {
          entry.target.dataset.animated = 'true';
          const targetValue = parseFloat(entry.target.dataset.target || 0);
          const startValue = parseFloat(entry.target.dataset.start || 0);
          const format = entry.target.dataset.format || 'number';

          // Choose formatter based on format type
          let formatterFn = formatter;
          if (!formatterFn) {
            switch (format) {
              case 'percent':
                formatterFn = n => `${Math.round(n)}%`;
                break;
              case 'currency':
                formatterFn = n => `£${Math.round(n).toLocaleString()}`;
                break;
              case 'decimal':
                formatterFn = n => n.toFixed(1);
                break;
              case 'time':
                formatterFn = n => `${Math.round(n)}h`;
                break;
              default:
                formatterFn = n => Math.round(n).toLocaleString();
            }
          }

          animateNumber(entry.target, startValue, targetValue, duration, formatterFn);

          // Unobserve after animation
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold,
      rootMargin,
    }
  );

  // Observe all elements
  elements.forEach(element => observer.observe(element));

  return observer;
}

/**
 * Animate a percentage with visual feedback
 * @param {HTMLElement} element - Element to animate
 * @param {number} percent - Target percentage (0-100)
 * @param {number} duration - Duration in milliseconds
 */
export function animatePercentage(element, percent, duration = 1500) {
  animateNumber(element, 0, percent, duration, n => `${Math.round(n)}%`);
}

/**
 * Animate currency value
 * @param {HTMLElement} element - Element to animate
 * @param {number} amount - Target amount
 * @param {string} currency - Currency symbol
 * @param {number} duration - Duration in milliseconds
 */
export function animateCurrency(element, amount, currency = '£', duration = 1500) {
  animateNumber(element, 0, amount, duration, n => currency + Math.round(n).toLocaleString());
}

/**
 * Animate progress bar
 * @param {HTMLElement} progressBar - Progress bar element
 * @param {number} percent - Target percentage (0-100)
 */
export function animateProgressBar(progressBar, percent) {
  if (!progressBar) {
    return;
  }

  // Clamp percentage between 0 and 100
  const clampedPercent = Math.max(0, Math.min(100, percent));

  // Set width with animation
  setTimeout(() => {
    progressBar.style.width = `${clampedPercent}%`;
  }, 50);

  // Update color based on percentage if it has color classes
  if (clampedPercent >= 80) {
    progressBar.classList.add('danger');
    progressBar.classList.remove('warning');
  } else if (clampedPercent >= 60) {
    progressBar.classList.add('warning');
    progressBar.classList.remove('danger');
  } else {
    progressBar.classList.remove('warning', 'danger');
  }
}

/**
 * Animate circular progress ring (SVG)
 * @param {SVGCircleElement} circle - SVG circle element
 * @param {number} percent - Target percentage (0-100)
 * @param {number} radius - Circle radius
 */
export function animateCircularProgress(circle, percent, radius = 45) {
  if (!circle) {
    return;
  }

  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  // Trigger animation
  setTimeout(() => {
    circle.style.strokeDashoffset = offset;
  }, 100);
}

/**
 * Create and animate a stat widget
 * @param {object} config - Widget configuration
 * @returns {string} HTML string for widget
 */
export function createStatWidget(config) {
  const {
    icon = '📊',
    value = 0,
    label = 'Stat',
    format = 'number',
    color = 'linear-gradient(135deg, #0B8073 0%, #13B6A2 100%)',
    pulse = false,
  } = config;

  const pulseClass = pulse ? 'pulse' : '';

  return `
    <div class="stat-widget card" style="padding: 1.5rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div class="icon-with-gradient ${pulseClass}" style="background: ${color};">
          ${icon}
        </div>
        <div style="flex: 1;">
          <div class="stat-number" data-target="${value}" data-format="${format}" data-start="0">0</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
    </div>
  `;
}

// Export default object with all functions
export default {
  animateNumber,
  initCountUp,
  animatePercentage,
  animateCurrency,
  animateProgressBar,
  animateCircularProgress,
  createStatWidget,
  easeOutCubic,
};
