/**
 * Integration tests for CSRF protection (contract-focused)
 */

'use strict';

const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');

const { csrfProtection, getToken, generateToken } = require('../../middleware/csrf');

function createCsrfApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  app.get('/csrf-token', (req, res) => {
    const csrfToken = getToken(req, res);
    res.status(200).json({ csrfToken, token: csrfToken });
  });

  app.post('/protected', csrfProtection, (_req, res) => {
    res.status(200).json({ success: true });
  });

  app.get('/safe', csrfProtection, (_req, res) => {
    res.status(200).json({ success: true });
  });

  return app;
}

describe('CSRF Protection (Double-Submit Cookie contract)', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('generateToken returns a high-entropy token string', () => {
    const tokenA = generateToken();
    const tokenB = generateToken();

    expect(tokenA).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenB).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenA).not.toBe(tokenB);
  });

  it('GET /csrf-token sets csrf + legacy csrfToken cookies and returns matching payloads', async () => {
    const app = createCsrfApp();
    const res = await request(app).get('/csrf-token');

    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const csrfCookie = res.headers['set-cookie'].find(c => c.startsWith('csrf='));
    const legacyCsrfCookie = res.headers['set-cookie'].find(c => c.startsWith('csrfToken='));

    expect(csrfCookie).toBeTruthy();
    expect(legacyCsrfCookie).toBeTruthy();
    expect(csrfCookie).toMatch(/SameSite=Lax/i);
    expect(csrfCookie).toMatch(/Path=\//i);
    expect(res.body.token).toBe(res.body.csrfToken);
  });

  it('allows safe methods without csrf header', async () => {
    const app = createCsrfApp();
    const res = await request(app).get('/safe');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects state-changing requests when csrf token is missing', async () => {
    const app = createCsrfApp();
    const res = await request(app).post('/protected').send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/csrf token missing/i);
  });

  it('rejects state-changing requests when header and cookie tokens do not match', async () => {
    const app = createCsrfApp();
    const tokenRes = await request(app).get('/csrf-token');
    const csrfCookie = tokenRes.headers['set-cookie'].find(c => c.startsWith('csrf='));

    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', 'mismatch-token')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid csrf token/i);
  });

  it('allows state-changing requests with legacy csrfToken cookie and body token', async () => {
    const app = createCsrfApp();
    const tokenRes = await request(app).get('/csrf-token');
    const legacyCsrfCookie = tokenRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
    const csrfToken = tokenRes.body.csrfToken;

    const res = await request(app)
      .post('/protected')
      .set('Cookie', legacyCsrfCookie)
      .send({ csrfToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows state-changing requests with X-XSRF-Token header alias', async () => {
    const app = createCsrfApp();
    const tokenRes = await request(app).get('/csrf-token');
    const csrfCookie = tokenRes.headers['set-cookie'].find(c => c.startsWith('csrf='));
    const csrfToken = tokenRes.body.csrfToken;

    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie)
      .set('X-XSRF-Token', csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows state-changing requests when header and cookie tokens match', async () => {
    const app = createCsrfApp();
    const tokenRes = await request(app).get('/csrf-token');
    const csrfCookie = tokenRes.headers['set-cookie'].find(c => c.startsWith('csrf='));
    const csrfToken = tokenRes.body.csrfToken;

    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
