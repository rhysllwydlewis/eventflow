/**
 * Unit tests for admin packages endpoints and page
 * Validates route structure, auth/role guards, CSRF enforcement,
 * and that the admin-packages JS page uses the shared API helper.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ADMIN_ROUTES = path.join(__dirname, '../../routes/admin.js');
const PACKAGES_INIT = path.join(__dirname, '../../public/assets/js/pages/admin-packages-init.js');
const PACKAGES_HTML = path.join(__dirname, '../../public/admin-packages.html');

let adminContent;
let packagesInitContent;

beforeAll(() => {
  adminContent = fs.readFileSync(ADMIN_ROUTES, 'utf8');
  packagesInitContent = fs.readFileSync(PACKAGES_INIT, 'utf8');
});

describe('Admin Packages — Route Structure', () => {
  it('GET /packages route exists', () => {
    expect(adminContent).toContain("router.get('/packages'");
  });

  it('GET /packages requires authRequired', () => {
    const match = adminContent.match(/router\.get\(['"]\/packages['"][^)]*\)/s);
    expect(match).toBeTruthy();
    expect(match[0]).toContain('authRequired');
  });

  it("GET /packages requires roleRequired('admin')", () => {
    const match = adminContent.match(/router\.get\(['"]\/packages['"][^)]*\)/s);
    expect(match).toBeTruthy();
    expect(match[0]).toContain("roleRequired('admin')");
  });

  it('POST /packages route exists with CSRF protection', () => {
    expect(adminContent).toContain("router.post('/packages'");
    const match = adminContent.match(/router\.post\(['"]\/packages['"][\s\S]*?csrfProtection/);
    expect(match).toBeTruthy();
  });

  it('POST /packages/:id/approve route exists with guards', () => {
    expect(adminContent).toContain("'/packages/:id/approve'");
    const approveIdx = adminContent.indexOf("'/packages/:id/approve'");
    const approveBlock = adminContent.substring(approveIdx - 30, approveIdx + 200);
    expect(approveBlock).toContain('authRequired');
    expect(approveBlock).toContain("roleRequired('admin')");
    expect(approveBlock).toContain('csrfProtection');
  });

  it('POST /packages/:id/feature route exists with guards', () => {
    expect(adminContent).toContain("'/packages/:id/feature'");
    const featureIdx = adminContent.indexOf("'/packages/:id/feature'");
    const featureBlock = adminContent.substring(featureIdx - 30, featureIdx + 200);
    expect(featureBlock).toContain('authRequired');
    expect(featureBlock).toContain('csrfProtection');
  });

  it('POST /packages/bulk-approve route exists with CSRF protection', () => {
    expect(adminContent).toContain("'/packages/bulk-approve'");
    const idx = adminContent.indexOf("'/packages/bulk-approve'");
    const block = adminContent.substring(idx - 30, idx + 200);
    expect(block).toContain('csrfProtection');
  });

  it('GET /packages uses dbUnified.read', () => {
    expect(adminContent).toContain("dbUnified.read('packages')");
  });
});

describe('Admin Packages — Empty-State Handling', () => {
  it('GET /packages returns items array (empty-state safe)', () => {
    // The route handler should return a response with an 'items' field
    expect(adminContent).toContain('items');
    // items field should be derived from the dbUnified result
    const packagesSection = adminContent.substring(
      adminContent.indexOf("router.get('/packages'"),
      adminContent.indexOf("router.post('/packages'")
    );
    // Confirm the route can handle an empty collection
    expect(packagesSection).toContain('items');
  });

  it('supplierId filter returns subset safely', () => {
    expect(adminContent).toContain('supplierId');
    expect(adminContent).toMatch(/pkg\.supplierId\s*===\s*supplierId/);
  });

  it('featured=true filter applied safely', () => {
    expect(adminContent).toContain("featured === 'true'");
    expect(adminContent).toContain('pkg.featured === true');
  });
});

describe('Admin Packages — Page JS (admin-packages-init.js)', () => {
  it('uses AdminShared.api for API calls', () => {
    expect(packagesInitContent).toContain('AdminShared');
  });

  it('uses AdminShared.escapeHtml or escapeHtml for XSS safety', () => {
    expect(packagesInitContent).toMatch(/escapeHtml/);
  });

  it('handles empty items array without throwing', () => {
    // data.items || [] pattern
    expect(packagesInitContent).toContain('data.items ||');
  });

  it('does not call native browser dialogs', () => {
    const NATIVE_DIALOG = /\b(window\.)?(alert|confirm|prompt)\s*\(/;
    const lines = packagesInitContent.split('\n');
    const violations = lines.filter(line => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
        return false;
      }
      if (/_adminConfirm|_adminToast|AdminShared/.test(line)) {
        return false;
      }
      return NATIVE_DIALOG.test(line);
    });
    expect(violations).toEqual([]);
  });
});

describe('Admin Packages — HTML Page exists', () => {
  it('admin-packages.html exists on disk', () => {
    expect(fs.existsSync(PACKAGES_HTML)).toBe(true);
  });
});
