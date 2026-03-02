/**
 * Integration tests for email verification workflow
 * Tests the complete registration -> verification -> login flow
 */

const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const { uid } = require('../../store');

// Mock the store module
let mockUsers = [];
jest.mock('../../store', () => {
  const actualStore = jest.requireActual('../../store');
  return {
    ...actualStore,
    read: jest.fn(collection => {
      if (collection === 'users') {
        return [...mockUsers];
      }
      return [];
    }),
    write: jest.fn((collection, data) => {
      if (collection === 'users') {
        mockUsers = [...data];
      }
    }),
  };
});

// Mock postmark
jest.mock('../../utils/postmark', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({
    MessageID: 'test-message-id',
    To: 'test@example.com',
  }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({
    MessageID: 'test-welcome-message-id',
    To: 'test@example.com',
  }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({
    MessageID: 'test-reset-message-id',
    To: 'test@example.com',
  }),
  isPostmarkEnabled: jest.fn(() => true),
  getPostmarkStatus: jest.fn(() => ({
    enabled: true,
    from: 'admin@event-flow.co.uk',
    appBaseUrl: 'http://localhost:3000',
  })),
}));

describe('Email Verification Integration Tests', () => {
  let app;
  let authRouter;
  let postmark;
  const JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-characters-long';

  beforeAll(() => {
    // Set required environment variables
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
    process.env.APP_BASE_URL = 'http://localhost:3000';

    // Create test Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Import auth routes
    authRouter = require('../../routes/auth');
    postmark = require('../../utils/postmark');

    // Mount auth routes
    app.use('/api/auth', authRouter);
  });

  beforeEach(() => {
    // Reset mock users before each test
    mockUsers = [];
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
    delete process.env.APP_BASE_URL;
  });

  describe('Registration with Verification', () => {
    it('should create user and send verification email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          name: 'Test User',
          email: 'test@example.com',
          password: 'TestPass123',
          role: 'customer',
          location: 'London',
        })
        .expect(201);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');

      // Verify email was sent
      expect(postmark.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(postmark.sendVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
        }),
        expect.any(String)
      );

      // Verify user is created with verification token
      expect(mockUsers.length).toBe(1);
      expect(mockUsers[0]).toHaveProperty('verified', false);
      expect(mockUsers[0]).toHaveProperty('verificationToken');
      expect(mockUsers[0]).toHaveProperty('verificationTokenExpiresAt');
    });

    it('should not create user if email sending fails', async () => {
      // Mock email sending failure
      postmark.sendVerificationEmail.mockRejectedValueOnce(new Error('Email service unavailable'));

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'User',
          name: 'Test User',
          email: 'fail@example.com',
          password: 'TestPass123',
          role: 'customer',
          location: 'London',
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('verification email');

      // Verify user was NOT created
      expect(mockUsers.length).toBe(0);
    });

    it('should reject registration with existing email', async () => {
      // Create existing user
      mockUsers = [
        {
          id: 'existing-user',
          email: 'existing@example.com',
          name: 'Existing User',
          passwordHash: bcrypt.hashSync('password123', 10),
          verified: true,
          role: 'customer',
        },
      ];

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          name: 'New User',
          email: 'existing@example.com',
          password: 'TestPass123',
          role: 'customer',
          location: 'London',
        })
        .expect(409);

      expect(response.body.error).toContain('already registered');

      // Verify no email was sent
      expect(postmark.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('Email Verification', () => {
    let verificationToken;

    beforeEach(() => {
      // Create unverified user
      verificationToken = uid('verify');
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockUsers = [
        {
          id: 'unverified-user',
          email: 'unverified@example.com',
          name: 'Unverified User',
          passwordHash: bcrypt.hashSync('password123', 10),
          verified: false,
          verificationToken: verificationToken,
          verificationTokenExpiresAt: tokenExpiresAt,
          role: 'customer',
          createdAt: new Date().toISOString(),
        },
      ];
    });

    it('should verify user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .query({ token: verificationToken })
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('verified successfully');

      // Verify user is now verified
      expect(mockUsers[0].verified).toBe(true);
      expect(mockUsers[0].verificationToken).toBeUndefined();
      expect(mockUsers[0].verificationTokenExpiresAt).toBeUndefined();

      // Verify welcome email was sent
      expect(postmark.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .query({ token: 'invalid-token-123' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid or expired');

      // Verify user is still unverified
      expect(mockUsers[0].verified).toBe(false);
      expect(mockUsers[0].verificationToken).toBe(verificationToken);
    });

    it('should reject expired verification token', async () => {
      // Set token expiration to the past
      mockUsers[0].verificationTokenExpiresAt = new Date(Date.now() - 1000).toISOString();

      const response = await request(app)
        .get('/api/auth/verify')
        .query({ token: verificationToken })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('expired');

      // Verify user is still unverified
      expect(mockUsers[0].verified).toBe(false);
    });

    it('should reject verification without token', async () => {
      const response = await request(app).get('/api/auth/verify').expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing token');
    });
  });

  describe('Login with Verification Check', () => {
    beforeEach(() => {
      // Create both verified and unverified users
      mockUsers = [
        {
          id: 'verified-user',
          email: 'verified@example.com',
          name: 'Verified User',
          passwordHash: bcrypt.hashSync('password123', 10),
          verified: true,
          role: 'customer',
        },
        {
          id: 'unverified-user',
          email: 'unverified@example.com',
          name: 'Unverified User',
          passwordHash: bcrypt.hashSync('password123', 10),
          verified: false,
          verificationToken: 'some-token',
          verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          role: 'customer',
        },
      ];
    });

    it('should allow login for verified user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('verified@example.com');
    });

    it('should block login for unverified user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'password123',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('verify your email');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verified@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });
  });

  describe('Complete Registration to Login Flow', () => {
    it('should complete full workflow: register -> verify -> login', async () => {
      // Step 1: Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Complete',
          lastName: 'Test User',
          name: 'Complete Test User',
          email: 'complete@example.com',
          password: 'TestPass123',
          role: 'customer',
          location: 'London',
        })
        .expect(201);

      expect(registerResponse.body.ok).toBe(true);

      // Get verification token from the created user
      const user = mockUsers.find(u => u.email === 'complete@example.com');
      expect(user).toBeTruthy();
      expect(user.verified).toBe(false);
      const { verificationToken } = user;

      // Step 2: Try to login before verification (should fail)
      const loginBeforeVerify = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'complete@example.com',
          password: 'TestPass123',
        })
        .expect(403);

      expect(loginBeforeVerify.body.error).toContain('verify your email');

      // Step 3: Verify email
      const verifyResponse = await request(app)
        .get('/api/auth/verify')
        .query({ token: verificationToken })
        .expect(200);

      expect(verifyResponse.body.ok).toBe(true);

      // Step 4: Login after verification (should succeed)
      const loginAfterVerify = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'complete@example.com',
          password: 'TestPass123',
        })
        .expect(200);

      expect(loginAfterVerify.body.ok).toBe(true);
      expect(loginAfterVerify.body.user.email).toBe('complete@example.com');
    });
  });
});
