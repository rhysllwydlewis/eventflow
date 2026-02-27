/**
 * Unit tests for wsAuth shared WebSocket authentication utility
 * Covers userIdFromCookie: valid JWT, expired JWT, missing cookie, wrong secret
 */

'use strict';

const jwt = require('jsonwebtoken');
const { userIdFromCookie } = require('../../utils/wsAuth');

describe('wsAuth — userIdFromCookie', () => {
  const JWT_SECRET = 'test-ws-auth-secret-minimum-32-chars-long-ok';
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  it('returns userId from a valid JWT cookie using `id` field', () => {
    const token = jwt.sign({ id: 'user_abc' }, JWT_SECRET, { expiresIn: '1h' });
    const cookieHeader = `token=${token}; other=ignored`;
    expect(userIdFromCookie(cookieHeader)).toBe('user_abc');
  });

  it('returns userId from a valid JWT cookie using legacy `userId` field', () => {
    const token = jwt.sign({ userId: 'user_legacy' }, JWT_SECRET, { expiresIn: '1h' });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBe('user_legacy');
  });

  it('prefers `id` over `userId` when both are present', () => {
    const token = jwt.sign({ id: 'primary', userId: 'legacy' }, JWT_SECRET, { expiresIn: '1h' });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBe('primary');
  });

  it('returns null for an expired JWT', () => {
    const token = jwt.sign({ id: 'user_xyz' }, JWT_SECRET, { expiresIn: -1 });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBeNull();
  });

  it('returns null when the cookie header is null', () => {
    expect(userIdFromCookie(null)).toBeNull();
  });

  it('returns null when the cookie header is an empty string', () => {
    expect(userIdFromCookie('')).toBeNull();
  });

  it('returns null when the `token` cookie is absent', () => {
    expect(userIdFromCookie('other=value; another=test')).toBeNull();
  });

  it('returns null when the JWT was signed with a different secret', () => {
    const token = jwt.sign({ id: 'user_abc' }, 'wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', {
      expiresIn: '1h',
    });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBeNull();
  });

  it('returns null when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const token = jwt.sign({ id: 'user_abc' }, JWT_SECRET, { expiresIn: '1h' });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBeNull();
  });

  it('returns null when the token value is not valid JWT', () => {
    expect(userIdFromCookie('token=not_a_valid_jwt')).toBeNull();
  });

  it('returns null when the decoded token has no recognised user ID field', () => {
    const token = jwt.sign({ email: 'test@test.com' }, JWT_SECRET, { expiresIn: '1h' });
    const cookieHeader = `token=${token}`;
    expect(userIdFromCookie(cookieHeader)).toBeNull();
  });
});
