/**
 * Integration tests for auth state fixes
 * Tests cache headers, logout functionality, and role-based access guards
 */

const fs = require('fs');
const path = require('path');

describe('Auth State Fixes', () => {
  // Cache file contents to avoid repeated reads
  let authRoutesContent;
  let authMiddlewareContent;
  let dashboardGuardContent;
  let authNavContent;

  beforeAll(() => {
    authRoutesContent = fs.readFileSync(
      path.join(__dirname, '../../routes/auth.js'),
      'utf8'
    );
    authMiddlewareContent = fs.readFileSync(
      path.join(__dirname, '../../middleware/auth.js'),
      'utf8'
    );
    dashboardGuardContent = fs.readFileSync(
      path.join(__dirname, '../../public/assets/js/dashboard-guard.js'),
      'utf8'
    );
    authNavContent = fs.readFileSync(
      path.join(__dirname, '../../public/assets/js/auth-nav.js'),
      'utf8'
    );
  });

  describe('Backend - Cache Headers in routes/auth.js', () => {
    it('should set no-store cache headers on /api/auth/me endpoint', () => {
      // Find the /me endpoint
      const meEndpoint = authRoutesContent.match(/router\.get\('\/me'[\s\S]*?\}\);/);
      expect(meEndpoint).toBeTruthy();

      // Verify cache control headers are set
      expect(meEndpoint[0]).toContain("res.setHeader('Cache-Control'");
      expect(meEndpoint[0]).toContain('no-store');
      expect(meEndpoint[0]).toContain('no-cache');
      expect(meEndpoint[0]).toContain('must-revalidate');
      expect(meEndpoint[0]).toContain('private');
    });

    it('should set Pragma: no-cache header on /api/auth/me endpoint', () => {
      const meEndpoint = authRoutesContent.match(/router\.get\('\/me'[\s\S]*?\}\);/);
      expect(meEndpoint).toBeTruthy();
      expect(meEndpoint[0]).toContain("res.setHeader('Pragma', 'no-cache')");
    });

    it('should set Vary: Cookie header on /api/auth/me endpoint', () => {
      const meEndpoint = authRoutesContent.match(/router\.get\('\/me'[\s\S]*?\}\);/);
      expect(meEndpoint).toBeTruthy();
      expect(meEndpoint[0]).toContain("res.setHeader('Vary', 'Cookie')");
    });

    it('should set cache headers on POST /api/auth/logout endpoint', () => {
      // Find the POST logout endpoint
      const logoutEndpoint = authRoutesContent.match(/router\.post\('\/logout'[\s\S]*?\}\);/);
      expect(logoutEndpoint).toBeTruthy();
      expect(logoutEndpoint[0]).toContain("res.setHeader('Cache-Control'");
      expect(logoutEndpoint[0]).toContain('no-store');
    });
  });

  describe('Backend - Cookie Clearing in middleware/auth.js', () => {
    it('should clear cookie with proper options', () => {
      // Find clearAuthCookie function
      expect(authMiddlewareContent).toContain('function clearAuthCookie');
      expect(authMiddlewareContent).toContain("res.clearCookie('token'");

      // Verify it sets options for proper clearing
      const clearFunction = authMiddlewareContent.match(
        /function clearAuthCookie[\s\S]*?^}/m
      );
      expect(clearFunction).toBeTruthy();
      expect(clearFunction[0]).toContain('httpOnly');
      expect(clearFunction[0]).toContain('sameSite');
      expect(clearFunction[0]).toContain('secure');
      expect(clearFunction[0]).toContain("path: '/'");
    });
  });

  describe('Frontend - Dashboard Guard', () => {
    it('dashboard-guard.js file should exist', () => {
      const guardPath = path.join(__dirname, '../../public/assets/js/dashboard-guard.js');
      expect(fs.existsSync(guardPath)).toBe(true);
    });

    it('dashboard-guard.js should define role requirements for each dashboard', () => {
      // Check for role requirements mapping
      expect(dashboardGuardContent).toContain('dashboardRoles');
      expect(dashboardGuardContent).toContain("'/dashboard-supplier.html'");
      expect(dashboardGuardContent).toContain("'/dashboard-customer.html'");
      expect(dashboardGuardContent).toContain("'/admin.html'");
      expect(dashboardGuardContent).toContain("'supplier'");
      expect(dashboardGuardContent).toContain("'customer'");
      expect(dashboardGuardContent).toContain("'admin'");
    });

    it('dashboard-guard.js should hide body initially to prevent flash', () => {
      expect(dashboardGuardContent).toContain("document.body.style.visibility = 'hidden'");
      expect(dashboardGuardContent).toContain("document.body.style.opacity = '0'");
    });

    it('dashboard-guard.js should fetch user with cache-busting', () => {
      expect(dashboardGuardContent).toContain('/api/auth/me');
      expect(dashboardGuardContent).toContain('Date.now()');
      expect(dashboardGuardContent).toContain('Cache-Control');
      expect(dashboardGuardContent).toContain('no-cache');
    });

    it('dashboard-guard.js should redirect on role mismatch', () => {
      expect(dashboardGuardContent).toContain('user.role !== requiredRole');
      expect(dashboardGuardContent).toContain('window.location.replace');
      expect(dashboardGuardContent).toContain('correctDashboard');
    });

    it('dashboard-guard.js should show page when access is granted', () => {
      expect(dashboardGuardContent).toContain("document.body.style.visibility = 'visible'");
      expect(dashboardGuardContent).toContain("document.body.style.opacity = '1'");
    });
  });

  describe('Frontend - Dashboard HTML Files Include Guard', () => {
    it('dashboard-supplier.html should include dashboard-guard.js', () => {
      const filePath = path.join(__dirname, '../../public/dashboard-supplier.html');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('dashboard-guard.js');
    });

    it('dashboard-customer.html should include dashboard-guard.js', () => {
      const filePath = path.join(__dirname, '../../public/dashboard-customer.html');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('dashboard-guard.js');
    });

    it('admin.html should include dashboard-guard.js', () => {
      const filePath = path.join(__dirname, '../../public/admin.html');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('dashboard-guard.js');
    });

    it('all admin-*.html files should include dashboard-guard.js', () => {
      const publicDir = path.join(__dirname, '../../public');
      const adminFiles = fs
        .readdirSync(publicDir)
        .filter(file => file.startsWith('admin-') && file.endsWith('.html'));

      expect(adminFiles.length).toBeGreaterThan(0);

      adminFiles.forEach(file => {
        const filePath = path.join(publicDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toContain('dashboard-guard.js');
      });
    });
  });

  describe('Frontend - Auth Nav Logout Handler', () => {
    it('auth-nav.js should define handleLogout function', () => {
      expect(authNavContent).toContain('async function handleLogout');
      expect(authNavContent).toContain('/api/auth/logout');
    });

    it('auth-nav.js should prevent duplicate event handlers using cloneNode', () => {
      // Check for cloneNode pattern to prevent duplicate handlers
      expect(authNavContent).toContain('cloneNode(true)');
      expect(authNavContent).toContain('replaceChild');
    });

    it('auth-nav.js should include cache-busting on logout redirect', () => {
      // Check for cache-busting with timestamp
      expect(authNavContent).toContain('Date.now()');
      expect(authNavContent).toContain('window.location.href');
    });

    it('auth-nav.js should use CSRF token in logout request', () => {
      const logoutFunction = authNavContent.match(/async function handleLogout[\s\S]*?^\s*}/m);
      expect(logoutFunction).toBeTruthy();
      expect(logoutFunction[0]).toContain('X-CSRF-Token');
      expect(logoutFunction[0]).toContain('window.__CSRF_TOKEN__');
    });
  });
});
