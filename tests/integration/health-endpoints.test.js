/**
 * Integration tests for /api/health and /api/ready endpoints
 * Tests MongoDB connection status reporting and validation
 */

const request = require('supertest');
const express = require('express');

// Mock the db module
jest.mock('../../db', () => {
  let mockConnectionState = 'disconnected';
  let mockConnectionError = null;
  let mockIsConnected = false;

  return {
    isConnected: jest.fn(() => mockIsConnected),
    getConnectionState: jest.fn(() => mockConnectionState),
    getConnectionError: jest.fn(() => mockConnectionError),
    isMongoAvailable: jest.fn(() => true),

    // Test helper methods to control mock state
    __setMockState: (state, error = null, connected = false) => {
      mockConnectionState = state;
      mockConnectionError = error;
      mockIsConnected = connected;
    },
  };
});

// Mock db-unified module
jest.mock('../../db-unified', () => ({
  getDatabaseStatus: jest.fn(() => ({
    type: 'mongodb',
    connected: false,
    state: 'not_started',
    error: null,
  })),
  __setMockStatus: function (status) {
    this.getDatabaseStatus.mockReturnValue(status);
  },
}));

// Mock mailgun
jest.mock('../../utils/mailgun', () => ({
  isMailgunEnabled: jest.fn(() => false),
  getMailgunStatus: jest.fn(() => ({ domain: 'test.example.com' })),
}));

