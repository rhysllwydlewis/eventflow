/**
 * Integration tests for Plan API endpoints
 */

const request = require('supertest');
const app = require('../../server');
const dbUnified = require('../../db-unified');
const bcrypt = require('bcryptjs');
const { uid } = require('../../store');
const jwt = require('jsonwebtoken');

const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-testing-only-minimum-32-characters-long';

describe('Plan API Endpoints', () => {
  let authToken;
  let userId;
  let userEmail;

  beforeAll(async () => {
    // Create a verified test user directly in the database
    userEmail = `test-plan-${Date.now()}@example.com`;
    userId = uid('usr');

    const testUser = {
      id: userId,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      email: userEmail,
      role: 'customer',
      passwordHash: bcrypt.hashSync('Test123!@#', 10),
      location: 'Test Location',
      verified: true, // Pre-verified for testing
      createdAt: new Date().toISOString(),
    };

    const users = await dbUnified.read('users');
    users.push(testUser);
    await dbUnified.write('users', users);

    // Generate auth token
    authToken = jwt.sign({ id: userId, email: userEmail, role: 'customer' }, JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      const plans = await dbUnified.read('plans');
      const filtered = plans.filter(p => p.userId !== userId);
      await dbUnified.write('plans', filtered);

      const users = await dbUnified.read('users');
      const filteredUsers = users.filter(u => u.id !== userId);
      await dbUnified.write('users', filteredUsers);
    }
  });

  describe('POST /api/me/plans', () => {
    it('should create a new plan', async () => {
      const planData = {
        eventType: 'Wedding',
        eventName: 'John & Jane Wedding',
        location: 'London',
        date: '2024-08-15',
        guests: 120,
        budget: '£10,000+',
        packages: ['pkg1', 'pkg2'],
      };

      const res = await request(app)
        .post('/api/me/plans')
        .set('Cookie', `token=${authToken}`)
        .send(planData)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.eventType).toBe('Wedding');
      expect(res.body.plan.eventName).toBe('John & Jane Wedding');
      expect(res.body.plan.location).toBe('London');
      expect(res.body.plan.packages).toEqual(['pkg1', 'pkg2']);
    });

    it('should require event type', async () => {
      const res = await request(app)
        .post('/api/me/plans')
        .set('Cookie', `token=${authToken}`)
        .send({ location: 'Manchester' })
        .expect(400);

      expect(res.body.error).toBeTruthy();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/me/plans')
        .send({ eventType: 'Wedding' })
        .expect(401);
    });
  });

  describe('GET /api/me/plans', () => {
    it('should return user plans', async () => {
      // First create a plan
      await request(app).post('/api/me/plans').set('Cookie', `token=${authToken}`).send({
        eventType: 'Other',
        eventName: 'Birthday Party',
        location: 'Brighton',
      });

      // Then retrieve plans
      const res = await request(app)
        .get('/api/me/plans')
        .set('Cookie', `token=${authToken}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.plans).toBeDefined();
      expect(Array.isArray(res.body.plans)).toBe(true);
      expect(res.body.plans.length).toBeGreaterThan(0);

      const plan = res.body.plans[0];
      expect(plan.userId).toBe(userId);
    });

    it('should return empty array when no plans', async () => {
      // Create a new verified user with no plans directly in database
      const newUserEmail = `test-noplan-${Date.now()}@example.com`;
      const newUserId = uid('usr');

      const newUser = {
        id: newUserId,
        name: 'Test User No Plans',
        firstName: 'Test',
        lastName: 'NoPlans',
        email: newUserEmail,
        role: 'customer',
        passwordHash: bcrypt.hashSync('Test123!@#', 10),
        location: 'Test Location',
        verified: true,
        createdAt: new Date().toISOString(),
      };

      const users = await dbUnified.read('users');
      users.push(newUser);
      await dbUnified.write('users', users);

      // Generate auth token
      const newUserToken = jwt.sign(
        { id: newUserId, email: newUserEmail, role: 'customer' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/me/plans')
        .set('Cookie', `token=${newUserToken}`)
        .expect(200);

      expect(res.body.plans).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app).get('/api/me/plans').expect(401);
    });
  });

  describe('POST /api/plans/guest', () => {
    it('should create a guest plan without authentication', async () => {
      const planData = {
        eventType: 'Wedding',
        eventName: 'Guest Wedding',
        location: 'Manchester',
        date: '2024-09-20',
        guests: 80,
        budget: '£3,000–£10,000',
        packages: ['pkg1'],
      };

      const res = await request(app).post('/api/plans/guest').send(planData).expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.eventType).toBe('Wedding');
      expect(res.body.plan.isGuestPlan).toBe(true);
      expect(res.body.plan.userId).toBeNull();
      expect(res.body.token).toBeDefined();
      expect(res.body.plan.guestToken).toBe(res.body.token);
    });

    it('should require event type', async () => {
      const res = await request(app)
        .post('/api/plans/guest')
        .send({ location: 'Leeds' })
        .expect(400);

      expect(res.body.error).toBeTruthy();
    });
  });

  describe('POST /api/me/plans/claim', () => {
    let guestToken;
    let guestPlanId;

    beforeEach(async () => {
      // Create a guest plan first
      const res = await request(app).post('/api/plans/guest').send({
        eventType: 'Other',
        eventName: 'Birthday Party',
        location: 'Liverpool',
      });

      guestToken = res.body.token;
      guestPlanId = res.body.plan.id;
    });

    it('should claim a guest plan after authentication', async () => {
      // Create a new verified user directly in the database
      const claimUserEmail = `test-claim-${Date.now()}@example.com`;
      const claimUserId = uid('usr');

      const claimUser = {
        id: claimUserId,
        name: 'Test Claim User',
        firstName: 'Test',
        lastName: 'Claim',
        email: claimUserEmail,
        role: 'customer',
        passwordHash: bcrypt.hashSync('Test123!@#', 10),
        location: 'Test Location',
        verified: true,
        createdAt: new Date().toISOString(),
      };

      const users = await dbUnified.read('users');
      users.push(claimUser);
      await dbUnified.write('users', users);

      // Generate auth token
      const claimToken = jwt.sign(
        { id: claimUserId, email: claimUserEmail, role: 'customer' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Claim the guest plan
      const res = await request(app)
        .post('/api/me/plans/claim')
        .set('Cookie', `token=${claimToken}`)
        .send({ token: guestToken })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.id).toBe(guestPlanId);
      expect(res.body.plan.userId).toBe(claimUserId);
      expect(res.body.plan.isGuestPlan).toBe(false);
      expect(res.body.plan.claimedAt).toBeDefined();

      // Clean up
      if (claimUserId) {
        const plans = await dbUnified.read('plans');
        const filtered = plans.filter(p => p.userId !== claimUserId);
        await dbUnified.write('plans', filtered);

        const users = await dbUnified.read('users');
        const filteredUsers = users.filter(u => u.id !== claimUserId);
        await dbUnified.write('users', filteredUsers);
      }
    });

    it('should require authentication', async () => {
      await request(app).post('/api/me/plans/claim').send({ token: guestToken }).expect(401);
    });

    it('should require token', async () => {
      const res = await request(app)
        .post('/api/me/plans/claim')
        .set('Cookie', `token=${authToken}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBeTruthy();
    });

    it('should fail with invalid token', async () => {
      await request(app)
        .post('/api/me/plans/claim')
        .set('Cookie', `token=${authToken}`)
        .send({ token: 'invalid-token' })
        .expect(404);
    });

    it('should not allow claiming if user already has a plan', async () => {
      // User already has a plan from beforeAll
      const res = await request(app)
        .post('/api/me/plans/claim')
        .set('Cookie', `token=${authToken}`)
        .send({ token: guestToken })
        .expect(400);

      expect(res.body.error).toContain('already have a plan');
    });

    afterEach(async () => {
      // Clean up guest plans
      const plans = await dbUnified.read('plans');
      const filtered = plans.filter(p => p.guestToken !== guestToken);
      await dbUnified.write('plans', filtered);
    });
  });
});
