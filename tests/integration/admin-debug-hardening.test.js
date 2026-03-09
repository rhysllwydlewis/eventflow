/**
 * Integration tests for admin/debug endpoint hardening
 *
 * Verifies that all admin debug endpoints:
 * 1. Require authentication (authRequired middleware)
 * 2. Require admin role (roleRequired('admin') middleware)
 * 3. Protect state-changing operations with CSRF (csrfProtection)
 * 4. Produce audit logs for sensitive actions
 * 5. Do not expose sensitive tokens in API responses
 * 6. Enforce safe input validation
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEBUG_ROUTES = path.join(__dirname, '../../routes/admin-debug.js');

let debugContent;

beforeAll(() => {
  debugContent = fs.readFileSync(DEBUG_ROUTES, 'utf8');
});

// ─── File Existence ───────────────────────────────────────────────────────────

describe('Admin Debug Hardening — File Structure', () => {
  it('routes/admin-debug.js exists', () => {
    expect(fs.existsSync(DEBUG_ROUTES)).toBe(true);
  });

  it('admin-debug.js imports authRequired and roleRequired', () => {
    expect(debugContent).toContain('authRequired');
    expect(debugContent).toContain('roleRequired');
  });

  it('admin-debug.js imports csrfProtection', () => {
    expect(debugContent).toContain('csrfProtection');
  });

  it('admin-debug.js imports auditLog for change tracking', () => {
    expect(debugContent).toContain('auditLog');
  });
});

// ─── Authentication Gate ──────────────────────────────────────────────────────

describe('Admin Debug Hardening — Authentication Requirements', () => {
  const endpoints = [
    { name: 'GET /user', pattern: "router.get('/user'" },
    { name: 'POST /fix-password', pattern: "'/fix-password'" },
    { name: 'POST /verify-user', pattern: "'/verify-user'" },
    { name: 'POST /test-email', pattern: "'/test-email'" },
    { name: 'POST /login-test', pattern: "'/login-test'" },
    { name: 'POST /audit-users', pattern: "'/audit-users'" },
  ];

  endpoints.forEach(({ name, pattern }) => {
    it(`${name} requires authRequired middleware`, () => {
      const idx = debugContent.indexOf(pattern);
      expect(idx).toBeGreaterThan(-1);
      const block = debugContent.substring(idx - 20, idx + 300);
      expect(block).toContain('authRequired');
    });

    it(`${name} requires roleRequired('admin') middleware`, () => {
      const idx = debugContent.indexOf(pattern);
      expect(idx).toBeGreaterThan(-1);
      const block = debugContent.substring(idx - 20, idx + 300);
      expect(block).toContain("roleRequired('admin')");
    });
  });
});

// ─── CSRF Enforcement on State-Changing Endpoints ─────────────────────────────

describe('Admin Debug Hardening — CSRF Protection', () => {
  const stateChangingEndpoints = [
    { name: 'POST /fix-password', pattern: "'/fix-password'" },
    { name: 'POST /verify-user', pattern: "'/verify-user'" },
    { name: 'POST /test-email', pattern: "'/test-email'" },
    { name: 'POST /login-test', pattern: "'/login-test'" },
    { name: 'POST /audit-users', pattern: "'/audit-users'" },
  ];

  stateChangingEndpoints.forEach(({ name, pattern }) => {
    it(`${name} has csrfProtection middleware`, () => {
      const idx = debugContent.indexOf(pattern);
      expect(idx).toBeGreaterThan(-1);
      const block = debugContent.substring(idx - 20, idx + 400);
      expect(block).toContain('csrfProtection');
    });
  });
});

// ─── Audit Logging ────────────────────────────────────────────────────────────

describe('Admin Debug Hardening — Audit Logging', () => {
  it('POST /fix-password records audit log entry', () => {
    const idx = debugContent.indexOf("'/fix-password'");
    const block = debugContent.substring(idx, idx + 1200);
    expect(block).toContain('auditLog');
    expect(block).toContain("action: 'fix_password'");
  });

  it('POST /verify-user records audit log entry', () => {
    const idx = debugContent.indexOf("'/verify-user'");
    const block = debugContent.substring(idx, idx + 1200);
    expect(block).toContain('auditLog');
    expect(block).toContain("action: 'verify_user'");
  });

  it('POST /test-email records audit log entry', () => {
    const idx = debugContent.indexOf("'/test-email'");
    const block = debugContent.substring(idx, idx + 1200);
    expect(block).toContain('auditLog');
    expect(block).toContain("action: 'test_email'");
  });

  it('POST /audit-users records audit log entry', () => {
    const idx = debugContent.indexOf("'/audit-users'");
    const block = debugContent.substring(idx, idx + 2000);
    expect(block).toContain('auditLog');
    expect(block).toContain("action: 'audit_users'");
  });
});

// ─── Response Safety (no sensitive data leakage) ──────────────────────────────

describe('Admin Debug Hardening — Response Safety', () => {
  it('GET /user never returns passwordHash in response', () => {
    const userIdx = debugContent.indexOf("router.get('/user'");
    const userBlock = debugContent.substring(userIdx, userIdx + 2000);
    // debug_info section must NOT include the raw passwordHash value
    // It should only include hasPasswordHash (boolean) and passwordHashLength
    expect(userBlock).toContain('hasPasswordHash');
    expect(userBlock).not.toMatch(/debug_info[\s\S]*?passwordHash\s*:/);
  });

  it('POST /test-email does not return a raw token in the response body', () => {
    const testEmailIdx = debugContent.indexOf("'/test-email'");
    const block = debugContent.substring(testEmailIdx, testEmailIdx + 1500);
    // testToken should NOT be returned - it leaks sensitive email verification tokens
    expect(block).not.toMatch(/testToken\s*:/);
  });

  it('POST /fix-password enforces minimum password length of 8 characters', () => {
    const fixIdx = debugContent.indexOf("'/fix-password'");
    const block = debugContent.substring(fixIdx, fixIdx + 1000);
    expect(block).toContain('8');
    expect(block).toMatch(/newPassword\.length\s*<\s*8/);
  });

  it('POST /fix-password does not return the new password in the response', () => {
    const fixIdx = debugContent.indexOf("'/fix-password'");
    const block = debugContent.substring(fixIdx, fixIdx + 1500);
    // Response should include user info but not the password
    expect(block).not.toMatch(/res\.json[\s\S]{0,100}newPassword/);
  });

  it('POST /audit-users returns summary statistics without exposing all user data', () => {
    const auditIdx = debugContent.indexOf("'/audit-users'");
    const block = debugContent.substring(auditIdx, auditIdx + 2000);
    // Should return summary counts, not full user objects
    expect(block).toContain('summary');
    expect(block).toContain('totalUsers');
  });
});

// ─── Input Validation ─────────────────────────────────────────────────────────

describe('Admin Debug Hardening — Input Validation', () => {
  it('GET /user validates email query parameter is provided', () => {
    const userIdx = debugContent.indexOf("router.get('/user'");
    const block = debugContent.substring(userIdx, userIdx + 600);
    expect(block).toContain('email');
    expect(block).toContain('status(400)');
  });

  it('POST /fix-password validates both email and newPassword are provided', () => {
    const fixIdx = debugContent.indexOf("'/fix-password'");
    const block = debugContent.substring(fixIdx, fixIdx + 800);
    expect(block).toContain('email');
    expect(block).toContain('newPassword');
    expect(block).toContain('status(400)');
  });

  it('POST /verify-user validates email is provided', () => {
    const verifyIdx = debugContent.indexOf("'/verify-user'");
    const block = debugContent.substring(verifyIdx, verifyIdx + 600);
    expect(block).toContain('email');
    expect(block).toContain('status(400)');
  });

  it('POST /login-test validates both email and password are provided', () => {
    const loginIdx = debugContent.indexOf("'/login-test'");
    const block = debugContent.substring(loginIdx, loginIdx + 600);
    expect(block).toContain('email');
    expect(block).toContain('password');
    expect(block).toContain('status(400)');
  });
});

// ─── Logging ─────────────────────────────────────────────────────────────────

describe('Admin Debug Hardening — Operational Logging', () => {
  it('admin-debug.js uses logger for info/error messages', () => {
    expect(debugContent).toContain('logger.info');
    expect(debugContent).toContain('logger.error');
  });

  it('fix-password logs admin email for traceability', () => {
    const fixIdx = debugContent.indexOf("'/fix-password'");
    const block = debugContent.substring(fixIdx, fixIdx + 1500);
    expect(block).toContain('req.user.email');
    expect(block).toMatch(/logger\.info/);
  });

  it('verify-user logs admin email for traceability', () => {
    const verifyIdx = debugContent.indexOf("'/verify-user'");
    const block = debugContent.substring(verifyIdx, verifyIdx + 1000);
    expect(block).toContain('req.user.email');
    expect(block).toMatch(/logger\.info/);
  });
});
