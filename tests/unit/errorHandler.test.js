/**
 * Unit tests for centralized error handler
 * Tests error code mapping, multer errors, and production behavior
 */

const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../middleware/errorHandler');

describe('Error Handler', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Multer Error Handling', () => {
    test('should return 413 for LIMIT_FILE_SIZE error', async () => {
      app.post('/upload', (req, res, next) => {
        const err = new Error('File too large');
        err.code = 'LIMIT_FILE_SIZE';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/upload');

      expect(response.status).toBe(413);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('size exceeds');
    });

    test('should return 400 for LIMIT_FILE_COUNT error', async () => {
      app.post('/upload', (req, res, next) => {
        const err = new Error('Too many files');
        err.code = 'LIMIT_FILE_COUNT';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/upload');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('LIMIT_FILE_COUNT');
    });

    test('should return 400 for LIMIT_UNEXPECTED_FILE error', async () => {
      app.post('/upload', (req, res, next) => {
        const err = new Error('Unexpected field');
        err.code = 'LIMIT_UNEXPECTED_FILE';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/upload');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Validation Error Handling', () => {
    test('should return 400 for ValidationError', async () => {
      app.post('/validate', (req, res, next) => {
        const err = new Error('Invalid input data');
        err.name = 'ValidationError';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/validate');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid input');
    });
  });

  describe('JWT Error Handling', () => {
    test('should return 401 for JsonWebTokenError', async () => {
      app.get('/protected', (req, res, next) => {
        const err = new Error('Invalid token');
        err.name = 'JsonWebTokenError';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should return 401 for TokenExpiredError', async () => {
      app.get('/protected', (req, res, next) => {
        const err = new Error('Token expired');
        err.name = 'TokenExpiredError';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Production vs Development', () => {
    test('should not leak stack traces in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/error', (req, res, next) => {
        const err = new Error('Internal server error');
        err.status = 500;
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).toBe('Internal Server Error');

      process.env.NODE_ENV = originalEnv;
    });

    test('should include stack traces in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.get('/error', (req, res, next) => {
        const err = new Error('Test error');
        err.status = 500;
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('stack');

      process.env.NODE_ENV = originalEnv;
    });

    test('should show validation errors in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.post('/data', (req, res, next) => {
        const err = new Error('Email is required');
        err.name = 'ValidationError';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/data');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Custom Status Codes', () => {
    test('should respect custom status codes', async () => {
      app.get('/notfound', (req, res, next) => {
        const err = new Error('Resource not found');
        err.status = 404;
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/notfound');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('status', 404);
    });

    test('should default to 500 for errors without status', async () => {
      app.get('/error', (req, res, next) => {
        const err = new Error('Something went wrong');
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/error');

      expect(response.status).toBe(500);
    });
  });

  describe('Error Response Format', () => {
    test('should return consistent JSON error format', async () => {
      app.get('/error', (req, res, next) => {
        const err = new Error('Test error');
        err.status = 400;
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).get('/error');

      expect(response.status).toBe(400);
      expect(response.type).toBe('application/json');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('status');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.status).toBe('number');
    });

    test('should include error code when present', async () => {
      app.post('/upload', (req, res, next) => {
        const err = new Error('File too large');
        err.code = 'LIMIT_FILE_SIZE';
        next(err);
      });
      app.use(errorHandler);

      const response = await request(app).post('/upload');

      expect(response.body).toHaveProperty('code', 'LIMIT_FILE_SIZE');
    });
  });
});
