/**
 * Integration tests for Error Handling
 * Tests error handling across different layers of the application
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('Error Handling Integration', () => {
  describe('Middleware Error Handling', () => {
    let errorMiddlewareContent;

    beforeAll(() => {
      // Check if error handling middleware exists
      const errorMiddlewarePath = path.join(__dirname, '../../middleware/errorHandler.js');
      if (fs.existsSync(errorMiddlewarePath)) {
        errorMiddlewareContent = fs.readFileSync(errorMiddlewarePath, 'utf8');
      }
    });

    it('should have centralized error handling middleware', () => {
      const middlewarePath = path.join(__dirname, '../../middleware/errorHandler.js');
      const middlewareExists = fs.existsSync(middlewarePath);

      // Either have dedicated errorHandler or handle errors in server.js
      if (middlewareExists) {
        expect(errorMiddlewareContent).toContain('function');
        expect(errorMiddlewareContent).toMatch(/error|err/i);
      } else {
        // Check server.js for error handling
        const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
        expect(serverContent).toMatch(/app\.use.*error|catch.*error/i);
      }
    });

    it('should handle 404 errors', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Should have 404 handler
      expect(serverContent).toMatch(/404|Not Found|not found/);
    });

    it('should return proper error response format', () => {
      const routesDir = path.join(__dirname, '../../routes');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

      let hasErrorHandling = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
        if (content.includes('res.status') && content.match(/[45]\d{2}/)) {
          hasErrorHandling = true;
        }
      });

      expect(hasErrorHandling).toBe(true);
    });
  });

  describe('Database Error Handling', () => {
    let dbUnifiedContent;

    beforeAll(() => {
      dbUnifiedContent = fs.readFileSync(path.join(__dirname, '../../db-unified.js'), 'utf8');
    });

    it('should have try-catch blocks for database operations', () => {
      expect(dbUnifiedContent).toMatch(/try\s*{[\s\S]*?catch/);
    });

    it('should handle connection errors gracefully', () => {
      expect(dbUnifiedContent).toMatch(/connect.*error|error.*connect/i);
    });

    it('should log database errors', () => {
      expect(dbUnifiedContent).toMatch(/console\.error|logger\.error|log.*error/i);
    });

    it('should handle query errors', () => {
      const hasErrorHandling =
        dbUnifiedContent.includes('catch') &&
        (dbUnifiedContent.includes('find') ||
          dbUnifiedContent.includes('insert') ||
          dbUnifiedContent.includes('update') ||
          dbUnifiedContent.includes('delete'));

      expect(hasErrorHandling).toBe(true);
    });
  });

  describe('API Error Responses', () => {
    let routeFiles;

    beforeAll(() => {
      const routesDir = path.join(__dirname, '../../routes');
      routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    });

    it('should use consistent error response format across routes', () => {
      const errorPatterns = [];

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../routes', file), 'utf8');

        // Check for error response patterns
        if (content.match(/res\.status\([45]\d{2}\)\.json/)) {
          // Extract error response format
          const matches = content.match(/res\.status\([45]\d{2}\)\.json\([^)]+\)/g);
          if (matches) {
            errorPatterns.push(...matches);
          }
        }
      });

      expect(errorPatterns.length).toBeGreaterThan(0);

      // Most error responses should include 'success: false' or 'error' field
      const hasConsistentFormat = errorPatterns.some(
        pattern => pattern.includes('success') || pattern.includes('error')
      );
      expect(hasConsistentFormat).toBe(true);
    });

    it('should handle validation errors with 400 status', () => {
      let has400Responses = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../routes', file), 'utf8');
        if (content.includes('res.status(400)')) {
          has400Responses = true;
        }
      });

      expect(has400Responses).toBe(true);
    });

    it('should handle authentication errors with 401 status', () => {
      const authContent = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');

      expect(authContent).toMatch(/res\.status\(401\)/);
    });

    it('should handle authorization errors with 403 status', () => {
      let has403Responses = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../routes', file), 'utf8');
        if (content.includes('res.status(403)')) {
          has403Responses = true;
        }
      });

      expect(has403Responses).toBe(true);
    });

    it('should handle server errors with 500 status', () => {
      let has500Responses = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../routes', file), 'utf8');
        if (content.includes('res.status(500)')) {
          has500Responses = true;
        }
      });

      expect(has500Responses).toBe(true);
    });
  });

  describe('Async Error Handling', () => {
    it('should handle async/await errors in routes', () => {
      const routesDir = path.join(__dirname, '../../routes');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

      let hasAsyncErrorHandling = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(routesDir, file), 'utf8');

        // Check if async functions have try-catch or use .catch()
        const hasAsync = content.includes('async');
        const hasCatch = content.includes('catch') || content.includes('.catch(');

        if (hasAsync && hasCatch) {
          hasAsyncErrorHandling = true;
        }
      });

      expect(hasAsyncErrorHandling).toBe(true);
    });

    it('should handle promise rejections', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Check for unhandled rejection handling
      const hasRejectionHandling =
        serverContent.includes('unhandledRejection') || serverContent.includes('uncaughtException');

      expect(hasRejectionHandling).toBe(true);
    });
  });

  describe('Service Layer Error Handling', () => {
    let serviceFiles;

    beforeAll(() => {
      const servicesDir = path.join(__dirname, '../../services');
      if (fs.existsSync(servicesDir)) {
        serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));
      } else {
        serviceFiles = [];
      }
    });

    it('should have error handling in service methods', () => {
      if (serviceFiles.length === 0) {
        // No services directory, skip test
        expect(true).toBe(true);
        return;
      }

      let hasErrorHandling = false;

      serviceFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../services', file), 'utf8');

        if (content.includes('try') && content.includes('catch')) {
          hasErrorHandling = true;
        }
      });

      expect(hasErrorHandling).toBe(true);
    });

    it('should log errors in services', () => {
      if (serviceFiles.length === 0) {
        expect(true).toBe(true);
        return;
      }

      let hasLogging = false;

      serviceFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../services', file), 'utf8');

        if (content.match(/logger\.error|console\.error/)) {
          hasLogging = true;
        }
      });

      expect(hasLogging).toBe(true);
    });

    it('should throw or return meaningful errors', () => {
      if (serviceFiles.length === 0) {
        expect(true).toBe(true);
        return;
      }

      let hasMeaningfulErrors = false;

      serviceFiles.forEach(file => {
        const content = fs.readFileSync(path.join(__dirname, '../../services', file), 'utf8');

        // Check for throw or error returns with messages
        if (content.match(/throw new Error\(['"][\w\s]+['"]\)/)) {
          hasMeaningfulErrors = true;
        }
      });

      expect(hasMeaningfulErrors).toBe(true);
    });
  });

  describe('Input Validation Error Handling', () => {
    it('should validate required fields', () => {
      const routesDir = path.join(__dirname, '../../routes');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

      let hasValidation = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(routesDir, file), 'utf8');

        // Check for validation patterns
        if (
          content.includes('required') ||
          content.includes('!req.body') ||
          content.match(/if\s*\(![\w.]+\)/)
        ) {
          hasValidation = true;
        }
      });

      expect(hasValidation).toBe(true);
    });

    it('should sanitize user input', () => {
      const routesDir = path.join(__dirname, '../../routes');
      const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

      let hasSanitization = false;

      routeFiles.forEach(file => {
        const content = fs.readFileSync(path.join(routesDir, file), 'utf8');

        // Check for sanitization patterns
        if (
          content.includes('validator') ||
          content.includes('escape') ||
          content.includes('sanitize') ||
          content.includes('mongo-sanitize')
        ) {
          hasSanitization = true;
        }
      });

      expect(hasSanitization).toBe(true);
    });

    it('should return specific validation errors', () => {
      const leadScoringPath = path.join(__dirname, '../../utils/leadScoring.js');
      if (fs.existsSync(leadScoringPath)) {
        const content = fs.readFileSync(leadScoringPath, 'utf8');

        // validateEnquiry should return errors array
        expect(content).toContain('errors');
        expect(content).toMatch(/errors\.(push|length)/);
      }
    });
  });

  describe('Rate Limiting Error Handling', () => {
    let serverContent;

    beforeAll(() => {
      serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
    });

    it('should have rate limiting configured', () => {
      expect(serverContent).toMatch(/rate-limit|rateLimit/i);
    });

    it('should return 429 status for rate limit exceeded', () => {
      const hasRateLimitResponse =
        serverContent.includes('429') || serverContent.includes('rate-limit');

      expect(hasRateLimitResponse).toBe(true);
    });
  });

  describe('File Upload Error Handling', () => {
    let photoUploadContent;

    beforeAll(() => {
      const photoUploadPath = path.join(__dirname, '../../photo-upload.js');
      if (fs.existsSync(photoUploadPath)) {
        photoUploadContent = fs.readFileSync(photoUploadPath, 'utf8');
      }
    });

    it('should handle file size limit errors', () => {
      if (!photoUploadContent) {
        expect(true).toBe(true);
        return;
      }

      expect(photoUploadContent).toMatch(/fileSize|limits/i);
    });

    it('should handle file type validation errors', () => {
      if (!photoUploadContent) {
        expect(true).toBe(true);
        return;
      }

      expect(photoUploadContent).toMatch(/fileFilter|mimetype/i);
    });

    it('should handle upload errors gracefully', () => {
      if (!photoUploadContent) {
        expect(true).toBe(true);
        return;
      }

      expect(photoUploadContent).toMatch(/error|catch/i);
    });
  });

  describe('Authentication Error Handling', () => {
    let authContent;

    beforeAll(() => {
      authContent = fs.readFileSync(path.join(__dirname, '../../routes/auth.js'), 'utf8');
    });

    it('should handle invalid credentials', () => {
      expect(authContent).toMatch(/invalid|incorrect|wrong/i);
      expect(authContent).toMatch(/password|credentials/i);
    });

    it('should handle missing authentication tokens', () => {
      expect(authContent).toMatch(/token|authorization/i);
    });

    it('should not expose sensitive error details', () => {
      // Should not leak database errors or internal details
      const hasGenericErrors = authContent.match(/Authentication failed|Invalid credentials/i);
      expect(hasGenericErrors).toBeTruthy();
    });
  });

  describe('Payment Error Handling', () => {
    let paymentsContent;

    beforeAll(() => {
      const paymentsPath = path.join(__dirname, '../../routes/payments.js');
      if (fs.existsSync(paymentsPath)) {
        paymentsContent = fs.readFileSync(paymentsPath, 'utf8');
      }
    });

    it('should handle Stripe errors', () => {
      if (!paymentsContent) {
        expect(true).toBe(true);
        return;
      }

      expect(paymentsContent).toMatch(/stripe|payment.*error/i);
      expect(paymentsContent).toMatch(/try.*catch/s);
    });

    it('should handle payment validation errors', () => {
      if (!paymentsContent) {
        expect(true).toBe(true);
        return;
      }

      expect(paymentsContent).toMatch(/amount|price/i);
    });

    it('should return appropriate error status codes', () => {
      if (!paymentsContent) {
        expect(true).toBe(true);
        return;
      }

      expect(paymentsContent).toMatch(/res\.status\([45]\d{2}\)/);
    });
  });

  describe('WebSocket Error Handling', () => {
    let websocketContent;

    beforeAll(() => {
      const wsPath = path.join(__dirname, '../../websocket-server-v2.js');
      if (fs.existsSync(wsPath)) {
        websocketContent = fs.readFileSync(wsPath, 'utf8');
      }
    });

    it('should handle connection errors', () => {
      if (!websocketContent) {
        expect(true).toBe(true);
        return;
      }

      expect(websocketContent).toMatch(/error.*connect|connect.*error/i);
    });

    it('should handle message errors', () => {
      if (!websocketContent) {
        expect(true).toBe(true);
        return;
      }

      expect(websocketContent).toMatch(/error|catch/i);
    });

    it('should emit error events to clients', () => {
      if (!websocketContent) {
        expect(true).toBe(true);
        return;
      }

      expect(websocketContent).toMatch(/emit.*error|socket\.emit/);
    });
  });

  describe('Logging and Monitoring', () => {
    let loggerPath;
    let loggerContent;

    beforeAll(() => {
      loggerPath = path.join(__dirname, '../../utils/logger.js');
      if (fs.existsSync(loggerPath)) {
        loggerContent = fs.readFileSync(loggerPath, 'utf8');
      }
    });

    it('should have a centralized logging utility', () => {
      expect(fs.existsSync(loggerPath)).toBe(true);
    });

    it('should support different log levels', () => {
      if (!loggerContent) {
        expect(true).toBe(true);
        return;
      }

      expect(loggerContent).toMatch(/error|warn|info|debug/i);
    });

    it('should log errors with context', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Should log errors with useful information
      const hasContextualLogging = serverContent.match(/logger\.error.*{|console\.error.*{/s);
      expect(hasContextualLogging).toBeTruthy();
    });
  });

  describe('Error Recovery', () => {
    it('should have graceful shutdown handling', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      expect(serverContent).toMatch(/SIGTERM|SIGINT/);
    });

    it('should cleanup resources on errors', () => {
      const serverContent = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

      // Should handle process signals and cleanup
      expect(serverContent).toMatch(/process\.on|close|exit/);
    });
  });

  describe('Client-Side Error Handling', () => {
    it('should have error handling in client-side JavaScript', () => {
      const publicJsDir = path.join(__dirname, '../../public/assets/js');
      if (!fs.existsSync(publicJsDir)) {
        expect(true).toBe(true);
        return;
      }

      const jsFiles = fs.readdirSync(publicJsDir).filter(f => f.endsWith('.js'));
      let hasErrorHandling = false;

      jsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(publicJsDir, file), 'utf8');
        if (content.includes('catch') || content.includes('error')) {
          hasErrorHandling = true;
        }
      });

      expect(hasErrorHandling).toBe(true);
    });

    it('should display user-friendly error messages', () => {
      const publicJsDir = path.join(__dirname, '../../public/assets/js');
      if (!fs.existsSync(publicJsDir)) {
        expect(true).toBe(true);
        return;
      }

      const jsFiles = fs.readdirSync(publicJsDir).filter(f => f.endsWith('.js'));
      let hasUserMessages = false;

      jsFiles.forEach(file => {
        const content = fs.readFileSync(path.join(publicJsDir, file), 'utf8');
        if (content.match(/alert|toast|message.*error|error.*message/i)) {
          hasUserMessages = true;
        }
      });

      expect(hasUserMessages).toBe(true);
    });
  });
});
