/**
 * Shared utilities for EventFlow Admin Panel
 * Used across all admin pages for consistency
 */

const AdminShared = (function () {
  'use strict';

  // HTML escaping to prevent XSS
  function escapeHtml(unsafe) {
    if (!unsafe) {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = String(unsafe);
    return div.innerHTML;
  }

  // Format dates consistently
  function formatDate(dateStr) {
    if (!dateStr) {
      return 'Never';
    }
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  }

  // Format timestamps for relative time
  function formatTimestamp(timestamp) {
    if (!timestamp) {
      return 'Unknown';
    }
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('en-GB');
    } else if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  // API wrapper with CSRF token support
  async function api(url, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
      if (window.__CSRF_TOKEN__) {
        opts.headers['X-CSRF-Token'] = window.__CSRF_TOKEN__;
      }
    }

    if (body) {
      opts.body = JSON.stringify(body);
    }

    const response = await fetch(url, opts);
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (isJson) {
      const data = await response.json();
      if (!response.ok) {
        // Provide more specific error messages for common HTTP codes
        let errorMessage = data.error || `Request failed with status ${response.status}`;

        if (response.status === 404) {
          errorMessage = data.error || `Resource not found: ${url}`;
        } else if (response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
          // Optionally redirect to login after a delay (with origin validation)
          setTimeout(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== '/auth.html') {
              // Validate that we're staying on the same origin
              const returnUrl = encodeURIComponent(window.location.href);
              const loginUrl = `/auth.html?redirect=${returnUrl}`;
              // Ensure the redirect is to the same origin
              if (loginUrl.startsWith('/')) {
                window.location.href = loginUrl;
              }
            }
          }, 2000);
        } else if (response.status === 403) {
          errorMessage = 'Access denied. You do not have permission to perform this action.';
        } else if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (response.status === 503) {
          errorMessage = 'Service temporarily unavailable. The database may be connecting.';
        }

        throw new Error(errorMessage);
      }
      return data;
    } else {
      const text = await response.text();
      if (!response.ok) {
        const errorMessage = text || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        return { message: text };
      }
    }
  }

  // Fetch CSRF token
  async function fetchCSRFToken() {
    try {
      const data = await fetch('/api/csrf-token', { credentials: 'include' }).then(r => r.json());
      if (data && data.csrfToken) {
        window.__CSRF_TOKEN__ = data.csrfToken;
      }
    } catch (err) {
      console.warn('Could not fetch CSRF token:', err);
    }
  }

  // Show toast notification
  function showToast(message, type = 'info') {
    // If Toast library is available, use it
    if (typeof Toast !== 'undefined') {
      Toast[type](message);
      return;
    }

    // Fallback: create simple toast
    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
    `;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Confirm dialog
  function confirm(message) {
    return window.confirm(message);
  }

  // Load badge counts for sidebar
  async function loadBadgeCounts() {
    try {
      const counts = await api('/api/admin/badge-counts');

      const elements = {
        newUsersCount: counts.newUsers || 0,
        pendingPhotosCount: counts.pendingPhotos || 0,
        openTicketsCount: counts.openTickets || 0,
      };

      for (const [id, count] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = count > 0 ? count : '';
          el.style.display = count > 0 ? 'inline-block' : 'none';
        }
      }
    } catch (err) {
      console.error('Failed to load badge counts:', err);
    }
  }

  // Highlight active page in sidebar
  function highlightActivePage() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.admin-nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.classList.add('active');
      }
    });
  }

  // Initialize sidebar toggle for mobile
  function initSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');

    if (toggle && sidebar) {
      // Restore sidebar state from localStorage on mobile only
      const savedState = localStorage.getItem('adminSidebarOpen');
      if (savedState === 'true' && window.innerWidth <= 1024) {
        sidebar.classList.add('open');
      }

      // Toggle sidebar and save state
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
        const isOpen = sidebar.classList.contains('open');
        localStorage.setItem('adminSidebarOpen', isOpen);

        // Update ARIA attribute for accessibility
        toggle.setAttribute('aria-expanded', isOpen);
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', e => {
        if (window.innerWidth <= 1024) {
          if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            if (sidebar.classList.contains('open')) {
              sidebar.classList.remove('open');
              localStorage.setItem('adminSidebarOpen', 'false');
              toggle.setAttribute('aria-expanded', 'false');
            }
          }
        }
      });

      // Handle responsive changes - ensure sidebar state is correct
      window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
          // On desktop, remove the 'open' class (sidebar is visible by default via CSS)
          if (sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
          }
        }
      });

      // Set initial ARIA state
      toggle.setAttribute('aria-expanded', sidebar.classList.contains('open'));
    }
  }

  // Generate unique ID
  function generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Format file size
  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }

  // Debounce function for search
  function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Animated counter for stat cards
  function animateCounter(element, target, duration = 1000) {
    if (!element) {
      return;
    }

    const start = 0;
    const increment = target / (duration / 16); // 60fps
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current);
      }
    }, 16);
  }

  // Enhanced Toast with action buttons
  function showEnhancedToast(message, type = 'info', options = {}) {
    const { action, actionLabel, duration = 5000 } = options;

    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ',
    };

    toast.innerHTML = `
      <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
      <div class="toast-content">
        <div class="toast-message">${escapeHtml(message)}</div>
        ${action && actionLabel ? `<button class="toast-action">${escapeHtml(actionLabel)}</button>` : ''}
      </div>
      <button class="toast-close">×</button>
    `;

    container.appendChild(toast);

    // Close button
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.remove();
      });
    }

    // Action button
    if (action && actionLabel) {
      const actionBtn = toast.querySelector('.toast-action');
      if (actionBtn) {
        actionBtn.addEventListener('click', () => {
          action();
          toast.remove();
        });
      }
    }

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  }

  // Keyboard shortcuts handler
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Ctrl/Cmd + K - Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
      }

      // Ctrl/Cmd + / - Show shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        showShortcutsHelp();
      }

      // R - Refresh current page
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        window.location.reload();
      }

      // H - Go to dashboard home
      if (e.key === 'h' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        window.location.href = '/admin.html';
      }

      // U - Go to users
      if (e.key === 'u' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        window.location.href = '/admin-users.html';
      }

      // P - Go to packages
      if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        window.location.href = '/admin-packages.html';
      }

      // S - Go to settings
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !isInputFocused()) {
        e.preventDefault();
        window.location.href = '/admin-settings.html';
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        closeModals();
      }
    });
  }

  function isInputFocused() {
    const activeElement = document.activeElement;
    return (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable)
    );
  }

  function openCommandPalette() {
    // Check if command palette exists, if not create it
    let palette = document.getElementById('commandPalette');
    if (!palette) {
      palette = createCommandPalette();
    }
    palette.style.display = 'flex';
    const searchInput = palette.querySelector('.command-search');
    if (searchInput) {
      searchInput.focus();
    }
  }

  function createCommandPalette() {
    const palette = document.createElement('div');
    palette.id = 'commandPalette';
    palette.className = 'command-palette';
    palette.innerHTML = `
      <div class="command-palette-dialog">
        <input type="text" class="command-search" placeholder="Type a command or search..." />
        <div class="command-results">
          <div class="command-group">
            <div class="command-group-title">Navigation</div>
            <button class="command-item" data-action="dashboard">
              <span class="command-icon">📊</span>
              <span class="command-label">Dashboard</span>
              <span class="command-shortcut">H</span>
            </button>
            <button class="command-item" data-action="users">
              <span class="command-icon">👥</span>
              <span class="command-label">Users</span>
              <span class="command-shortcut">U</span>
            </button>
            <button class="command-item" data-action="packages">
              <span class="command-icon">📦</span>
              <span class="command-label">Packages</span>
              <span class="command-shortcut">P</span>
            </button>
            <button class="command-item" data-action="settings">
              <span class="command-icon">⚙️</span>
              <span class="command-label">Settings</span>
              <span class="command-shortcut">S</span>
            </button>
          </div>
          <div class="command-group">
            <div class="command-group-title">Actions</div>
            <button class="command-item" data-action="refresh">
              <span class="command-icon">🔄</span>
              <span class="command-label">Refresh Page</span>
              <span class="command-shortcut">R</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(palette);

    // Handle clicks
    palette.addEventListener('click', e => {
      if (e.target === palette) {
        palette.style.display = 'none';
      }
    });

    // Handle command selection
    palette.querySelectorAll('.command-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        executeCommand(action);
        palette.style.display = 'none';
      });
    });

    return palette;
  }

  function executeCommand(action) {
    const actions = {
      dashboard: () => (window.location.href = '/admin.html'),
      users: () => (window.location.href = '/admin-users.html'),
      packages: () => (window.location.href = '/admin-packages.html'),
      settings: () => (window.location.href = '/admin-settings.html'),
      refresh: () => window.location.reload(),
    };

    if (actions[action]) {
      actions[action]();
    }
  }

  function showShortcutsHelp() {
    const helpModal = document.createElement('div');
    helpModal.className = 'modal-overlay';
    helpModal.innerHTML = `
      <div class="modal-dialog" style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">Keyboard Shortcuts</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-list">
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd></span>
              <span class="shortcut-desc">Open command palette</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>Ctrl/Cmd</kbd> + <kbd>/</kbd></span>
              <span class="shortcut-desc">Show this help</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>R</kbd></span>
              <span class="shortcut-desc">Refresh current page</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>H</kbd></span>
              <span class="shortcut-desc">Go to dashboard</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>U</kbd></span>
              <span class="shortcut-desc">Go to users</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>P</kbd></span>
              <span class="shortcut-desc">Go to packages</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>S</kbd></span>
              <span class="shortcut-desc">Go to settings</span>
            </div>
            <div class="shortcut-item">
              <span class="shortcut-keys"><kbd>Esc</kbd></span>
              <span class="shortcut-desc">Close modals</span>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(helpModal);

    helpModal.addEventListener('click', e => {
      if (e.target === helpModal) {
        helpModal.remove();
      }
    });
  }

  function closeModals() {
    // Close all modals with class 'modal-overlay'
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.style.display = 'none';
    });

    // Close command palette
    const palette = document.getElementById('commandPalette');
    if (palette) {
      palette.style.display = 'none';
    }
  }

  // Initialize admin page
  function init() {
    fetchCSRFToken();
    highlightActivePage();
    initSidebarToggle();
    loadBadgeCounts();
    initKeyboardShortcuts();

    // Refresh badge counts every 60 seconds
    setInterval(loadBadgeCounts, 60000);
  }

  // Public API
  return {
    escapeHtml,
    formatDate,
    formatTimestamp,
    formatFileSize,
    api,
    fetchCSRFToken,
    showToast,
    showEnhancedToast,
    confirm,
    loadBadgeCounts,
    highlightActivePage,
    initSidebarToggle,
    generateId,
    debounce,
    animateCounter,
    initKeyboardShortcuts,
    openCommandPalette,
    closeModals,
    init,
  };
})();

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AdminShared.init());
} else {
  AdminShared.init();
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminShared;
}
