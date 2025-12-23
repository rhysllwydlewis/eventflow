/**
 * Admin Navbar JavaScript
 * Handles navigation functionality, mobile menu, and database status
 */

(function () {
  'use strict';

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initMobileMenu();
    initUserDropdown();
    initDatabaseStatus();
    highlightActivePage();
    initBadgeCounts();
  }

  /**
   * Mobile hamburger menu toggle
   */
  function initMobileMenu() {
    const hamburger = document.getElementById('adminHamburger');
    const nav = document.getElementById('adminNavbarNav');

    if (hamburger && nav) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        nav.classList.toggle('show');
      });

      // Close menu when clicking outside
      document.addEventListener('click', e => {
        if (
          !hamburger.contains(e.target) &&
          !nav.contains(e.target) &&
          nav.classList.contains('show')
        ) {
          hamburger.classList.remove('active');
          nav.classList.remove('show');
        }
      });

      // Close menu when clicking a link (on mobile)
      const navLinks = nav.querySelectorAll('.admin-nav-btn');
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            hamburger.classList.remove('active');
            nav.classList.remove('show');
          }
        });
      });
    }
  }

  /**
   * User dropdown menu toggle
   */
  function initUserDropdown() {
    const userBtn = document.getElementById('adminUserBtn');
    const dropdownMenu = document.getElementById('adminDropdownMenu');

    if (userBtn && dropdownMenu) {
      userBtn.addEventListener('click', e => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', e => {
        if (!userBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
          dropdownMenu.classList.remove('show');
        }
      });
    }
  }

  /**
   * Fetch and display database status
   */
  function initDatabaseStatus() {
    const statusBadge = document.getElementById('dbStatusBadge');
    if (!statusBadge) {
      return;
    }

    updateDatabaseStatus();

    // Refresh status every 30 seconds
    setInterval(updateDatabaseStatus, 30000);
  }

  function updateDatabaseStatus() {
    const statusBadge = document.getElementById('dbStatusBadge');
    if (!statusBadge) {
      return;
    }

    // Try to fetch database status from API
    fetch('/api/admin/db-status', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }
        return response.json();
      })
      .then(data => {
        const dbType = data.dbType || 'unknown';
        const dot = '<span class="db-status-dot"></span>';

        if (dbType === 'mongodb') {
          statusBadge.className = 'db-status-badge db-mongodb';
          statusBadge.innerHTML = `${dot} MongoDB`;
          statusBadge.title = 'Connected to MongoDB';
        } else if (dbType === 'local') {
          statusBadge.className = 'db-status-badge db-local';
          statusBadge.innerHTML = `${dot} Local Storage`;
          statusBadge.title = 'Using local file storage';
        } else {
          statusBadge.className = 'db-status-badge db-loading';
          statusBadge.innerHTML = `${dot} Unknown`;
          statusBadge.title = 'Database status unknown';
        }
      })
      .catch(error => {
        console.error('Failed to fetch database status:', error);
        statusBadge.className = 'db-status-badge db-local';
        statusBadge.innerHTML = '<span class="db-status-dot"></span> Local Storage';
        statusBadge.title = 'Using local file storage';
      });
  }

  /**
   * Highlight the active page in navigation
   */
  function highlightActivePage() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.admin-nav-btn');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && currentPath.includes(href.replace('/', ''))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /**
   * Initialize and update badge counts
   */
  function initBadgeCounts() {
    // Update badge counts from API
    updateBadgeCounts();

    // Refresh counts every 60 seconds
    setInterval(updateBadgeCounts, 60000);
  }

  function updateBadgeCounts() {
    // Fetch metrics to get counts
    fetch('/api/admin/metrics', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }
        return response.json();
      })
      .then(data => {
        // Update badge counts if elements exist
        const counts = data.counts || {};

        // Users badge
        const usersBadge = document.getElementById('navBadgeUsers');
        if (usersBadge && counts.usersTotal > 0) {
          usersBadge.textContent = counts.usersTotal;
          usersBadge.style.display = 'flex';
        }

        // Packages badge
        const packagesBadge = document.getElementById('navBadgePackages');
        if (packagesBadge && counts.packagesTotal > 0) {
          packagesBadge.textContent = counts.packagesTotal;
          packagesBadge.style.display = 'flex';
        }
      })
      .catch(error => {
        console.error('Failed to fetch badge counts:', error);
      });
  }

  /**
   * Refresh button handler
   */
  const refreshBtn = document.getElementById('navRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Add spin animation
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
      }, 600);

      // Refresh data
      updateDatabaseStatus();
      updateBadgeCounts();

      // Trigger page refresh if there's a refresh function
      if (typeof window.refreshDashboardData === 'function') {
        window.refreshDashboardData();
      }
    });
  }

  /**
   * Logout handler
   */
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Are you sure you want to sign out?')) {
        window.location.href = '/api/auth/logout';
      }
    });
  }
})();