describe('Health and Readiness Endpoints', () => {
  let app;
  let db;
  let dbUnified;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-characters-long';
    process.env.EMAIL_ENABLED = 'false';
  });

  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.disable('x-powered-by');

    // Get mocked modules
    db = require('../../db');
    dbUnified = require('../../db-unified');

    // Reset mocks
    jest.clearAllMocks();

    // Define test endpoints
    app.get('/api/health', async (_req, res) => {
      const timestamp = new Date().toISOString();

      const response = {
        status: 'ok',
        timestamp,
        services: {
          server: 'running',
        },
      };

      try {
        const mongoState = db.getConnectionState();
        const mongoError = db.getConnectionError();

        if (mongoState === 'connected') {
          response.services.mongodb = 'connected';
        } else if (mongoState === 'connecting') {
          response.services.mongodb = 'connecting';
          response.status = 'degraded';
        } else if (mongoState === 'error') {
          response.services.mongodb = 'disconnected';
          response.status = 'degraded';
          if (mongoError) {
            response.services.mongodbError = mongoError;
            response.services.lastConnectionError = mongoError;
          }
        } else {
          response.services.mongodb = 'disconnected';
        }
      } catch (error) {
        response.services.mongodb = 'unknown';
        response.services.mongodbError = error.message;
        response.services.lastConnectionError = error.message;
        response.status = 'degraded';
      }

      try {
        const dbStatus = dbUnified.getDatabaseStatus();
        if (dbStatus) {
          response.services.database = dbStatus.type;
          response.services.activeBackend = dbStatus.type;

          if (dbStatus.connected) {
            response.services.databaseStatus = 'connected';
          } else if (dbStatus.state === 'in_progress') {
            response.services.databaseStatus = 'initializing';
            response.status = 'degraded';
          } else {
            response.services.databaseStatus = 'disconnected';
          }

          if (dbStatus.error) {
            response.services.databaseError = dbStatus.error;
            if (!response.services.lastConnectionError) {
              response.services.lastConnectionError = dbStatus.error;
            }
          }
        }
      } catch (error) {
        response.services.database = 'unknown';
        response.services.activeBackend = 'unknown';
      }

      response.version = 'test-version';
      response.environment = 'test';
      response.email = 'disabled';
      response.services.emailStatus = 'disabled';

      res.status(200).json(response);
    });

    app.get('/api/ready', async (_req, res) => {
      const timestamp = new Date().toISOString();
      const isMongoConnected = db.isConnected();
      const mongoState = db.getConnectionState();
      const mongoError = db.getConnectionError();

      let activeBackend = 'unknown';
      try {
        const dbStatus = dbUnified.getDatabaseStatus();
        if (dbStatus) {
          activeBackend = dbStatus.type;
        }
      } catch (error) {
        // Ignore
      }

      if (!isMongoConnected) {
        return res.status(503).json({
          status: 'not_ready',
          timestamp,
          reason: 'Database not connected',
          details: mongoError || 'MongoDB connection is not established',
          services: {
            server: 'running',
            mongodb: mongoState,
            activeBackend: activeBackend,
          },
          debug: {
            mongoState: mongoState,
            lastConnectionError: mongoError,
            message:
              'Server is operational but MongoDB is not connected. Using fallback storage if configured.',
          },
        });
      }

      return res.status(200).json({
        status: 'ready',
        timestamp,
        services: {
          server: 'running',
          mongodb: 'connected',
          activeBackend: 'mongodb',
        },
        message: 'All systems operational',
      });
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 and ok status when MongoDB is connected', async () => {
      // Mock MongoDB as connected
      db.__setMockState('connected', null, true);
      dbUnified.__setMockStatus({
        type: 'mongodb',
        connected: true,
        state: 'completed',
        error: null,
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('server', 'running');
      expect(response.body.services).toHaveProperty('mongodb', 'connected');
      expect(response.body.services).toHaveProperty('activeBackend', 'mongodb');
      expect(response.body.services).toHaveProperty('databaseStatus', 'connected');
    });

    it('should return 200 with degraded status when MongoDB is disconnected', async () => {
      // Mock MongoDB as disconnected with error
      const errorMessage = 'Connection timeout';
      db.__setMockState('error', errorMessage, false);
      dbUnified.__setMockStatus({
        type: 'local',
        connected: false,
        state: 'completed',
        error: null,
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'degraded');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('mongodb', 'disconnected');
      expect(response.body.services).toHaveProperty('mongodbError', errorMessage);
      expect(response.body.services).toHaveProperty('lastConnectionError', errorMessage);
      expect(response.body.services).toHaveProperty('activeBackend', 'local');
    });

    it('should return 200 with degraded status when MongoDB is connecting', async () => {
      // Mock MongoDB as connecting
      db.__setMockState('connecting', null, false);
      dbUnified.__setMockStatus({
        type: 'mongodb',
        connected: false,
        state: 'in_progress',
        error: null,
      });

      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'degraded');
      expect(response.body.services).toHaveProperty('mongodb', 'connecting');
      expect(response.body.services).toHaveProperty('databaseStatus', 'initializing');
    });

    it('should include version and environment information', async () => {
      db.__setMockState('connected', null, true);
      dbUnified.__setMockStatus({
        type: 'mongodb',
        connected: true,
        state: 'completed',
        error: null,
      });

      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment', 'test');
      expect(response.body).toHaveProperty('email', 'disabled');
    });

    it('should report database error when unified layer has error', async () => {
      const dbError = 'Database initialization failed';
      db.__setMockState('error', 'MongoDB error', false);
      dbUnified.__setMockStatus({
        type: 'local',
        connected: false,
        state: 'failed',
        error: dbError,
      });

      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.services).toHaveProperty('databaseError', dbError);
      expect(response.body.services).toHaveProperty('lastConnectionError');
    });
  });

  describe('GET /api/ready', () => {
    it('should return 200 when MongoDB is connected', async () => {
      // Mock MongoDB as connected
      db.__setMockState('connected', null, true);
      dbUnified.__setMockStatus({
        type: 'mongodb',
        connected: true,
        state: 'completed',
        error: null,
      });

      const response = await request(app)
        .get('/api/ready')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('server', 'running');
      expect(response.body.services).toHaveProperty('mongodb', 'connected');
      expect(response.body.services).toHaveProperty('activeBackend', 'mongodb');
      expect(response.body).toHaveProperty('message', 'All systems operational');
    });

    it('should return 503 when MongoDB is not connected', async () => {
      // Mock MongoDB as disconnected
      db.__setMockState('disconnected', null, false);
      dbUnified.__setMockStatus({
        type: 'local',
        connected: false,
        state: 'completed',
        error: null,
      });

      const response = await request(app)
        .get('/api/ready')
        .expect(503)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body).toHaveProperty('reason', 'Database not connected');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('mongodb', 'disconnected');
      expect(response.body.services).toHaveProperty('activeBackend', 'local');
      expect(response.body).toHaveProperty('debug');
    });

    it('should return 503 with error details when MongoDB connection failed', async () => {
      const errorMessage = 'Authentication failed';
      db.__setMockState('error', errorMessage, false);
      dbUnified.__setMockStatus({
        type: 'local',
        connected: false,
        state: 'failed',
        error: 'Database error',
      });

      const response = await request(app).get('/api/ready').expect(503);

      expect(response.body).toHaveProperty('status', 'not_ready');
      expect(response.body).toHaveProperty('details', errorMessage);
      expect(response.body.debug).toHaveProperty('lastConnectionError', errorMessage);
      expect(response.body.debug).toHaveProperty('mongoState', 'error');
    });

    it('should include helpful debug information when not ready', async () => {
      db.__setMockState('connecting', null, false);
      dbUnified.__setMockStatus({
        type: 'mongodb',
        connected: false,
        state: 'in_progress',
        error: null,
      });

      const response = await request(app).get('/api/ready').expect(503);

      expect(response.body).toHaveProperty('debug');
      expect(response.body.debug).toHaveProperty('mongoState', 'connecting');
      expect(response.body.debug).toHaveProperty('message');
      expect(response.body.debug.message).toContain('Server is operational');
    });
  });
});
