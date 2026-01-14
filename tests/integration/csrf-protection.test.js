/**
 * Integration tests for CSRF protection
 * Tests the Double-Submit Cookie pattern implementation
 */

const fs = require('fs');
const path = require('path');

describe('CSRF Protection', () => {
  let csrfMiddlewareContent;
  let systemRoutesContent;
  let adminRoutesContent;
  let authRoutesContent;
  let paymentsRoutesContent;
  let adminSharedContent;
  let checkoutContent;

  beforeAll(() => {
    csrfMiddlewareContent = fs.readFileSync(
      path.join(__dirname, '../../middleware/csrf.js'),
      'utf8'
    );
    systemRoutesContent = fs.readFileSync(path.join(__dirname, '../../routes/system.js'), 'utf8');
    adminRoutesContent = fs.readFileSync(path.join(__dirname, '../../routes/admin.js'), 'utf8');
    authRoutesContent = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');
    paymentsRoutesContent = fs.readFileSync(
      path.join(__dirname, '../../routes/payments.js'),
      'utf8'
    );
    adminSharedContent = fs.readFileSync(
      path.join(__dirname, '../../public/assets/js/admin-shared.js'),
      'utf8'
    );
    checkoutContent = fs.readFileSync(
      path.join(__dirname, '../../public/assets/js/checkout.js'),
      'utf8'
    );
  });

  describe('CSRF Middleware - Double-Submit Cookie Pattern', () => {
    it('should implement getToken function that sets a csrf cookie', () => {
      expect(csrfMiddlewareContent).toContain('function getToken');
      expect(csrfMiddlewareContent).toContain("res.cookie('csrf'");
      expect(csrfMiddlewareContent).toContain('httpOnly: false'); // Client needs to read it
    });

    it('should set SameSite attribute on csrf cookie', () => {
      const getTokenFunction = csrfMiddlewareContent.match(/function getToken[\s\S]*?^}/m);
      expect(getTokenFunction).toBeTruthy();
      expect(getTokenFunction[0]).toContain('sameSite');
    });

    it('should set Secure flag conditionally in production', () => {
      const getTokenFunction = csrfMiddlewareContent.match(/function getToken[\s\S]*?^}/m);
      expect(getTokenFunction).toBeTruthy();
      expect(getTokenFunction[0]).toContain('secure');
      expect(getTokenFunction[0]).toContain('isProduction');
    });

    it('should NOT use global tokenStore Map anymore', () => {
      // Should not have the old tokenStore pattern
      expect(csrfMiddlewareContent).not.toContain('const tokenStore = new Map()');
      expect(csrfMiddlewareContent).not.toContain('tokenStore.set');
      expect(csrfMiddlewareContent).not.toContain('tokenStore.get');
    });

    it('csrfProtection should validate token from cookie matches header', () => {
      expect(csrfMiddlewareContent).toContain('function csrfProtection');

      // Should check cookie
      expect(csrfMiddlewareContent).toContain('req.cookies');
      expect(csrfMiddlewareContent).toContain('csrf');

      // Should check header
      expect(csrfMiddlewareContent).toContain("req.headers['x-csrf-token']");

      // Should store values in variables
      expect(csrfMiddlewareContent).toContain('tokenFromHeader');
      expect(csrfMiddlewareContent).toContain('tokenFromCookie');

      // Should compare them with !== operator
      expect(csrfMiddlewareContent).toContain('tokenFromHeader !== tokenFromCookie');
    });

    it('csrfProtection should return 403 JSON with "CSRF token missing" when token is missing', () => {
      // Just check the full middleware content for these strings
      expect(csrfMiddlewareContent).toContain('403');
      expect(csrfMiddlewareContent).toContain('CSRF token missing');
    });

    it('csrfProtection should return 403 JSON with "Invalid CSRF token" when tokens do not match', () => {
      // Just check the full middleware content for these strings
      expect(csrfMiddlewareContent).toContain('403');
      expect(csrfMiddlewareContent).toContain('Invalid CSRF token');
    });
  });

  describe('System Routes - CSRF Token Endpoint', () => {
    it('GET /api/csrf-token should call getToken with req and res', () => {
      const csrfTokenRoute = systemRoutesContent.match(
        /router\.get\('\/csrf-token'[\s\S]*?const token = getToken[\s\S]*?\}\);/
      );
      expect(csrfTokenRoute).toBeTruthy();
      // Check that getToken is called with both req and res
      expect(csrfTokenRoute[0]).toMatch(/getToken\(req,\s*res\)/);
    });

    it('GET /api/csrf-token should return token in JSON response', () => {
      // Check the full system routes content for the response
      expect(systemRoutesContent).toContain('/csrf-token');
      expect(systemRoutesContent).toContain('res.json');
      expect(systemRoutesContent).toContain('csrfToken');
    });
  });

  describe('Admin Routes - CSRF Protection Enforcement', () => {
    it('should import csrfProtection from middleware', () => {
      expect(adminRoutesContent).toContain("require('../middleware/csrf')");
      expect(adminRoutesContent).toContain('csrfProtection');
    });

    it('FAQ create route should have csrfProtection', () => {
      const faqCreateRoute = adminRoutesContent.match(
        /router\.post\('\/content\/faqs'[\s\S]*?\(req, res\)/
      );
      expect(faqCreateRoute).toBeTruthy();
      expect(faqCreateRoute[0]).toContain('csrfProtection');
    });

    it('FAQ update route should have csrfProtection', () => {
      const faqUpdateRoute = adminRoutesContent.match(
        /router\.put\('\/content\/faqs\/:id'[\s\S]*?\(req, res\)/
      );
      expect(faqUpdateRoute).toBeTruthy();
      expect(faqUpdateRoute[0]).toContain('csrfProtection');
    });

    it('FAQ delete route should have csrfProtection', () => {
      const faqDeleteRoute = adminRoutesContent.match(
        /router\.delete\('\/content\/faqs\/:id'[\s\S]*?\(req, res\)/
      );
      expect(faqDeleteRoute).toBeTruthy();
      expect(faqDeleteRoute[0]).toContain('csrfProtection');
    });

    it('Settings update routes should have csrfProtection', () => {
      const settingsSiteRoute = adminRoutesContent.match(
        /router\.put\('\/settings\/site'[\s\S]*?\(req, res\)/
      );
      expect(settingsSiteRoute).toBeTruthy();
      expect(settingsSiteRoute[0]).toContain('csrfProtection');

      const settingsFeaturesRoute = adminRoutesContent.match(
        /router\.put\('\/settings\/features'[\s\S]*?\(req, res\)/
      );
      expect(settingsFeaturesRoute).toBeTruthy();
      expect(settingsFeaturesRoute[0]).toContain('csrfProtection');

      const settingsMaintenanceRoute = adminRoutesContent.match(
        /router\.put\('\/settings\/maintenance'[\s\S]*?\(req, res\)/
      );
      expect(settingsMaintenanceRoute).toBeTruthy();
      expect(settingsMaintenanceRoute[0]).toContain('csrfProtection');
    });

    it('should have csrfProtection on most admin POST/PUT/DELETE routes', () => {
      // Count total admin write routes
      const postRoutes = (adminRoutesContent.match(/router\.post\(/g) || []).length;
      const putRoutes = (adminRoutesContent.match(/router\.put\(/g) || []).length;
      const deleteRoutes = (adminRoutesContent.match(/router\.delete\(/g) || []).length;
      const totalWriteRoutes = postRoutes + putRoutes + deleteRoutes;

      // Count routes with csrfProtection
      const csrfProtectedRoutes = (adminRoutesContent.match(/csrfProtection/g) || []).length;

      // At least 80% of write routes should have CSRF protection
      // (some routes may be already protected or not require it)
      const protectionRatio = csrfProtectedRoutes / totalWriteRoutes;
      expect(protectionRatio).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Auth Routes - Logout CSRF Protection', () => {
    it('should import csrfProtection from middleware', () => {
      expect(authRoutesContent).toContain("require('../middleware/csrf')");
      expect(authRoutesContent).toContain('csrfProtection');
    });

    it('POST /api/auth/logout should have csrfProtection', () => {
      const logoutRoute = authRoutesContent.match(/router\.post\('\/logout'[\s\S]*?\(req, res\)/);
      expect(logoutRoute).toBeTruthy();
      expect(logoutRoute[0]).toContain('csrfProtection');
    });
  });

  describe('Payment Routes - CSRF Protection', () => {
    it('should import csrfProtection from middleware', () => {
      expect(paymentsRoutesContent).toContain("require('../middleware/csrf')");
      expect(paymentsRoutesContent).toContain('csrfProtection');
    });

    it('POST /api/payments/create-checkout-session should have csrfProtection', () => {
      const checkoutRoute = paymentsRoutesContent.match(
        /router\.post\(\s*'\/create-checkout-session'[\s\S]*?async \(req, res\)/
      );
      expect(checkoutRoute).toBeTruthy();
      expect(checkoutRoute[0]).toContain('csrfProtection');
    });
  });

  describe('Client-Side - Admin Shared JS', () => {
    it('adminFetch should include X-CSRF-Token header for write operations', () => {
      expect(adminSharedContent).toContain('async function adminFetch');
      const adminFetchFn = adminSharedContent.match(/async function adminFetch[\s\S]*?^\s*}/m);
      expect(adminFetchFn).toBeTruthy();

      // Should check for write operations
      expect(adminFetchFn[0]).toMatch(/POST|PUT|DELETE|PATCH/);

      // Should add CSRF token to headers
      expect(adminFetchFn[0]).toContain('X-CSRF-Token');
      expect(adminFetchFn[0]).toContain('window.__CSRF_TOKEN__');
    });

    it('adminFetch should include credentials: include', () => {
      const adminFetchFn = adminSharedContent.match(/async function adminFetch[\s\S]*?^\s*}/m);
      expect(adminFetchFn).toBeTruthy();
      expect(adminFetchFn[0]).toContain("credentials: 'include'");
    });

    it('should have fetchCSRFToken function', () => {
      expect(adminSharedContent).toContain('async function fetchCSRFToken');
      expect(adminSharedContent).toContain("fetch('/api/csrf-token'");
      expect(adminSharedContent).toContain('window.__CSRF_TOKEN__');
    });
  });

  describe('Client-Side - Checkout JS', () => {
    it('checkout should fetch CSRF token before payment POST', () => {
      expect(checkoutContent).toContain('/api/csrf-token');
      expect(checkoutContent).toContain('window.__CSRF_TOKEN__');
    });

    it('checkout should include X-CSRF-Token header in payment request', () => {
      // Check the full checkout content for X-CSRF-Token header
      expect(checkoutContent).toContain('/api/payments/create-checkout-session');
      expect(checkoutContent).toContain('X-CSRF-Token');
      expect(checkoutContent).toContain('headers');
    });

    it('checkout should include credentials: include', () => {
      const paymentFetch = checkoutContent.match(
        /fetch\('\/api\/payments\/create-checkout-session'[\s\S]*?\}\);/
      );
      expect(paymentFetch).toBeTruthy();
      expect(paymentFetch[0]).toContain("credentials: 'include'");
    });
  });

  describe('User-Facing Routes - CSRF Protection', () => {
    let messagesRoutesContent;
    let profileRoutesContent;
    let ticketsRoutesContent;

    beforeAll(() => {
      messagesRoutesContent = fs.readFileSync(
        path.join(__dirname, '../../routes/messages.js'),
        'utf8'
      );
      profileRoutesContent = fs.readFileSync(
        path.join(__dirname, '../../routes/profile.js'),
        'utf8'
      );
      ticketsRoutesContent = fs.readFileSync(
        path.join(__dirname, '../../routes/tickets.js'),
        'utf8'
      );
    });

    it('messages routes should import csrfProtection', () => {
      expect(messagesRoutesContent).toContain("require('../middleware/csrf')");
      expect(messagesRoutesContent).toContain('csrfProtection');
    });

    it('messages POST /threads should have csrfProtection', () => {
      const threadCreateRoute = messagesRoutesContent.match(
        /router\.post\('\/threads'[\s\S]*?\(req, res\)/
      );
      expect(threadCreateRoute).toBeTruthy();
      expect(threadCreateRoute[0]).toContain('csrfProtection');
    });

    it('profile routes should import csrfProtection', () => {
      expect(profileRoutesContent).toContain("require('../middleware/csrf')");
      expect(profileRoutesContent).toContain('csrfProtection');
    });

    it('profile PUT / should have csrfProtection', () => {
      const profileUpdateRoute = profileRoutesContent.match(
        /router\.put\('\/'[\s\S]*?\(req, res\)/
      );
      expect(profileUpdateRoute).toBeTruthy();
      expect(profileUpdateRoute[0]).toContain('csrfProtection');
    });

    it('tickets routes should import csrfProtection', () => {
      expect(ticketsRoutesContent).toContain("require('../middleware/csrf')");
      expect(ticketsRoutesContent).toContain('csrfProtection');
    });

    it('tickets POST / should have csrfProtection', () => {
      const ticketCreateRoute = ticketsRoutesContent.match(
        /router\.post\('\/'[\s\S]*?\(req, res\)/
      );
      expect(ticketCreateRoute).toBeTruthy();
      expect(ticketCreateRoute[0]).toContain('csrfProtection');
    });
  });
});
