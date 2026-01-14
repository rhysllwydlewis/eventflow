/**
 * Integration tests for admin reports endpoints with CSRF protection
 */

const fs = require('fs');
const path = require('path');

describe('Admin Reports Endpoints - CSRF Protection', () => {
  let reportsRoutesContent;

  beforeAll(() => {
    reportsRoutesContent = fs.readFileSync(
      path.join(__dirname, '../../routes/reports.js'),
      'utf8'
    );
  });

  describe('CSRF Import and Protection', () => {
    it('should import csrfProtection middleware', () => {
      expect(reportsRoutesContent).toContain("require('../middleware/csrf')");
      expect(reportsRoutesContent).toContain('csrfProtection');
    });
  });

  describe('POST /api/admin/reports/:id/resolve', () => {
    it('should have csrfProtection middleware', () => {
      const resolveRoute = reportsRoutesContent.match(
        /router\.post\(\s*['"]\/admin\/reports\/:id\/resolve['"][\s\S]*?\);/
      );
      expect(resolveRoute).toBeTruthy();
      expect(resolveRoute[0]).toContain('csrfProtection');
    });

    it('should include authRequired and roleRequired', () => {
      const resolveRoute = reportsRoutesContent.match(
        /router\.post\(\s*['"]\/admin\/reports\/:id\/resolve['"][\s\S]*?\);/
      );
      expect(resolveRoute).toBeTruthy();
      expect(resolveRoute[0]).toContain('authRequired');
      expect(resolveRoute[0]).toContain("roleRequired('admin')");
    });

    it('should validate resolution parameter', () => {
      // Check that the route validates the resolution input
      expect(reportsRoutesContent).toContain('if (!resolution)');
      expect(reportsRoutesContent).toContain("error: 'Resolution is required'");
      
      // Check for resolution validation array
      const resolveSection = reportsRoutesContent.substring(
        reportsRoutesContent.indexOf("POST /api/admin/reports/:id/resolve"),
        reportsRoutesContent.indexOf("POST /api/admin/reports/:id/dismiss")
      );
      expect(resolveSection).toContain('resolution');
      expect(resolveSection).toContain("'valid'");
      expect(resolveSection).toContain("'invalid'");
    });
  });

  describe('POST /api/admin/reports/:id/dismiss', () => {
    it('should have csrfProtection middleware', () => {
      const dismissRoute = reportsRoutesContent.match(
        /router\.post\(\s*['"]\/admin\/reports\/:id\/dismiss['"][\s\S]*?\);/
      );
      expect(dismissRoute).toBeTruthy();
      expect(dismissRoute[0]).toContain('csrfProtection');
    });

    it('should include authRequired and roleRequired', () => {
      const dismissRoute = reportsRoutesContent.match(
        /router\.post\(\s*['"]\/admin\/reports\/:id\/dismiss['"][\s\S]*?\);/
      );
      expect(dismissRoute).toBeTruthy();
      expect(dismissRoute[0]).toContain('authRequired');
      expect(dismissRoute[0]).toContain("roleRequired('admin')");
    });
  });

  describe('Audit Logging', () => {
    it('should create audit logs for resolve actions', () => {
      expect(reportsRoutesContent).toContain('AUDIT_ACTIONS.REPORT_RESOLVED');
      expect(reportsRoutesContent).toContain('auditLog({');
    });

    it('should create audit logs for dismiss actions', () => {
      const dismissRoute = reportsRoutesContent.match(
        /POST \/api\/admin\/reports\/:id\/dismiss[\s\S]*?module\.exports/
      );
      expect(dismissRoute).toBeTruthy();
      expect(dismissRoute[0]).toContain('auditLog({');
    });
  });
});
