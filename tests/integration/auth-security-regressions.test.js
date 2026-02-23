/**
 * Security regression tests for the auth.html page
 *
 * Guards against:
 *  1. Credentials (passwords) being logged to the browser console via formData
 *  2. Unbounded setTimeout retry loops in hCaptcha init
 *  3. Debug-only console.log statements leaking into production
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('auth.html – security regressions', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(__dirname, '../../public/auth.html'), 'utf8');
  });

  describe('No sensitive data in console output', () => {
    it('does not log formData (which contains plaintext passwords) on login', () => {
      // Ensure the dangerous debug log that exposed login credentials is gone
      expect(content).not.toContain("console.log('Login form validated:");
      expect(content).not.toContain('console.log("Login form validated:');
    });

    it('does not log formData (which contains plaintext passwords) on register', () => {
      // Ensure the dangerous debug log that exposed registration credentials is gone
      expect(content).not.toContain("console.log('Register form validated:");
      expect(content).not.toContain('console.log("Register form validated:');
    });

    it('does not log the CSRF token fetch success message (debug noise)', () => {
      expect(content).not.toContain("console.log('✅ CSRF token fetched");
      expect(content).not.toContain('console.log("✅ CSRF token fetched');
    });
  });

  describe('hCaptcha init retry loop is bounded', () => {
    it('defines CAPTCHA_MAX_RETRIES to cap the retry loop', () => {
      expect(content).toContain('CAPTCHA_MAX_RETRIES');
    });

    it('checks retry count before calling setTimeout again', () => {
      // The guard must appear before setTimeout in the captcha init section
      const captchaSection = content.slice(
        content.indexOf('initRegisterCaptcha'),
        content.indexOf('initRegisterCaptcha') + 600
      );
      const retryCheckPos = captchaSection.indexOf('captchaRetries < CAPTCHA_MAX_RETRIES');
      const setTimeoutPos = captchaSection.indexOf('setTimeout(initRegisterCaptcha');
      expect(retryCheckPos).toBeGreaterThan(-1);
      expect(setTimeoutPos).toBeGreaterThan(-1);
      expect(retryCheckPos).toBeLessThan(setTimeoutPos);
    });
  });
});

describe('contact.html – hCaptcha init retry loop is bounded', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(__dirname, '../../public/contact.html'), 'utf8');
  });

  it('defines CAPTCHA_MAX_RETRIES to cap the retry loop', () => {
    expect(content).toContain('CAPTCHA_MAX_RETRIES');
  });

  it('guards setTimeout with retry counter check', () => {
    expect(content).toContain('captchaRetries < CAPTCHA_MAX_RETRIES');
  });
});

describe('sentry-browser-init.js – SDK load retry loop is bounded', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(
      path.join(__dirname, '../../public/assets/js/utils/sentry-browser-init.js'),
      'utf8'
    );
  });

  it('caps Sentry SDK retry attempts', () => {
    expect(content).toContain('maxAttempts');
  });

  it('passes attempt counter through recursive calls', () => {
    expect(content).toContain('doInit(config, (attempt || 0) + 1)');
  });

  it('guards setTimeout with attempt < maxAttempts', () => {
    expect(content).toContain('(attempt || 0) < maxAttempts');
  });
});
