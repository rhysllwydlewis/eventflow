/**
 * P3 Features Utilities
 * Helper functions for P3 priority features
 */

/**
 * P3-02: Check if supplier is new (created in last 14 days)
 * @param {string} createdAt - ISO date string
 * @returns {boolean}
 */
function isNewSupplier(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const daysDiff = (now - created) / (1000 * 60 * 60 * 24);
  return daysDiff <= 14;
}

/**
 * P3-02: Add "New" badge to supplier card
 * @param {HTMLElement} cardElement
 * @param {string} createdAt
 */
function addNewBadgeIfApplicable(cardElement, createdAt) {
  if (isNewSupplier(createdAt)) {
    const badge = document.createElement('span');
    badge.className = 'new-badge';
    badge.innerHTML = '🆕 New';
    badge.setAttribute('aria-label', 'New supplier');
    
    // Find appropriate place to insert (after title or at top of card)
    const title = cardElement.querySelector('h3, h2, .supplier-name');
    if (title) {
      title.insertAdjacentElement('afterend', badge);
    } else {
      cardElement.insertAdjacentElement('afterbegin', badge);
    }
  }
}

/**
 * P3-03: Render breadcrumb navigation
 * @param {Array<{label: string, url: string}>} items
 * @param {string} containerId - ID of container element
 */
function renderBreadcrumbs(items, containerId = 'breadcrumb-container') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  nav.className = 'breadcrumb-nav';

  const ol = document.createElement('ol');
  ol.className = 'breadcrumb-list';

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'breadcrumb-item';

    if (index === items.length - 1) {
      // Last item - current page
      li.setAttribute('aria-current', 'page');
      li.textContent = item.label;
    } else {
      const a = document.createElement('a');
      a.href = item.url;
      a.textContent = item.label;
      li.appendChild(a);
    }

    ol.appendChild(li);
  });

  nav.appendChild(ol);
  container.innerHTML = '';
  container.appendChild(nav);
}

/**
 * P3-10: Calculate reading time estimate
 * @param {string} content - Article text content
 * @param {number} wordsPerMinute - Average reading speed (default 200)
 * @returns {number} Estimated minutes
 */
function calculateReadingTime(content, wordsPerMinute = 200) {
  if (!content) return 0;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes;
}

/**
 * P3-10: Display reading time estimate
 * @param {string} content - Article content
 * @param {string} containerId - ID of container element
 */
function displayReadingTime(content, containerId = 'reading-time') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const minutes = calculateReadingTime(content);
  container.textContent = `${minutes} min read`;
  container.setAttribute('aria-label', `Estimated reading time: ${minutes} minutes`);
}

/**
 * P3-12: Trigger success confetti animation
 * Requires canvas-confetti library to be loaded
 */
function triggerSuccessConfetti() {
  if (typeof confetti === 'undefined') {
    console.warn('canvas-confetti library not loaded');
    return;
  }

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#13B6A2', '#0B8073', '#FFD700', '#FF6B6B'],
    disableForReducedMotion: true,
  });
}

/**
 * P3-13: Toggle password visibility
 * @param {HTMLInputElement} passwordInput
 * @param {HTMLElement} toggleButton
 */
function setupPasswordToggle(passwordInput, toggleButton) {
  if (!passwordInput || !toggleButton) return;

  toggleButton.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    
    // Update button icon/text
    const icon = toggleButton.querySelector('i, .icon');
    if (icon) {
      icon.className = isPassword ? 'icon-eye-slash' : 'icon-eye';
    }
    
    // Update aria-label
    toggleButton.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password'
    );
  });
}

/**
 * P3-01: Show loading skeleton
 * @param {string} containerId
 * @param {string} type - 'supplier-card', 'package-card', 'list-item'
 * @param {number} count - Number of skeleton items
 */
function showLoadingSkeleton(containerId, type = 'supplier-card', count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  
  for (let i = 0; i < count; i++) {
    const skeleton = createSkeletonElement(type);
    container.appendChild(skeleton);
  }
}

/**
 * Create skeleton element based on type
 */
function createSkeletonElement(type) {
  const div = document.createElement('div');
  
  if (type === 'supplier-card') {
    div.className = 'skeleton-supplier-card-full';
    div.innerHTML = `
      <div class="skeleton-supplier-header">
        <div class="skeleton skeleton-avatar-large"></div>
        <div style="flex: 1;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text skeleton-text-short"></div>
        </div>
      </div>
      <div class="skeleton skeleton-text skeleton-text-medium"></div>
      <div class="skeleton skeleton-text skeleton-text-long"></div>
      <div class="skeleton-supplier-meta">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
    `;
  } else if (type === 'package-card') {
    div.className = 'skeleton-card';
    div.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text skeleton-text-medium"></div>
      <div class="skeleton skeleton-text skeleton-text-short"></div>
    `;
  } else if (type === 'list-item') {
    div.className = 'skeleton-list-item';
    div.innerHTML = `
      <div class="skeleton skeleton-avatar"></div>
      <div style="flex: 1;">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text skeleton-text-short"></div>
      </div>
    `;
  }
  
  return div;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isNewSupplier,
    addNewBadgeIfApplicable,
    renderBreadcrumbs,
    calculateReadingTime,
    displayReadingTime,
    triggerSuccessConfetti,
    setupPasswordToggle,
    showLoadingSkeleton,
    createSkeletonElement,
  };
}
