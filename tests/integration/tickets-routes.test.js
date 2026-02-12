const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/auth', () => ({
  authRequired: (req, _res, next) => {
    req.user = req.user || {
      id: 'user-1',
      role: 'customer',
      email: 'customer@example.com',
      name: 'Customer One',
    };
    next();
  },
}));

jest.mock('../../middleware/csrf', () => ({
  csrfProtection: (_req, _res, next) => next(),
}));

jest.mock('../../middleware/rateLimits', () => ({
  writeLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../middleware/features', () => ({
  featureRequired: () => (_req, _res, next) => next(),
}));

jest.mock('../../middleware/audit', () => ({
  auditLog: jest.fn(),
}));

jest.mock('../../db-unified', () => ({
  read: jest.fn(),
  write: jest.fn(),
}));

const dbUnified = require('../../db-unified');
const ticketsRoutes = require('../../routes/tickets');

describe('Tickets Routes Integration', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = {
        id: req.headers['x-test-user-id'] || 'user-1',
        role: req.headers['x-test-user-role'] || 'customer',
        email: 'user@example.com',
        name: 'Test User',
      };
      next();
    });
    app.use('/api/tickets', ticketsRoutes);

    dbUnified.read.mockReset();
    dbUnified.write.mockReset();
  });

  it('rejects ticket creation when senderType does not match account role', async () => {
    const response = await request(app)
      .post('/api/tickets')
      .set('x-test-user-role', 'customer')
      .send({
        senderType: 'supplier',
        subject: 'Need help with booking',
        message: 'I need help with booking and payment issue',
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Sender type does not match/i);
  });

  it('creates ticket with normalized priority and trimmed content', async () => {
    dbUnified.read.mockResolvedValue([]);
    dbUnified.write.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/tickets')
      .set('x-test-user-role', 'customer')
      .send({
        senderType: 'customer',
        subject: '  Help with invoice  ',
        message: '  I cannot download my invoice for order #1001.  ',
        priority: 'invalid-priority',
      });

    expect(response.status).toBe(201);
    expect(response.body.ticket.priority).toBe('medium');
    expect(response.body.ticket.subject).toBe('Help with invoice');
    expect(response.body.ticket.message).toBe('I cannot download my invoice for order #1001.');
    expect(dbUnified.write).toHaveBeenCalledTimes(1);
  });

  it('allows owner to reply and keeps status consistent', async () => {
    const existing = [
      {
        id: 'ticket-1',
        senderId: 'user-1',
        senderType: 'customer',
        senderEmail: 'customer@example.com',
        subject: 'Issue',
        message: 'Original issue message',
        status: 'open',
        priority: 'medium',
        responses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    dbUnified.read.mockResolvedValue(existing);
    dbUnified.write.mockResolvedValue(true);

    const response = await request(app)
      .post('/api/tickets/ticket-1/reply')
      .set('x-test-user-id', 'user-1')
      .set('x-test-user-role', 'customer')
      .send({ message: 'Adding more context for support team' });

    expect(response.status).toBe(200);
    expect(response.body.ticket.responses).toHaveLength(1);
    expect(response.body.ticket.responses[0].message).toBe('Adding more context for support team');
    expect(response.body.ticket.status).toBe('open');
  });
});
