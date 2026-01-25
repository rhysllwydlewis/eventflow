/**
 * Unit tests for db-unified writeAndVerify functionality
 * Tests write verification and retry logic
 */

const dbUnified = require('../../db-unified');

// Mock console methods to suppress logs during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('Database Unified - writeAndVerify', () => {
  beforeEach(async () => {
    // Initialize database before each test
    await dbUnified.initializeDatabase();
  });

  describe('writeAndVerify with settings collection', () => {
    it('should successfully write and verify settings data', async () => {
      const testSettings = {
        site: {
          name: 'Test Site',
          tagline: 'Test Tagline',
          updatedAt: new Date().toISOString(),
          updatedBy: 'test@example.com',
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.site).toBeDefined();
      expect(result.data.site.name).toBe('Test Site');
      expect(result.data.site.tagline).toBe('Test Tagline');
    });

    it('should verify nested objects correctly', async () => {
      const testSettings = {
        collageWidget: {
          enabled: true,
          source: 'pexels',
          mediaTypes: ['photo', 'video'],
          pexelsQueries: ['wedding', 'celebration'],
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin@example.com',
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.collageWidget).toBeDefined();
      expect(result.data.collageWidget.enabled).toBe(true);
      expect(result.data.collageWidget.source).toBe('pexels');
      expect(result.data.collageWidget.mediaTypes).toEqual(['photo', 'video']);
      expect(result.data.collageWidget.pexelsQueries).toEqual(['wedding', 'celebration']);
    });

    it('should verify deeply nested objects', async () => {
      const testSettings = {
        collageWidget: {
          enabled: true,
          heroVideo: {
            enabled: false,
            autoplay: true,
            muted: true,
          },
          transition: {
            effect: 'fade',
            duration: 1000,
          },
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.collageWidget.heroVideo).toEqual({
        enabled: false,
        autoplay: true,
        muted: true,
      });
      expect(result.data.collageWidget.transition).toEqual({
        effect: 'fade',
        duration: 1000,
      });
    });

    it('should handle feature flags correctly', async () => {
      const testSettings = {
        features: {
          registration: true,
          supplierApplications: true,
          reviews: false,
          photoUploads: true,
          supportTickets: true,
          pexelsCollage: false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin@example.com',
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.features).toBeDefined();
      expect(result.data.features.registration).toBe(true);
      expect(result.data.features.reviews).toBe(false);
      expect(result.data.features.pexelsCollage).toBe(false);
    });

    it('should handle maintenance settings correctly', async () => {
      const testSettings = {
        maintenance: {
          enabled: true,
          message: 'System maintenance in progress',
          duration: 60,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'admin@example.com',
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.maintenance).toBeDefined();
      expect(result.data.maintenance.enabled).toBe(true);
      expect(result.data.maintenance.message).toBe('System maintenance in progress');
      expect(result.data.maintenance.duration).toBe(60);
    });

    it('should handle email templates correctly', async () => {
      const testSettings = {
        emailTemplates: {
          welcome: {
            subject: 'Welcome to EventFlow!',
            body: 'Hi {{name}}, welcome!',
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin@example.com',
          },
          'password-reset': {
            subject: 'Reset your password',
            body: 'Click here: {{resetLink}}',
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin@example.com',
          },
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.emailTemplates).toBeDefined();
      expect(result.data.emailTemplates.welcome).toBeDefined();
      expect(result.data.emailTemplates.welcome.subject).toBe('Welcome to EventFlow!');
      expect(result.data.emailTemplates['password-reset']).toBeDefined();
    });

    it('should return data from database, not in-memory object', async () => {
      const inMemorySettings = {
        site: {
          name: 'In-Memory Name',
          tagline: 'In-Memory Tagline',
          updatedAt: new Date().toISOString(),
          updatedBy: 'test@example.com',
        },
      };

      const result = await dbUnified.writeAndVerify('settings', inMemorySettings);

      // The result should come from the database, not the in-memory object
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data).not.toBe(inMemorySettings); // Different object reference
      expect(result.data.site).toEqual(inMemorySettings.site); // But same content
    });

    it('should handle updating existing settings', async () => {
      // First write
      const initialSettings = {
        site: {
          name: 'Initial Name',
          tagline: 'Initial Tagline',
          updatedAt: new Date().toISOString(),
        },
      };
      await dbUnified.writeAndVerify('settings', initialSettings);

      // Update with new settings
      const updatedSettings = {
        site: {
          name: 'Updated Name',
          tagline: 'Updated Tagline',
          contactEmail: 'contact@example.com',
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await dbUnified.writeAndVerify('settings', updatedSettings);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data.site.name).toBe('Updated Name');
      expect(result.data.site.tagline).toBe('Updated Tagline');
      expect(result.data.site.contactEmail).toBe('contact@example.com');
    });
  });

  describe('writeAndVerify with array collections', () => {
    it('should successfully write and verify array data', async () => {
      // Use a known collection type that accepts arrays
      const testData = [
        {
          id: dbUnified.uid('user'),
          email: 'test1@example.com',
          role: 'customer',
          createdAt: new Date(),
        },
        {
          id: dbUnified.uid('user'),
          email: 'test2@example.com',
          role: 'customer',
          createdAt: new Date(),
        },
      ];

      const result = await dbUnified.writeAndVerify('users', testData);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should handle empty arrays', async () => {
      const testData = [];

      const result = await dbUnified.writeAndVerify('users', testData);

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });
  });

  describe('writeAndVerify options', () => {
    it('should respect maxRetries option', async () => {
      const testSettings = {
        test: {
          value: 'test',
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings, {
        maxRetries: 0,
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('should respect retryDelayMs option', async () => {
      const testSettings = {
        test: {
          value: 'test',
          updatedAt: new Date().toISOString(),
        },
      };

      const startTime = Date.now();
      const result = await dbUnified.writeAndVerify('settings', testSettings, {
        maxRetries: 0,
        retryDelayMs: 10,
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      // Should complete quickly with no retries
      expect(duration).toBeLessThan(500);
    });
  });

  describe('writeAndVerify return structure', () => {
    it('should return correct structure on success', async () => {
      const testSettings = {
        test: { value: 'test' },
      };

      const result = await dbUnified.writeAndVerify('settings', testSettings);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('data');
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.data).toBeDefined();
      expect(result).not.toHaveProperty('error');
    });

    it('should handle invalid data based on database type', async () => {
      // Settings must be an object, not an array
      // This validation only happens with MongoDB, not local storage
      const invalidSettings = ['invalid', 'data'];

      const result = await dbUnified.writeAndVerify('settings', invalidSettings);
      const dbType = dbUnified.getDatabaseType();

      if (dbType === 'mongodb') {
        // MongoDB should reject this
        expect(result.success).toBe(false);
        expect(result.verified).toBe(false);
        expect(result.data).toBeNull();
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Settings data must be a non-null object');
      } else {
        // Local storage is more permissive (for backward compatibility)
        // but still returns data that can be verified
        expect(result.success).toBe(true);
        expect(result.verified).toBe(true);
      }
    });
  });

  describe('writeAndVerify vs write comparison', () => {
    it('should provide stronger guarantees than write alone', async () => {
      const testSettings = {
        comparison: {
          test: 'writeAndVerify vs write',
          updatedAt: new Date().toISOString(),
        },
      };

      // Using writeAndVerify
      const verifyResult = await dbUnified.writeAndVerify('settings', testSettings);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.data).toBeDefined();

      // Compare with regular write
      const writeResult = await dbUnified.write('settings', testSettings);
      expect(writeResult).toBe(true); // write returns boolean

      // writeAndVerify provides more information
      expect(typeof verifyResult).toBe('object');
      expect(verifyResult).toHaveProperty('verified');
      expect(verifyResult).toHaveProperty('data');
    });
  });
});
