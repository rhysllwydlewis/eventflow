/**
 * Dashboard Guard
 * Enforces role-based access control on dashboard pages
 * Prevents users from accessing dashboards they don't have permission for
 */

(async function () {
  'use strict';

  // Get current page
  const currentPath = window.location.pathname;

  // Role requirements for each dashboard type
  const dashboardRoles = {
    '/dashboard-supplier.html': 'supplier',
    '/dashboard-customer.html': 'customer',
    // Admin pages - all admin*.html files require admin role
    '/admin.html': 'admin',
    '/admin-audit.html': 'admin',
    '/admin-content.html': 'admin',
    '/admin-homepage.html': 'admin',
    '/admin-marketplace.html': 'admin',
    '/admin-packages.html': 'admin',
    '/admin-payments.html': 'admin',
    '/admin-pexels.html': 'admin',
    '/admin-photos.html': 'admin',
    '/admin-reports.html': 'admin',
    '/admin-settings.html': 'admin',
    '/admin-supplier-detail.html': 'admin',
    '/admin-suppliers.html': 'admin',
    '/admin-tickets.html': 'admin',
    '/admin-user-detail.html': 'admin',
    '/admin-users.html': 'admin',
  };

  // Check if current page requires role check
  const requiredRole = dashboardRoles[currentPath];
  if (!requiredRole) {
    // Not a protected dashboard page
    return;
  }

  // Inject style tag to hide body initially (works even in <head> before body exists)
  // This prevents flash of wrong content without causing errors
  const styleId = 'dashboard-guard-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = 'body { visibility: hidden !important; opacity: 0 !important; }';
    document.head.appendChild(style);
  }

  // Helper function to show the page (removes the hiding style)
  function showPage() {
    const style = document.getElementById(styleId);
    if (style) {
      style.remove();
    }
  }

  try {
    // Fetch current user with cache-busting
    // Using timestamp + random value for better cache-busting
    const cacheBuster = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const response = await fetch(`/api/auth/me?t=${cacheBuster}`, {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (!response.ok) {
      // Failed to check auth - redirect to login
      window.location.replace(`/auth.html?return=${encodeURIComponent(currentPath)}`);
      return;
    }

    const data = await response.json();
    const user = data.user || data; // Support both wrapped and unwrapped formats

    if (!user || !user.id) {
      // Not authenticated - redirect to login
      window.location.replace(`/auth.html?return=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check role match
    if (user.role !== requiredRole) {
      // Role mismatch - redirect to correct dashboard for user's role
      let correctDashboard;
      if (user.role === 'admin') {
        correctDashboard = '/admin.html';
      } else if (user.role === 'supplier') {
        correctDashboard = '/dashboard-supplier.html';
      } else if (user.role === 'customer') {
        correctDashboard = '/dashboard-customer.html';
      } else {
        // Unknown role - redirect to home
        correctDashboard = '/';
      }

      // Only redirect if not already on the correct page
      if (currentPath !== correctDashboard) {
        console.warn(
          `Role mismatch: user has role '${user.role}' but page requires '${requiredRole}'. Redirecting to ${correctDashboard}`
        );
        window.location.replace(correctDashboard);
        return;
      }
    }

    // Access granted - show the page
    showPage();
  } catch (error) {
    console.error('Dashboard guard error:', error);
    // On error, redirect to login to be safe (fail closed)
    window.location.replace(`/auth.html?return=${encodeURIComponent(currentPath)}`);
  }
})();
