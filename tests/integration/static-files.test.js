/**
 * Integration tests for static file serving
 * Tests that critical HTML files exist and have proper content
 * Note: Full server integration testing is done manually with curl
 */

const path = require('path');
const fs = require('fs');

describe('Static File Serving', () => {
  // Note: These tests verify that the static files exist and have proper content.
  // The middleware order was manually tested with curl and verified to work correctly:
  // - curl http://localhost:3000/verify.html returns 200
  // - curl http://localhost:3000/verify.html?token=test returns 200
  // Full integration testing with the actual server would require starting it,
  // which is beyond the scope of these unit tests.

  describe('Email Verification Page', () => {
    const verifyHtmlPath = path.join(__dirname, '../../public/verify.html');

    it('should have verify.html file in public directory', () => {
      const fileExists = fs.existsSync(verifyHtmlPath);
      expect(fileExists).toBe(true);
    });

    it('should have proper HTML structure in verify.html', () => {
      const content = fs.readFileSync(verifyHtmlPath, 'utf8');

      // Verify basic HTML structure
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('<html');
      expect(content).toContain('Verify your account');
      expect(content).toContain('EventFlow');
    });
  });

  describe('Other Static Files', () => {
    it('should have public directory', () => {
      const publicDir = path.join(__dirname, '../../public');
      expect(fs.existsSync(publicDir)).toBe(true);
    });

    it('should have assets directory', () => {
      const assetsDir = path.join(__dirname, '../../public/assets');
      expect(fs.existsSync(assetsDir)).toBe(true);
    });
  });
});
