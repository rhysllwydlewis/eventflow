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
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }
      return data;
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Request failed with status ${response.status}`);
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
      toggle.addEventListener('click', (e) => {
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

  // Initialize admin page
  function init() {
    fetchCSRFToken();
    highlightActivePage();
    initSidebarToggle();
    loadBadgeCounts();

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
    confirm,
    loadBadgeCounts,
    highlightActivePage,
    initSidebarToggle,
    generateId,
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
