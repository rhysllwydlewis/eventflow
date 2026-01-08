/**
 * EventFlow Footer Navigation Component
 * Fixed footer bar with quick navigation links
 * Shows/hides based on scroll position (visible when scrolled past top nav)
 */

(function () {
  'use strict';

  // Create and inject footer navigation HTML
  function createFooterNav() {
    // Check if footer nav already exists
    if (document.querySelector('.footer-nav')) {
      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] Already exists, skipping initialization');
      }
      return;
    }

    const footerNav = document.createElement('div');
    footerNav.className = 'footer-nav footer-nav--hidden';
    footerNav.setAttribute('role', 'navigation');
    footerNav.setAttribute('aria-label', 'Quick navigation');
    footerNav.innerHTML = `
      <div class="footer-nav-content">
        <div class="footer-nav-links">
          <a href="/start.html" class="footer-nav-link">Plan</a>
          <a href="/suppliers.html" class="footer-nav-link">Suppliers</a>
          <a href="/pricing.html" class="footer-nav-link">Pricing</a>
          <a href="/blog.html" class="footer-nav-link">Blog</a>
          <button
            id="footer-notification-bell"
            class="footer-nav-icon-button"
            type="button"
            aria-label="Notifications"
            style="display: none"
          >
            <span class="notification-icon">🔔</span>
            <span class="footer-notification-badge" style="display: none">0</span>
          </button>
          <a href="/auth.html" class="footer-nav-link footer-nav-auth">Log in</a>
          <button
            id="footer-burger"
            class="footer-nav-burger"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded="false"
          >
            <span class="footer-nav-burger-bar"></span>
            <span class="footer-nav-burger-bar"></span>
            <span class="footer-nav-burger-bar"></span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(footerNav);

    // Add body padding class
    document.body.classList.add('has-footer-nav');

    // Sync notification bell visibility with top nav
    syncNotificationBell();

    // Initialize footer burger button
    initFooterBurger();

    if (window.location.hostname === 'localhost') {
      console.info('[FooterNav] Component created and injected');
    }

    // Initialize scroll behavior after a short delay to ensure DOM is ready
    setTimeout(() => {
      initScrollBehavior(footerNav);
    }, 100);
  }

  // Sync footer notification bell with top notification bell
  function syncNotificationBell() {
    const topBell = document.getElementById('notification-bell');
    const footerBell = document.getElementById('footer-notification-bell');

    if (!footerBell) {
      return;
    }

    // Cache DOM elements
    const topBadge = document.querySelector('.notification-badge');
    const footerBadge = document.querySelector('.footer-notification-badge');

    // Function to update footer bell visibility based on top bell
    const updateFooterBell = () => {
      if (topBell && topBell.style.display !== 'none') {
        footerBell.style.display = 'flex';

        // Sync badge count
        if (topBadge && footerBadge) {
          footerBadge.style.display = topBadge.style.display;
          footerBadge.textContent = topBadge.textContent;
        }
      } else {
        footerBell.style.display = 'none';
      }
    };

    // Initial sync
    updateFooterBell();

    // Debounce helper to prevent excessive callback executions
    let debounceTimer;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateFooterBell, 10);
    };

    // Watch for changes to top bell visibility (for login/logout)
    if (topBell) {
      const bellObserver = new MutationObserver(debouncedUpdate);
      bellObserver.observe(topBell, {
        attributes: true,
        attributeFilter: ['style'],
      });

      // Watch for badge changes with separate observer
      if (topBadge) {
        const badgeObserver = new MutationObserver(debouncedUpdate);
        badgeObserver.observe(topBadge, {
          attributes: true,
          attributeFilter: ['style'],
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    }

    // Add click handler to footer bell
    footerBell.addEventListener('click', () => {
      // Redirect to notifications page or trigger same action as top bell
      window.location.href = '/dashboard.html#notifications';
    });
  }

  // Sync footer burger button with top burger button
  function initFooterBurger() {
    const footerBurger = document.getElementById('footer-burger');

    if (!footerBurger) {
      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] Footer burger not found');
      }
      return;
    }

    // Wait for top burger to be initialized by auth-nav.js
    const waitForBurger = () => {
      const topBurger = document.getElementById('burger');
      
      if (!topBurger) {
        if (window.location.hostname === 'localhost') {
          console.info('[FooterNav] Top burger not found, skipping sync');
        }
        return;
      }

      // Check if burger has been initialized by auth-nav.js
      if (topBurger.dataset.navInitialized !== 'true') {
        // Retry after a short delay
        setTimeout(waitForBurger, 50);
        return;
      }

      // Now burger is initialized, set up sync
      setupBurgerSync(topBurger, footerBurger);
    };

    // Start waiting for burger initialization
    waitForBurger();
  }

  // Set up synchronization between top and footer burgers
  function setupBurgerSync(topBurger, footerBurger) {
    // Shared function to sync footer burger state
    const syncFooterBurgerState = isExpanded => {
      footerBurger.setAttribute('aria-expanded', String(isExpanded));

      if (isExpanded) {
        footerBurger.classList.add('footer-nav-burger--open');
      } else {
        footerBurger.classList.remove('footer-nav-burger--open');
      }
    };

    // Make footer burger trigger the same nav menu as top burger
    footerBurger.addEventListener('click', () => {
      // Trigger click on top burger to open/close nav menu
      topBurger.click();

      // Sync state after brief delay to allow top burger to update
      setTimeout(() => {
        const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
        syncFooterBurgerState(isExpanded);
      }, 50);
    });

    // Watch for changes to top burger state to sync footer burger
    const observer = new MutationObserver(() => {
      const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
      syncFooterBurgerState(isExpanded);
    });

    observer.observe(topBurger, {
      attributes: true,
      attributeFilter: ['aria-expanded'],
    });

    // Also watch for body.nav-open class changes
    const bodyObserver = new MutationObserver(() => {
      const isOpen = document.body.classList.contains('nav-open');
      syncFooterBurgerState(isOpen);
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Initial sync
    const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
    syncFooterBurgerState(isExpanded);

    if (window.location.hostname === 'localhost') {
      console.info('[FooterNav] Burger sync initialized');
    }
  }

  // Initialize scroll-based show/hide behavior
  function initScrollBehavior(footerNav) {
    // Get the top navigation element
    const topNav = document.querySelector('.header');
    if (!topNav) {
      // If no top nav found, keep footer nav hidden by default
      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] No .header element found, keeping nav hidden');
      }
      return;
    }

    // Calculate the threshold (height of top nav + buffer for hero section)
    const getScrollThreshold = () => {
      const headerHeight = topNav.offsetHeight || 80;
      // Add a meaningful buffer (100px) so nav only appears after scrolling past hero
      const buffer = 100;
      const threshold = headerHeight + buffer;

      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] Threshold calculated:', {
          headerHeight,
          buffer,
          threshold,
        });
      }

      return threshold;
    };

    let ticking = false;
    let threshold = getScrollThreshold();
    let lastScrollY = window.scrollY;

    // Update threshold on resize
    const handleResize = () => {
      threshold = getScrollThreshold();
    };

    // Scroll handler with requestAnimationFrame for better performance
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          lastScrollY = currentScrollY;

          // Show footer nav when scrolled past the threshold
          if (currentScrollY > threshold) {
            footerNav.classList.remove('footer-nav--hidden');
            footerNav.classList.add('footer-nav--visible');
          } else {
            // Hide footer nav when at top of page
            footerNav.classList.remove('footer-nav--visible');
            footerNav.classList.add('footer-nav--hidden');
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    // Add event listeners with passive flag for better performance
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check on page load - ensure correct state is set immediately
    // Use setTimeout to ensure DOM is fully settled
    setTimeout(() => {
      handleScroll();

      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] Initialized with scroll position:', window.scrollY);
      }
    }, 50);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
