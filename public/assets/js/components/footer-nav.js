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
          <a href="/blog.html" class="footer-nav-link">Guides</a>
          <a href="/dashboard.html" class="footer-nav-link footer-nav-dashboard" style="display: none">Dashboard</a>
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

    // Listen for auth state changes to update footer nav
    window.addEventListener('auth-state-changed', event => {
      updateFooterAuthState(event.detail.user);
    });

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

    // Listen for auth state changes from auth-nav.js
    window.addEventListener('auth-state-changed', () => {
      // Delay slightly to allow auth-nav.js to update DOM first
      setTimeout(updateFooterBell, 50);
    });

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

    const trySetupSync = () => {
      const topBurger = document.getElementById('burger');

      // Only set up sync if top burger exists and is initialized by auth-nav.js
      if (topBurger && topBurger.dataset.navInitialized === 'true') {
        setupBurgerSync(topBurger, footerBurger);
        return true;
      }
      return false;
    };

    // Try immediately
    if (!trySetupSync()) {
      // Try again after a short delay to allow auth-nav.js to initialize
      setTimeout(() => {
        if (!trySetupSync()) {
          // Try one more time with longer delay
          setTimeout(() => {
            if (!trySetupSync()) {
              // Still no top burger - make footer burger work independently
              footerBurger.addEventListener('click', () => {
                const navMenu = document.querySelector('.nav-menu');
                const isCurrentlyOpen = document.body.classList.contains('nav-open');

                if (navMenu) {
                  // Use nav-menu--open to maintain consistency with auth-nav.js
                  navMenu.classList.toggle('nav-menu--open');
                  // Add/remove direction class for bottom animation
                  if (!isCurrentlyOpen) {
                    navMenu.classList.add('nav-menu--from-bottom');
                    navMenu.classList.remove('nav-menu--from-top');
                  } else {
                    navMenu.classList.remove('nav-menu--from-bottom', 'nav-menu--from-top');
                  }
                }
                document.body.classList.toggle('nav-open');
                footerBurger.setAttribute('aria-expanded', String(!isCurrentlyOpen));
                footerBurger.classList.toggle('footer-nav-burger--open');

                // Prevent background scrolling when menu is open
                if (!isCurrentlyOpen) {
                  document.body.style.overflow = 'hidden';
                } else {
                  document.body.style.overflow = '';
                }
              });

              if (window.location.hostname === 'localhost') {
                console.info('[FooterNav] Footer burger set up independently');
              }
            }
          }, 500);
        }
      }, 100);
    }
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
    footerBurger.addEventListener('click', e => {
      // Prevent default and stop propagation to avoid event interference
      e.preventDefault();
      e.stopPropagation();

      // Get the nav menu to add direction class
      const navMenu = document.querySelector('.nav-menu');
      if (navMenu) {
        // Remove top direction class and add bottom direction class
        navMenu.classList.remove('nav-menu--from-top');
        navMenu.classList.add('nav-menu--from-bottom');
      }

      // Trigger click on top burger to open/close nav menu
      topBurger.click();

      // Sync state after DOM updates using requestAnimationFrame
      requestAnimationFrame(() => {
        const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
        syncFooterBurgerState(isExpanded);
      });
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

    // Calculate the threshold (height of top nav - appears when top nav scrolls out of view)
    const getScrollThreshold = () => {
      const headerHeight = topNav.offsetHeight || 80;
      // Footer nav appears only after scrolling past the entire top navbar
      // No buffer needed - should appear as soon as top nav is scrolled past
      const threshold = headerHeight;

      if (window.location.hostname === 'localhost') {
        console.info('[FooterNav] Threshold calculated:', {
          headerHeight,
          threshold,
        });
      }

      return threshold;
    };

    let ticking = false;
    let threshold = getScrollThreshold();

    // Update threshold on resize
    const handleResize = () => {
      threshold = getScrollThreshold();
    };

    // Scroll handler with requestAnimationFrame for better performance
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

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

  // Update footer nav auth state based on user
  function updateFooterAuthState(user) {
    const footerAuth = document.querySelector('.footer-nav-auth');
    const footerDashboard = document.querySelector('.footer-nav-dashboard');
    const footerBell = document.getElementById('footer-notification-bell');

    if (!footerAuth) {
      return;
    }

    /**
     * Safely replace an element to remove all event listeners
     * @param {HTMLElement} element - The element to replace
     * @returns {HTMLElement} The new cloned element with no event listeners
     *
     * This function clones the element and replaces it in the DOM, effectively
     * removing all attached event listeners. This is useful for cleanup when
     * we need to attach new event listeners without accumulating old ones.
     */
    const replaceElementAndCleanup = element => {
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      return newElement;
    };

    if (user) {
      // Logged in state
      const dashHref =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';

      const newFooterAuth = replaceElementAndCleanup(footerAuth);
      newFooterAuth.textContent = 'Log out';
      newFooterAuth.href = '#';

      // Add logout handler - dispatch event instead of programmatically clicking
      newFooterAuth.addEventListener('click', async e => {
        e.preventDefault();
        // Dispatch custom logout event for auth-nav.js to handle
        window.dispatchEvent(new CustomEvent('logout-requested'));
      });

      if (footerDashboard) {
        footerDashboard.style.display = '';
        footerDashboard.href = dashHref;
      }

      if (footerBell) {
        footerBell.style.display = 'flex';
      }
    } else {
      // Logged out state
      const newFooterAuth = replaceElementAndCleanup(footerAuth);
      newFooterAuth.textContent = 'Log in';
      newFooterAuth.href = '/auth.html';

      if (footerDashboard) {
        footerDashboard.style.display = 'none';
      }

      if (footerBell) {
        footerBell.style.display = 'none';
      }
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
