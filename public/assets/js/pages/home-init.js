/**
 * Homepage initialization script
 * Handles featured packages, stats counters, notifications, and interactive elements
 */

// Set page identifier
window.__EF_PAGE__ = 'home';

// Initialize homepage components on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize category grid
  if (typeof CategoryGrid !== 'undefined') {
    const categoryGrid = new CategoryGrid('category-grid-home');
    categoryGrid.loadCategories();
  }

  // Load featured packages
  fetch('/api/packages/featured')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('featured-packages');
      if (!container) return;

      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<p class="small">No featured packages available yet.</p>';
        return;
      }

      const carousel = new Carousel('featured-packages', {
        itemsPerView: 3,
        itemsPerViewTablet: 2,
        itemsPerViewMobile: 1,
        autoScroll: true,
        autoScrollInterval: 5000,
      });
      carousel.setItems(data.items);
    })
    .catch(() => {
      /* Ignore errors */
    });

  // Show notification bell for logged-in users
  const user = localStorage.getItem('user');
  if (user) {
    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
      notificationBell.style.display = 'block';
    }

    // Initialize WebSocket connection for real-time notifications
    if (typeof WebSocketClient !== 'undefined') {
      const wsClient = new WebSocketClient({
        onNotification: notification => {
          // Update notification badge
          const badge = document.querySelector('.notification-badge');
          if (badge) {
            badge.style.display = 'block';
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
          }
        },
      });
    }
  }

  // Animate stat counters when they come into view (only if Counter and IntersectionObserver are available)
  if (typeof Counter === 'function' && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !entry.target.dataset.counted) {
            const target = parseInt(entry.target.dataset.counter);
            if (target > 0) {
              entry.target.dataset.counted = 'true';
              const counter = new Counter(entry.target, {
                target: target,
                duration: 2000,
                suffix: entry.target.dataset.suffix || '',
              });
              counter.animate();
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll('[data-counter]').forEach(el => {
      observer.observe(el);
    });
  }

  // Add ripple effect to CTA buttons (only if createRipple is available)
  if (typeof createRipple === 'function') {
    document.querySelectorAll('.cta').forEach(button => {
      if (!button.classList.contains('ripple-container')) {
        button.addEventListener('click', createRipple);
      }
    });
  }
});
