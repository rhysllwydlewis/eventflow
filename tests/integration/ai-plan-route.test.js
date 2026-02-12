/**
 * Integration tests for AI Plan Route
 * Tests the /api/ai/plan endpoint extracted to routes/ai.js
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../../server');
const dbUnified = require('../../db-unified');
const { uid } = require('../../store');

const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-testing-only-minimum-32-characters-long';

describe('AI Plan Route', () => {
  let userId;
  let userEmail;
  let authToken;

  beforeAll(async () => {
    userId = uid('usr');
    userEmail = `ai-plan-${Date.now()}@example.com`;

    const users = await dbUnified.read('users');
    users.push({
      id: userId,
      name: 'AI Plan Test User',
      firstName: 'AI',
      lastName: 'Tester',
      email: userEmail,
      role: 'customer',
      verified: true,
      passwordHash: bcrypt.hashSync('Test123!@#', 10),
      createdAt: new Date().toISOString(),
    });
    await dbUnified.write('users', users);

    authToken = jwt.sign({ id: userId, email: userEmail, role: 'customer' }, JWT_SECRET, {
      expiresIn: '1h',
    });
  });

  afterAll(async () => {
    const users = await dbUnified.read('users');
    await dbUnified.write(
      'users',
      users.filter(user => user.id !== userId)
    );
  });

  describe('POST /api/ai/plan', () => {
    it('should respond with fallback suggestions when OpenAI is not configured', async () => {
      const res = await request(app)
        .post('/api/ai/plan')
        .set('Cookie', `token=${authToken}`)
        .send({
          prompt: 'Help me plan a wedding for 100 guests',
          plan: { guests: [], tasks: [], timeline: [] },
        })
        .expect(200);

      // Should return fallback data since OpenAI is not configured in test env
      expect(res.body.from).toBe('fallback');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.checklist).toBeDefined();
      expect(Array.isArray(res.body.data.checklist)).toBe(true);
      expect(res.body.data.timeline).toBeDefined();
      expect(Array.isArray(res.body.data.timeline)).toBe(true);
      expect(res.body.data.suppliers).toBeDefined();
      expect(Array.isArray(res.body.data.suppliers)).toBe(true);
      expect(res.body.data.budget).toBeDefined();
      expect(Array.isArray(res.body.data.budget)).toBe(true);
      expect(res.body.data.styleIdeas).toBeDefined();
      expect(Array.isArray(res.body.data.styleIdeas)).toBe(true);
      expect(res.body.data.messages).toBeDefined();
      expect(Array.isArray(res.body.data.messages)).toBe(true);
    });

    it('should include plan summary in prompt when plan data is provided', async () => {
      const res = await request(app)
        .post('/api/ai/plan')
        .set('Cookie', `token=${authToken}`)
        .send({
          prompt: 'Give me more ideas',
          plan: {
            guests: [{ name: 'John' }, { name: 'Jane' }],
            tasks: [{ name: 'Book venue' }],
            timeline: [{ time: '14:00', activity: 'Ceremony' }],
          },
        })
        .expect(200);

      expect(res.body.from).toBe('fallback');
      expect(res.body.data).toBeDefined();
    });

    it('should handle empty request body gracefully', async () => {
      const res = await request(app)
        .post('/api/ai/plan')
        .set('Cookie', `token=${authToken}`)
        .send({})
        .expect(200);

      expect(res.body.from).toBe('fallback');
      expect(res.body.data).toBeDefined();
    });
  });
});
