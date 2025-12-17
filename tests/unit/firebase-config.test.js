/**
 * Test file to verify Firebase npm configuration
 * This test checks that the Firebase configuration can be imported
 * and that all expected services are exported.
 */

describe('Firebase Configuration (npm)', () => {
  describe('src/config/firebase.js', () => {
    it('should export app instance', () => {
      // This would require a bundler to work in Node.js
      // For now, we verify the file structure is correct
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');

      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf8');

      // Verify it uses ES modules
      expect(content).toContain('import {');
      expect(content).toContain("from 'firebase/app'");

      // Verify it exports required services
      expect(content).toContain('export { app, auth, db, analytics');

      // Verify it has Firebase config structure (check for project ID pattern)
      expect(content).toContain('projectId:');
      expect(content).toContain('apiKey:');
      expect(content).toContain('authDomain:');
    });

    it('should have proper JSDoc comments', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');
      const content = fs.readFileSync(configPath, 'utf8');

      // Verify JSDoc documentation exists
      expect(content).toContain('/**');
      expect(content).toContain('@module firebase');
      expect(content).toContain('@requires');
      expect(content).toContain('@type');
    });

    it('should initialize Firebase services correctly', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');
      const content = fs.readFileSync(configPath, 'utf8');

      // Verify service initialization
      expect(content).toContain('const app = initializeApp(firebaseConfig)');
      expect(content).toContain('const auth = getAuth(app)');
      expect(content).toContain('const db = getFirestore(app)');
    });

    it('should use Firebase v9+ modular SDK', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');
      const content = fs.readFileSync(configPath, 'utf8');

      // Verify modular imports
      expect(content).toContain("import { initializeApp } from 'firebase/app'");
      expect(content).toContain("import { getAuth } from 'firebase/auth'");
      expect(content).toContain("import { getFirestore } from 'firebase/firestore'");
      expect(content).toContain('import { getAnalytics');
    });

    it('should have security notes about API keys', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');
      const content = fs.readFileSync(configPath, 'utf8');

      expect(content).toContain('SECURITY NOTE');
      expect(content).toContain('safe to expose');
    });

    it('should export getAnalyticsInstance function', () => {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../../src/config/firebase.js');
      const content = fs.readFileSync(configPath, 'utf8');

      expect(content).toContain('export function getAnalyticsInstance()');
      expect(content).toContain('getAnalyticsInstance');
    });
  });

  describe('src/firebase.js', () => {
    it('should re-export from config/firebase.js', () => {
      const fs = require('fs');
      const path = require('path');
      const firebasePath = path.join(__dirname, '../../src/firebase.js');

      expect(fs.existsSync(firebasePath)).toBe(true);

      const content = fs.readFileSync(firebasePath, 'utf8');

      // Verify it re-exports
      expect(content).toContain("export * from './config/firebase.js'");
      expect(content).toContain("export { default } from './config/firebase.js'");
    });
  });

  describe('package.json', () => {
    it('should have firebase package installed', () => {
      const packageJson = require('../../package.json');

      expect(packageJson.dependencies).toHaveProperty('firebase');

      // Verify it's version 10.x or later (requirement states 10.x+)
      const version = packageJson.dependencies.firebase;
      // Extract major version handling various formats: ^12.6.0, ~12.6.0, 12.6.0, etc.
      // Skip version tags like 'latest' or 'beta' - they would be handled by package manager
      const versionMatch = version.match(/(\d+)\./);
      if (versionMatch) {
        const majorVersion = parseInt(versionMatch[1], 10);
        expect(majorVersion).toBeGreaterThanOrEqual(10);
      } else {
        // If no numeric version found, just verify firebase is present (tags like 'latest' are fine)
        expect(version).toBeTruthy();
      }
    });
  });
});
