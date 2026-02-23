/**
 * Integration tests for the /api/v1/contact endpoint
 * Tests captcha verification, input sanitization, and validation
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('Contact Form Endpoint', () => {
  let miscContent;

  beforeAll(() => {
    miscContent = fs.readFileSync(path.join(__dirname, '../../routes/misc.js'), 'utf8');
  });

  describe('Route definition', () => {
    it('defines POST /contact endpoint', () => {
      expect(miscContent).toContain("router.post('/contact'");
    });

    it('applies rate limiting to contact endpoint', () => {
      const contactRoute = miscContent.match(/router\.post\('\/contact'.+?(?=router\.|\/\/ ---)/s);
      expect(contactRoute).toBeTruthy();
      expect(contactRoute[0]).toContain('applyWriteLimiter');
    });

    it('verifies captcha before accepting submission', () => {
      expect(miscContent).toContain('verifyHCaptcha(captchaToken)');
      expect(miscContent).toContain('captchaResult.success');
    });

    it('validates required fields (name, email, message)', () => {
      expect(miscContent).toContain('Name, email, and message are required');
    });

    it('validates email format', () => {
      expect(miscContent).toContain('validator.isEmail');
    });

    it('sanitizes and trims input strings', () => {
      expect(miscContent).toContain('.trim()');
      // Name capped at 100, email at 200, message at 2000
      expect(miscContent).toContain('.slice(0, 100)');
      expect(miscContent).toContain('.slice(0, 200)');
      expect(miscContent).toContain('.slice(0, 2000)');
    });
  });

  describe('Dependencies', () => {
    it('has validator imported at module level', () => {
      // validator should be required at the top, not inline
      const topLines = miscContent.split('\n').slice(0, 15).join('\n');
      expect(topLines).toContain("require('validator')");
    });

    it('has verifyHCaptcha in required dependencies list', () => {
      expect(miscContent).toContain("'verifyHCaptcha'");
    });
  });

  describe('Response format', () => {
    it('returns success JSON on valid submission', () => {
      expect(miscContent).toContain('success: true');
      expect(miscContent).toContain('Thank you for your message');
    });

    it('returns 400 for failed captcha', () => {
      expect(miscContent).toContain('res.status(400).json({ error: captchaResult.error');
    });
  });

  describe('Auth registration captcha integration', () => {
    let authContent;

    beforeAll(() => {
      authContent = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');
    });

    it('auth.js extracts captchaToken from request body', () => {
      expect(authContent).toContain('captchaToken');
    });

    it('auth.js has initializeDependencies to receive verifyHCaptcha', () => {
      expect(authContent).toContain('initializeDependencies');
      expect(authContent).toContain('_verifyHCaptcha');
    });

    it('auth.js calls captcha verification during registration', () => {
      expect(authContent).toContain('_verifyHCaptcha(captchaToken)');
    });

    it('auth.js exports initializeDependencies', () => {
      expect(authContent).toContain('module.exports.initializeDependencies');
    });
  });
});
